"""Saved conversation threads, full UI history and compressed model context."""
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backend import agent_api, documents


def turn_data(number):
    return {
        "messages": [
            {"role": "user", "content": f"Question {number} about p. {number}", "timestamp": number},
            {"role": "assistant", "content": [{"type": "text", "text": f"Answer {number}"}], "timestamp": number},
        ],
        "evidence": {f"S{number}": {"document_id": "doc", "page": number, "text": f"page {number}"}},
        "answer": f"Answer {number}",
        "citations": [{"document_id": "doc", "page": number}],
        "trace": [],
    }


class ConversationStoreTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.env = patch.dict(os.environ, {
            "STUDYGRAPH_DATABASE": str(Path(self.temp.name) / "test.sqlite3"),
            "DEEPSEEK_API_KEY": "test",
        })
        self.env.start()
        self.addCleanup(self.env.stop)
        with documents.database() as db:
            db.execute("INSERT INTO docs VALUES (?,?,?,?,?)", ("doc", "Lecture", "pdf", 2, b""))
            agent_api._schema(db)

    def seed(self, count):
        with documents.database() as db:
            for number in range(1, count + 1):
                db.execute("INSERT INTO agent_turns(scope,data) VALUES (?,?)",
                           ("session:doc", json.dumps(turn_data(number))))

    def test_list_full_history_and_title(self):
        self.seed(2)
        listed = agent_api.conversations("doc")["conversations"]
        self.assertEqual(len(listed), 1)
        self.assertEqual(listed[0]["title"], "Question 1 about p. 1")
        self.assertEqual(listed[0]["turn_count"], 2)
        history = agent_api.conversation_history("session", "doc")
        self.assertEqual(history["title"], "Question 1 about p. 1")
        self.assertEqual([message["text"] for message in history["messages"]],
                         ["Question 1 about p. 1", "Answer 1", "Question 2 about p. 2", "Answer 2"])

    def test_summary_replaces_older_model_context_but_not_ui_history(self):
        self.seed(9)
        with patch.object(agent_api.deepseek_client, "chat", return_value={
            "choices": [{"message": {"content": json.dumps({"summary": "Earlier goals and decisions."})}}],
        }) as summarizer:
            agent_api.maybe_summarize("session:doc", "")
            self.assertEqual(summarizer.call_count, 1)
        context = agent_api.load_history("session:doc")
        self.assertEqual(context["summary"], "Earlier goals and decisions.")
        self.assertEqual(len(context["messages"]), 12)  # 6 recent turns
        history = agent_api.conversation_history("session", "doc")
        self.assertEqual(len(history["messages"]), 18)  # all 9 turns remain visible
        with documents.database() as db:
            row = db.execute("SELECT summary, summary_through FROM agent_conversations").fetchone()
        self.assertEqual(row["summary"], "Earlier goals and decisions.")
        self.assertEqual(row["summary_through"], 3)


if __name__ == "__main__":
    unittest.main()
