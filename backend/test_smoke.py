import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import main


class ExampleFlow(unittest.TestCase):
    def test_citation_and_retry(self):
        result = main.ask(main.Question(session_id="demo", concept_id="bandwidth", question="解释这个概念"))
        self.assertEqual(result["citations"][0]["page"], 2)
        with tempfile.TemporaryDirectory() as temp, patch.object(main, "ROOT", Path(temp)):
            (Path(temp) / "backend").mkdir()
            first = main.attempt(main.Attempt(session_id="demo", answer="50"))
            second = main.attempt(main.Attempt(session_id="demo", answer="100"))
            self.assertFalse(first["correct"])
            self.assertTrue(second["correct"])
            self.assertEqual(second["attempt_number"], 2)
            self.assertNotEqual(first["attempt_id"], second["attempt_id"])
