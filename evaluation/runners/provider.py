"""Explicit providers for evaluation calls; never change a running web backend."""
import os
from dataclasses import dataclass
from typing import Callable
from backend import deepseek_client, qwen_client


@dataclass(frozen=True)
class EvaluationProvider:
    name: str
    model: str
    endpoint: str
    chat: Callable

    def metadata(self):
        return {"provider": self.name, "model": self.model}


def resolve_provider(name):
    if name == "deepseek":
        if not os.getenv("DEEPSEEK_API_KEY", "").strip():
            raise ValueError("Set DEEPSEEK_API_KEY for DeepSeek evaluation.")
        return EvaluationProvider(name, deepseek_client.model_name(),
                                  os.getenv("DEEPSEEK_BASE_URL", deepseek_client.DEFAULT_BASE_URL),
                                  deepseek_client.chat)
    if name == "tacc":
        endpoint = qwen_client.normalize_base_url(os.getenv("QWEN_BASE_URL", ""))
        # qwen_client currently sends this fixed model ID in its request payload.
        return EvaluationProvider(name, "qwen3.8-27b", endpoint, qwen_client.chat)
    raise ValueError("Evaluation provider must be deepseek or tacc.")
