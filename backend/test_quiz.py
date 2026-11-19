import json
import unittest
from unittest.mock import patch

from fastapi import HTTPException

from backend import quiz


class QuestionSetTest(unittest.TestCase):
    def test_citations_must_match_each_concept(self):
        scope = quiz.Scope(concepts=["first", "second", "first"])
        def retrieve(doc, body):
            return [{"chunk_id": body.query, "text": "lecture passage"}]

        items = [{"prompt": "Explain A.", "source": "first"},
                 {"prompt": "Explain B.", "source": "second"}]
        def model(*args, **kwargs):
            return {"choices": [{"message": {"content": json.dumps({"questions": items})}}]}

        with patch.dict("os.environ", {"DEEPSEEK_API_KEY": "test", "DEEPSEEK_BASE_URL": "https://example.test", "STUDYGRAPH_LLM_PROVIDER": "deepseek"}), patch.object(
            quiz.documents, "search", side_effect=retrieve
        ), patch("backend.llm_provider.deepseek_client.chat", side_effect=model):
            questions = quiz.question_set("lecture", scope)["questions"]
            self.assertEqual([q["concept"] for q in questions], ["first", "second"])
            items[1]["source"] = "first"
            with self.assertRaises(HTTPException) as error:
                quiz.question_set("lecture", scope)
            self.assertEqual(error.exception.status_code, 502)

    def test_practice_question_rejects_invalid_source_and_preserves_selected_formats(self):
        hit = {"chunk_id": "slide-1", "text": "The host CPU coordinates the GPU.", "page": 1}
        for question_type, answer, options in [
            ("multiple-choice", "CPU", ["CPU", "GPU", "Disk", "NIC"]),
            ("true-false", "false", []),
            ("short-answer", "CPU", []),
        ]:
            with self.subTest(question_type=question_type):
                scope = quiz.PracticeRequest(topic="Host", query="host CPU", type=question_type, difficulty="Mixed")
                draft = {"prompt": "Practice prompt", "hint": "Think about the host.", "explanation": hit["text"],
                         "answer": answer, "options": options, "accepted_answers": ["Host processor"]}

                def model(*args, **kwargs):
                    source = "S1" if kwargs["temperature"] else "invalid"
                    return {"choices": [{"message": {"content": json.dumps({**draft, "source": source})}}]}

                with patch.dict("os.environ", {"DEEPSEEK_API_KEY": "test", "DEEPSEEK_BASE_URL": "https://example.test", "STUDYGRAPH_LLM_PROVIDER": "deepseek"}), patch.object(
                    quiz.documents, "search", return_value=[hit]
                ), patch("backend.llm_provider.deepseek_client.chat", side_effect=model) as provider:
                    question = quiz.practice_question("lecture", scope)
                    self.assertEqual(provider.call_count, 2)
                    self.assertEqual(question["type"], question_type)
                    self.assertEqual(question["citations"], [hit])
                    self.assertEqual(question["answer"], "False" if question_type == "true-false" else answer)
                    self.assertEqual(question["options"], ["True", "False"] if question_type == "true-false" else options)
                    self.assertEqual(question["accepted_answers"], ["Host processor"] if question_type == "short-answer" else [])
