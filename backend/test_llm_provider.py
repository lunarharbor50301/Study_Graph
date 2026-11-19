"""Provider selection is configuration-only and works without TACC."""
import os
import time
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from backend.llm_provider import (
    active_provider,
    provider_for,
    reset_runtime_provider,
    set_runtime_provider,
)


class ProviderSwitchTest(unittest.TestCase):
    def setUp(self):
        reset_runtime_provider()

    def tearDown(self):
        reset_runtime_provider()

    def test_runtime_switch_overrides_feature_env_until_reset(self):
        env = {
            "STUDYGRAPH_LLM_PROVIDER": "deepseek",
            "STUDYGRAPH_GENERATION_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "test",
            "DEEPSEEK_BASE_URL": "https://example.test",
            "QWEN_BASE_URL": "http://127.0.0.1:18029/v1",
            "STUDYGRAPH_PROVIDER_HEALTHCHECK": "0",
        }
        with patch.dict(os.environ, env):
            set_runtime_provider("tacc")
            self.assertEqual(active_provider(), "tacc")
            self.assertEqual(provider_for("STUDYGRAPH_GENERATION_PROVIDER").name, "tacc")
            self.assertEqual(provider_for("STUDYGRAPH_TUTOR_PROVIDER", tutor=True).name, "tacc")
            set_runtime_provider("deepseek")
            self.assertEqual(provider_for("STUDYGRAPH_GENERATION_PROVIDER").name, "deepseek")
            self.assertEqual(provider_for("STUDYGRAPH_TUTOR_PROVIDER", tutor=True).name, "tacc")

    def test_deepseek_is_the_default_and_can_be_overridden_per_feature(self):
        env = {
            "STUDYGRAPH_LLM_PROVIDER": "deepseek",
            "DEEPSEEK_API_KEY": "test",
            "DEEPSEEK_BASE_URL": "https://example.test",
            "DEEPSEEK_MODEL": "deepseek-flash",
            "QWEN_BASE_URL": "http://127.0.0.1:18029/v1",
            "QWEN_MODEL": "qwen3.8-27b",
        }
        with patch.dict(os.environ, env):
            self.assertEqual(provider_for("STUDYGRAPH_GENERATION_PROVIDER").name, "deepseek")
            self.assertEqual(provider_for("STUDYGRAPH_TUTOR_PROVIDER", tutor=True).name, "tacc")
            with patch.dict(os.environ, {"STUDYGRAPH_TUTOR_PROVIDER": "tacc"}):
                tacc = provider_for("STUDYGRAPH_TUTOR_PROVIDER", tutor=True)
            self.assertEqual(tacc.name, "tacc")
            self.assertEqual(tacc.model, "qwen3.8-27b")

    def test_missing_key_fails_only_when_the_provider_is_required(self):
        with patch.dict(os.environ, {"STUDYGRAPH_LLM_PROVIDER": "deepseek"}, clear=True):
            self.assertEqual(provider_for("STUDYGRAPH_GENERATION_PROVIDER", require=False).name, "deepseek")
            with self.assertRaises(HTTPException) as error:
                provider_for("STUDYGRAPH_GENERATION_PROVIDER", require=True)
            self.assertEqual(error.exception.status_code, 503)

    def test_unknown_provider_is_rejected(self):
        with patch.dict(os.environ, {"STUDYGRAPH_LLM_PROVIDER": "openai"}, clear=True):
            with self.assertRaises(HTTPException) as error:
                provider_for("STUDYGRAPH_GENERATION_PROVIDER")
            self.assertEqual(error.exception.status_code, 503)

    def test_unreachable_tacc_fails_the_switch_fast(self):
        with patch.dict(os.environ, {
            "STUDYGRAPH_LLM_PROVIDER": "deepseek",
            "QWEN_BASE_URL": "http://127.0.0.1:9/v1",
        }):
            started = time.monotonic()
            with self.assertRaises(HTTPException) as error:
                set_runtime_provider("tacc")
            self.assertEqual(error.exception.status_code, 503)
            self.assertLess(time.monotonic() - started, 5)
            self.assertEqual(active_provider(), "deepseek")


if __name__ == "__main__":
    unittest.main()
