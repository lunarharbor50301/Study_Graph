"""DeepSeek Chat Completions for experimental quiz and note generation."""

import json
import os
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from backend.qwen_client import stream_response

DEFAULT_BASE_URL = "https://api.deepseek.com"


def model_name():
    return os.getenv("DEEPSEEK_MODEL", "deepseek-flash")


def completion_request(messages, base_url, max_tokens, temperature, *, stream=False):
    base_url = base_url.strip().rstrip("/")
    try:
        parts = urlsplit(base_url)
        if (parts.scheme != "https" or not parts.hostname or parts.username is not None
                or parts.query or parts.fragment or parts.port == 0
                or parts.path.endswith("/chat/completions") or any(c.isspace() for c in base_url)):
            raise ValueError
    except ValueError as exc:
        raise RuntimeError("Set DEEPSEEK_BASE_URL to an HTTPS API base URL.") from exc
    key = os.getenv("DEEPSEEK_API_KEY", "").strip()
    if not key:
        raise RuntimeError("Set DEEPSEEK_API_KEY in the backend environment.")
    payload = {
        "model": model_name(),
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
        "stream": stream,
    }
    request = Request(base_url + "/chat/completions", data=json.dumps(payload).encode("utf-8"),
                      headers={"Content-Type": "application/json"})
    request.add_unredirected_header("Authorization", f"Bearer {key}")
    return request


def chat(messages, base_url, max_tokens=256, temperature=0, timeout=90):
    try:
        with urlopen(completion_request(messages, base_url, max_tokens, temperature), timeout=timeout) as response:
            return json.load(response)
    except HTTPError as exc:
        raise RuntimeError(f"DeepSeek returned HTTP {exc.code}.") from exc
    except (URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("The DeepSeek request failed or timed out.") from exc


def stream_chat(messages, base_url, max_tokens=256, temperature=0):
    request = completion_request(messages, base_url, max_tokens, temperature, stream=True)
    yield from stream_response(request)
