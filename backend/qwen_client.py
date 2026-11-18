"""Call the course Qwen service using only the Python standard library."""
import json
import os
import shlex
import subprocess
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def normalize_base_url(base_url):
    """Accept one service URL, including a file ending in CRLF or whitespace."""
    url = (base_url or "").strip().rstrip("/")
    try:
        parts = urlsplit(url)
        port = parts.port
        valid = (parts.scheme in ("http", "https") and parts.hostname
                 and parts.hostname.upper() != "NODE"
                 and parts.path == "/v1" and not parts.query
                 and not parts.fragment and parts.username is None
                 and parts.password is None and port != 0
                 and not any(c.isspace() for c in url))
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("Set server-url.txt to this run's SERVICE_BASE_URL "
                         "(for example http://compute-node:8000/v1). "
                         "Replace NODE and keep the /v1 suffix.")
    return url


def chat_request(messages, base_url, max_tokens, temperature, *, streaming=False):
    base_url = normalize_base_url(base_url)
    payload = {
        "model": "qwen3.8-27b",
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "chat_template_kwargs": {"enable_thinking": False},
    }
    if streaming:
        payload["stream"] = True
    return Request(
        base_url + "/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
    )


def stream_chat(messages, base_url, max_tokens=256, temperature=0):
    """Yield text as it arrives from a directly connected model."""
    if os.environ.get("TACC_SSH_TARGET"):
        yield chat(messages, base_url, max_tokens, temperature)["choices"][0]["message"]["content"]
        return
    request = chat_request(messages, base_url, max_tokens, temperature, streaming=True)
    yield from stream_response(request)


def stream_response(request):
    with urlopen(request, timeout=90) as response:
        for line in response:
            if not line.startswith(b"data:"):
                continue
            data = line[5:].strip()
            if data == b"[DONE]":
                return
            packet = json.loads(data)
            for choice in packet.get("choices", []):
                if content := choice.get("delta", {}).get("content"):
                    yield content
    raise RuntimeError("The model stream ended early.")


def chat(messages, base_url, max_tokens=256, temperature=0.7, timeout=90):
    """Return the full JSON response, including choices and token usage."""
    request = chat_request(messages, base_url, max_tokens, temperature)
    try:
        gateway = os.environ.get("TACC_SSH_TARGET")
        if gateway:
            args = ["wsl", "-d", "Ubuntu", "--"] if os.name == "nt" else []
            args += ["ssh", "-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10",
                     "-p", os.environ.get("TACC_SSH_PORT", "22")]
            if key := os.environ.get("TACC_SSH_KEY"):
                args += ["-i", key]
            command = shlex.join(["curl", "-fsS", "--noproxy", "*", "--max-time", str(timeout),
                                  "-H", "Content-Type: application/json", "--data-binary", "@-",
                                  request.full_url])
            proc = subprocess.run(args + ["--", gateway, command], input=request.data,
                                  capture_output=True, timeout=timeout + 20, check=True)
            result = json.loads(proc.stdout)
        else:
            with urlopen(request, timeout=timeout) as response:
                result = json.load(response)
    except subprocess.SubprocessError as exc:
        raise RuntimeError("TACC gateway request failed. Check SSH access and the service job.") from exc
    except HTTPError as exc:
        raise RuntimeError(
            f"Qwen service returned HTTP {exc.code}. Check the current service "
            "log, /v1 address, request length and model name qwen3.8-27b."
        ) from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise RuntimeError(
            "Cannot reach the Qwen service or the request timed out. "
            "Wait for 'Application startup complete', confirm the service job "
            "is still running, and update server-url.txt after each restart."
        ) from exc
    except (ValueError, UnicodeError) as exc:
        raise RuntimeError("Qwen service returned invalid JSON; check its log and URL.") from exc
    try:
        content = result["choices"][0]["message"]["content"]
        if not isinstance(content, str):
            raise TypeError("content is not text")
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError("Qwen response has no text answer; check the service log.") from exc
    return result


