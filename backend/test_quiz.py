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

    def test_failed_evaluation_retains_both_unmodified_replies(self):
        scope = quiz.PracticeRequest(topic="Warp", query="SIMD", type="short-answer", difficulty="Advanced")
        replies = [{"choices": [{"message": {"content": text}}]} for text in ("  broken ", "{}")]
        attempts = []
        with patch.object(quiz.documents, "search", return_value=[{"text": "SIMD"}]), patch.object(
            quiz, "quiz_model", return_value=("test", "test", unittest.mock.Mock(side_effect=replies))
        ), self.assertRaises(HTTPException) as failure:
            quiz.generate_practice_question("lecture", scope, attempts=attempts)
        self.assertEqual(failure.exception.status_code, 502)
        self.assertEqual([a["raw_response"] for a in attempts], replies)
        self.assertEqual([a["status"] for a in attempts], ["invalid_response"] * 2)
        self.assertIn("Invalid JSON", attempts[0]["error"])
        self.assertIn("source", attempts[1]["error"])

    def test_overlong_answer_list_gets_targeted_retry(self):
        scope = quiz.PracticeRequest(topic="Warp", query="SIMD", type="short-answer", difficulty="Advanced")
        draft = dict(prompt="What happens to utilization?", source="S1", answer="It falls.",
                     hint="Consider inactive lanes.", explanation="Only some lanes execute.")
        def model(messages, endpoint, temperature, max_tokens):
            if temperature == 0:
                self.assertIn("at most 5", messages[0]["content"])
                count = 6
            else:
                self.assertIn("accepted_answers", messages[-1]["content"])
                self.assertIn("not 6", messages[-1]["content"])
                self.assertEqual(messages[-2]["role"], "assistant")
                count = 5
            content = json.dumps({**draft, "accepted_answers": ["variant"] * count})
            return {"choices": [{"message": {"content": content}}]}
        with patch.object(quiz.documents, "search", return_value=[{"text": "SIMD"}]), patch.object(
            quiz, "quiz_model", return_value=("test", "test", model)
        ):
            self.assertEqual(len(quiz.practice_question("lecture", scope)["accepted_answers"]), 5)
