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

        with patch.dict("os.environ", QWEN_BASE_URL="test"), patch.object(
            quiz.documents, "search", side_effect=retrieve
        ), patch.object(quiz, "chat", side_effect=model):
            questions = quiz.question_set("lecture", scope)["questions"]
            self.assertEqual([q["concept"] for q in questions], ["first", "second"])
            items[1]["source"] = "first"
            with self.assertRaises(HTTPException) as error:
                quiz.question_set("lecture", scope)
            self.assertEqual(error.exception.status_code, 502)
