"""Exercise the real pi subprocess with a scripted OpenAI-compatible server."""
import asyncio
import io
import json
import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
import pymupdf
from fastapi import UploadFile
from backend import agent_api, documents


class PiFlow(unittest.TestCase):
    def test_search_read_followup_and_document_isolation(self):
        requests = []

        class Provider(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                if self.path.endswith("/models"):
                    body = b'{"data":[]}'
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_error(404)

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                requests.append(body)
                index = len(requests)
                if index in (1, 2, 5):
                    name, args = ("search_lecture", {"query": "Roofline"}) if index == 1 else (
                        "read_page", {"page": 2 if index == 5 else 1})
                    function = {"name": name, "arguments": json.dumps({"document_id": doc["document_id"], **args})}
                    delta = {"role": "assistant", "tool_calls": [{"index": 0, "id": f"call{index}", "type": "function", "function": function}]}
                    stop = "tool_calls"
                else:
                    answer = "Amdahl's law limits speedup (S3, p. 2). (S1, p. 9)" if index == 6 else (
                        "Bandwidth limits performance [S1, p. 1][S2, p. 1]." if index == 4 else "Bandwidth limits performance [S1, S2].")
                    delta = {"role": "assistant", "content": answer}
                    stop = "stop"
                self.send_response(200)
                self.send_header("Content-Type", "text/event-stream")
                self.end_headers()
                for change, reason in ((delta, None), ({}, stop)):
                    packet = {"id": "mock", "object": "chat.completion.chunk", "created": 0, "model": "qwen3.8-27b", "choices": [{"index": 0, "delta": change, "finish_reason": reason}]}
                    self.wfile.write(("data: " + json.dumps(packet) + "\n\n").encode())
                self.wfile.write(b"data: [DONE]\n\n")

        async def turn(question, session="one"):
            response = await agent_api.stream_turn(agent_api.Turn(session_id=session, document_id=doc["document_id"], question=question))
            return [json.loads(line) async for line in response.body_iterator]

        with tempfile.TemporaryDirectory() as tmp:
            server = ThreadingHTTPServer(("127.0.0.1", 0), Provider)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            worker.start()
            try:
                with patch.dict(os.environ, {"STUDYGRAPH_DATABASE":str(Path(tmp)/"test.sqlite3"), "QWEN_BASE_URL":f"http://127.0.0.1:{server.server_port}/v1", "STUDYGRAPH_TUTOR_PROVIDER":"tacc"}):
                    with patch.dict(os.environ):
                        os.environ.pop("TACC_SSH_TARGET", None)
                        os.environ["STUDYGRAPH_AGENT_FOLLOWUP_EVIDENCE"] = "1"
                        with pymupdf.open() as pdf:
                            pdf.new_page().insert_text((20,40), "Roofline: bandwidth limits performance.")
                            pdf.new_page().insert_text((20,40), "Amdahl's law: serial work limits speedup.")
                            doc = documents.upload(UploadFile(io.BytesIO(pdf.tobytes()), filename="lecture.pdf"))
                        first = asyncio.run(turn("Explain this lecture."))
                        self.assertEqual(first[-1]["type"], "done", first)
                        self.assertEqual(first[-1]["model_calls"], 3)
                        self.assertEqual([t["tool"] for t in first[-1]["trace"]], ["search_lecture", "read_page"])
                        self.assertEqual(first[-1]["citations"][0]["page"], 1)
                        self.assertEqual([c["source"] for c in first[-1]["citations"]], ["S1", "S2"])
                        self.assertTrue(any(event["type"] == "delta" for event in first))
                        final_request = requests[2]
                        self.assertNotIn("tools", final_request)
                        self.assertEqual([m["role"] for m in final_request["messages"]], ["system", "user"])
                        self.assertIn("Roofline: bandwidth limits performance", final_request["messages"][0]["content"])
                        restored = agent_api.conversation_history("one", doc["document_id"])["messages"]
                        self.assertEqual(restored[0]["text"], "Explain this lecture.")
                        self.assertEqual(restored[1]["pages"], [1])
                        self.assertEqual(len(restored[1]["trace"]), 2)
                        self.assertEqual(agent_api.conversation_history("fresh", doc["document_id"])["messages"], [])
                        second = asyncio.run(turn("What causes that limit?"))
                        self.assertEqual(second[-1]["type"], "done", second)
                        self.assertEqual(second[-1]["model_calls"], 1)
                        self.assertEqual(second[-1]["trace"], [])
                        self.assertEqual(second[-1]["citations"][0]["page"], 1)
                        payload = requests[3]
                        self.assertEqual([m["role"] for m in payload["messages"]], ["system", "user", "assistant", "user"])
                        self.assertIn("Roofline: bandwidth limits performance", payload["messages"][0]["content"])
                        self.assertTrue(payload["tools"])
                        self.assertEqual(len(agent_api.conversation_history("one", doc["document_id"])["messages"]), 4)
                        self.assertIn("Explain this lecture", json.dumps(requests[-1]["messages"]))
                        new_evidence = asyncio.run(turn("What limit does page 2 describe?"))
                        self.assertEqual(new_evidence[-1]["type"], "done", new_evidence)
                        self.assertEqual(new_evidence[-1]["model_calls"], 2)
                        self.assertEqual(new_evidence[-1]["trace"][0]["tool"], "read_page")
                        self.assertEqual([c["page"] for c in new_evidence[-1]["citations"]], [2])
                        self.assertEqual(requests[5]["messages"][-1]["role"], "tool")
                        third = asyncio.run(turn("New topic", "two"))
                        self.assertNotIn("Explain this lecture", json.dumps(requests[-1]["messages"]))
                        self.assertEqual(third[-1]["type"], "error")
                        with pymupdf.open() as pdf:
                            pdf.new_page().insert_text((20, 40), "Second lecture: memory hierarchy.")
                            other_doc = documents.upload(UploadFile(io.BytesIO(pdf.tobytes()), filename="second.pdf"))

                        async def change_test_question():
                            response = await agent_api.stream_turn(agent_api.Turn(
                                session_id="one", question="What did we discuss in the first lecture?",
                                document_id=other_doc["document_id"], page=1,
                                additional_document_ids=[doc["document_id"]],
                                history_document_id=doc["document_id"],
                            ))
                            return [json.loads(line) async for line in response.body_iterator]

                        switched = asyncio.run(change_test_question())
                        self.assertEqual(switched[-1]["type"], "done", switched)
                        self.assertIn("Current document: " + other_doc["document_id"], requests[-1]["messages"][0]["content"])
                        history = agent_api.conversation_history("one", doc["document_id"])["messages"]
                        self.assertEqual(history[0]["text"], "Explain this lecture.")
                        self.assertEqual(history[-2]["text"], "What did we discuss in the first lecture?")
                        self.assertEqual(agent_api.conversation_history("one", other_doc["document_id"])["messages"], [])
            finally:
                server.shutdown()
                server.server_close()
                worker.join()
