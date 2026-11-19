"""Resolve a DeepSeek public API or TACC Qwen provider for one feature."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Callable

from fastapi import HTTPException

from backend import deepseek_client
from backend.qwen_client import chat as qwen_chat, stream_chat as qwen_stream_chat

DEFAULT_QWEN_MODEL = "qwen3.8-27b"
_runtime_provider: str | None = None
_health_cache: tuple[float, str, bool, str] | None = None


@dataclass(frozen=True)
class LLMProvider:
    name: str
    endpoint: str
    model: str
    api_key: str
    chat: Callable[..., dict]
    stream: Callable[..., object] | None = None


def _valid_name(value: str) -> str:
    name = value.strip().lower()
    if name not in {"deepseek", "tacc"}:
        raise HTTPException(503, "Set STUDYGRAPH_LLM_PROVIDER to deepseek or tacc.")
    return name


def _provider_name(feature_env: str) -> str:
    if feature_env == "STUDYGRAPH_TUTOR_PROVIDER":
        return _valid_name(os.getenv(feature_env) or "tacc")
    return _valid_name(os.getenv(feature_env) or os.getenv("STUDYGRAPH_LLM_PROVIDER") or "deepseek")


def active_provider() -> str:
    """Return the generation provider selected by the current process."""
    if _runtime_provider:
        return _runtime_provider
    return _valid_name(os.getenv("STUDYGRAPH_GENERATION_PROVIDER")
                       or os.getenv("STUDYGRAPH_LLM_PROVIDER") or "deepseek")


def check_tacc_ready(timeout: float = 2.5) -> tuple[bool, str]:
    """Check the TACC OpenAI-compatible endpoint without waiting for a chat."""
    global _health_cache
    endpoint = os.getenv("QWEN_BASE_URL", "").strip().rstrip("/")
    if not endpoint:
        return False, "QWEN_BASE_URL is not configured for TACC."
    now = time.monotonic()
    if _health_cache and _health_cache[1] == endpoint and now - _health_cache[0] < 5:
        return _health_cache[2], _health_cache[3]
    try:
        request = urllib.request.Request(endpoint + "/models", headers={"Accept": "application/json"})
        with urllib.request.urlopen(request, timeout=timeout) as response:
            if response.status != 200:
                message = f"TACC returned HTTP {response.status}."
                _health_cache = (now, endpoint, False, message)
                return False, message
            json.load(response)
        _health_cache = (now, endpoint, True, "")
        return True, ""
    except urllib.error.HTTPError as exc:
        message = f"TACC returned HTTP {exc.code}."
    except (urllib.error.URLError, TimeoutError, OSError, ValueError):
        message = "TACC is not responding."
    except Exception as exc:  # http.client.IncompleteRead and similar
        message = f"TACC is not responding ({type(exc).__name__})."
    _health_cache = (now, endpoint, False, message)
    return False, message


def set_runtime_provider(name: str) -> str:
    """Switch the generation provider for this process; the tutor stays TACC."""
    global _runtime_provider
    name = _valid_name(name)
    _build(name, require=True, tutor=False)  # validate before changing state
    if name == "tacc" and os.getenv("STUDYGRAPH_PROVIDER_HEALTHCHECK", "1") != "0":
        ready, message = check_tacc_ready()
        if not ready:
            raise HTTPException(503, message)
    _runtime_provider = name
    return name


def reset_runtime_provider() -> None:
    global _runtime_provider, _health_cache
    _runtime_provider = None
    _health_cache = None


def _deepseek_tutor_chat(messages, base_url, max_tokens=256, temperature=0, timeout=90):
    return deepseek_client.chat(messages, base_url, max_tokens=max_tokens,
                                temperature=temperature, timeout=timeout, json_mode=False)


def _build(name: str, *, require: bool, tutor: bool) -> LLMProvider:
    if name == "deepseek":
        endpoint = os.getenv("DEEPSEEK_BASE_URL", deepseek_client.DEFAULT_BASE_URL)
        key = os.getenv("DEEPSEEK_API_KEY", "").strip()
        if require and not key:
            raise HTTPException(503, "Set DEEPSEEK_API_KEY to use the DeepSeek provider.")
        return LLMProvider(
            name=name,
            endpoint=endpoint,
            model=deepseek_client.model_name(),
            api_key=key,
            chat=_deepseek_tutor_chat if tutor else deepseek_client.chat,
            stream=None if tutor else deepseek_client.stream_chat,
        )
    endpoint = os.getenv("QWEN_BASE_URL", "").strip()
    if require and not endpoint:
        raise HTTPException(503, "Set QWEN_BASE_URL to use the TACC provider.")
    return LLMProvider(
        name=name,
        endpoint=endpoint,
        model=os.getenv("QWEN_MODEL", DEFAULT_QWEN_MODEL),
        api_key=os.getenv("QWEN_API_KEY", "local"),
        chat=qwen_chat,
        stream=qwen_stream_chat,
    )


def provider_for(feature_env: str, *, require: bool = True, tutor: bool = False) -> LLMProvider:
    """Resolve a provider without leaking credentials into callers.

    `require=False` is for cache-key construction: it returns the configured
    provider/model even when the API key or endpoint is missing.
    """
    name = _runtime_provider if feature_env == "STUDYGRAPH_GENERATION_PROVIDER" and _runtime_provider else _provider_name(feature_env)
    return _build(name, require=require, tutor=tutor)

