import asyncio
import json
import os
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend import documents
from backend.demo_users import demo_user
from backend.qwen_client import normalize_base_url

router = APIRouter(prefix="/api/agent")
def load_history(key):
    with documents.database() as db:
        db.execute("CREATE TABLE IF NOT EXISTS agent_turns (id INTEGER PRIMARY KEY, scope TEXT, data TEXT)")
        rows = db.execute("SELECT data FROM agent_turns WHERE scope=? ORDER BY id DESC LIMIT 4", (key,)).fetchall()
    messages, evidence = [], {}
    size = 0
    selected = []
    for row in rows:
        size += len(row[0])
        if size > 180000:
            break
        selected.append(json.loads(row[0]))
    for turn in reversed(selected):
        messages.extend(turn["messages"])
        evidence.update(turn["evidence"])
    return {"messages": messages, "evidence": evidence}


def save_history(key, event):
    data = {"messages": event.pop("messages"), "evidence": event.pop("evidence"),
            "answer": event["answer"], "citations": event["citations"], "trace": event["trace"]}
    with documents.database() as db:
        db.execute("INSERT INTO agent_turns(scope,data) VALUES (?,?)", (key,json.dumps(data)))
        db.execute("DELETE FROM agent_turns WHERE scope=? AND id NOT IN (SELECT id FROM agent_turns WHERE scope=? ORDER BY id DESC LIMIT 4)",(key,key))

locks = {}


class Turn(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    document_id: str
    question: str = Field(min_length=1, max_length=2000)
    context: str = Field(default="", max_length=2000)
    page: int | None = Field(default=None, ge=1)


@router.get("/history")
def conversation_history(session_id: str, document_id: str):
    """Restore the same successful turns supplied to the model on its next run."""
    documents.document(document_id)
    key = session_id + ":" + document_id
    load_history(key)  # Initialize the table for an empty installation.
    with documents.database() as db:
        rows = db.execute("SELECT id,data FROM agent_turns WHERE scope=? ORDER BY id DESC LIMIT 4", (key,)).fetchall()
    messages = []
    for row in reversed(rows):
        turn = json.loads(row["data"])
        for item in turn["messages"]:
            if item["role"] != "user":
                continue
            content = item["content"]
            text = content if isinstance(content, str) else "".join(block.get("text", "") for block in content if block["type"] == "text")
            messages.append({"id": f"{row['id']}-user", "role": "user", "text": text})
        answer = turn.get("answer")
        if answer is None:  # Conversations saved before UI history was added.
            last = next((m for m in reversed(turn["messages"]) if m["role"] == "assistant"), {})
            answer = "".join(b.get("text", "") for b in last.get("content", []) if b["type"] == "text")
        messages.append({"id": f"{row['id']}-assistant", "role": "assistant", "text": answer,
                         "pages": list(dict.fromkeys(c["page"] for c in turn.get("citations", []) if c["document_id"] == document_id)),
                         "trace": [f"{t['tool']} {json.dumps(t['args'])} → {t['pages']}" for t in turn.get("trace", [])]})
    return {"messages": messages}


def tool(name, args):
    if name == "list_documents":
        return {"documents": documents.documents(), "citations": []}
    if name == "search_lecture":
        return {"citations": documents.search(args["document_id"], documents.Search(query=args["query"], top_k=3))}
    if name == "read_page":
        page = documents.page(args["document_id"], int(args["page"]))
        return {"citations": [{"document_id": page["document_id"], "page": page["page"],
            "chunk_id": f"page-{page['page']}", "text": page["text"][:16000],
            "preview_url": page["preview_url"]}]}
    raise ValueError("Unknown tool")


@router.post("/stream")
async def stream_turn(body: Turn):
    endpoint = os.getenv("QWEN_BASE_URL")
    if not endpoint:
        raise HTTPException(503, "Configure a running TACC endpoint.")
    if os.getenv("TACC_SSH_TARGET"):
        raise HTTPException(503, "Use a persistent SSH tunnel for pi streaming.")
    documents.document(body.document_id)
    node = shutil.which("node")
    if not node:
        raise HTTPException(503, "Install Node.js and run npm ci --prefix agent.")
    key = body.session_id + ":" + body.document_id
    lock = locks.setdefault((demo_user.get(), key), asyncio.Lock())
    if lock.locked():
        raise HTTPException(409, "This conversation is already answering.")
    async def events():
        proc = None
        async with lock:
            try:
                state = load_history(key)
                proc = await asyncio.create_subprocess_exec(
                    node, str(Path(__file__).resolve().parents[1] / "agent/runner.mjs"),
                    stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.DEVNULL, limit=2**22)
                proc.stdin.write((json.dumps({**body.model_dump(), **state, "endpoint": normalize_base_url(endpoint)})+"\n").encode())
                await proc.stdin.drain()
                async with asyncio.timeout(180):
                    while line := await proc.stdout.readline():
                        event = json.loads(line)
                        if event["type"] == "tool_request":
                            try:
                                result = await asyncio.to_thread(tool, event["name"], event["args"])
                            except (HTTPException, ValueError, KeyError) as exc:
                                result = {"error": str(exc)}
                            proc.stdin.write((json.dumps({"id": event["id"], **result})+"\n").encode())
                            await proc.stdin.drain()
                            continue
                        if event["type"] == "done":
                            save_history(key, event)
                        yield json.dumps(event, ensure_ascii=False)+"\n"
                        if event["type"] in {"done", "error"}:
                            return
                    yield json.dumps({"type":"error","message":"pi exited before completing its answer."})+"\n"
            except (OSError, TimeoutError, ValueError) as exc:
                yield json.dumps({"type":"error","message":str(exc) or "Agent timed out."})+"\n"
            finally:
                if proc and proc.returncode is None:
                    proc.kill()
                    await proc.wait()
    return StreamingResponse(events(), media_type="application/x-ndjson", headers={"Cache-Control":"no-cache"})
