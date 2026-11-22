"""Offline checks for evaluation provider routing and result attribution."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch, Mock
from evaluation.runners.provider import resolve_provider
from evaluation.runners.grading_feedback import run
from evaluation.runners.quiz.__main__ import grade_slot


class ProviderTests(unittest.TestCase):
    def test_tacc_without_deepseek_key(self):
        with patch.dict(os.environ, {'QWEN_BASE_URL': 'http://127.0.0.1:18024/v1'}, clear=True):
            p = resolve_provider('tacc')
            self.assertEqual(p.metadata(), {'provider': 'tacc', 'model': 'qwen3.8-27b'})
            from backend.qwen_client import chat_request
            body = json.loads(chat_request([], p.endpoint, 600, 0).data)
            self.assertEqual(body['model'], p.model)
            self.assertFalse(body['chat_template_kwargs']['enable_thinking'])

    def test_missing_configuration(self):
        with patch.dict(os.environ, {}, clear=True):
            for name in ('deepseek', 'tacc', 'unknown'):
                with self.assertRaises(ValueError):
                    resolve_provider(name)

    def test_feedback_routes_to_selected_provider(self):
        answer = {'points': {'P1': 2, 'P2': 2}, 'errors': [], 'missing': [], 'feedback': 'Correct.'}
        p = Mock(name='provider')
        p.metadata.return_value = {'provider': 'tacc', 'model': 'qwen3.8-27b'}
        p.endpoint = 'http://localhost:18024/v1'
        p.chat.return_value = {'choices': [{'message': {'content': json.dumps(answer)}}]}
        with tempfile.TemporaryDirectory() as folder:
            row = run(({'id': 'test', 'question': 'Q', 'rubric': []},
                       {'variant': 'correct', 'answer': 'A'}, {}, Path(folder), p))
            self.assertEqual(row['provider'], 'tacc')
            self.assertEqual(row['prediction'], answer)
            self.assertEqual(p.chat.call_args.args[1], p.endpoint)

    def test_quiz_judge_routes_to_selected_provider(self):
        p = Mock()
        grades = {k: {'score': 1, 'reason': 'Reason'} for k in ('coverage','accuracy','evidence','answerability')}
        p.chat.return_value = {'choices': [{'message': {'content': json.dumps(grades)}}]}
        result = grade_slot({'allowed_pages': [1]}, {'result': {'citations': []},
                            'request': {'type': 'short_answer', 'difficulty': 'understanding'}},
                            {1: 'Evidence'}, 'doc', p)
        self.assertEqual(result, grades)
        self.assertEqual(p.chat.call_args.args[1], p.endpoint)


if __name__ == '__main__':
    unittest.main()
