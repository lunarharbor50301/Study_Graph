import asyncio
import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from backend import deepseek_client, documents
from backend.demo_users import demo_user
from backend.qwen_client import normalize_base_url

router = APIRouter(prefix="/api/agent")
logger = logging.getLogger(__name__)

RECENT_TURNS = 6
SUMMARY_TRIGGER_TURNS = 8
SUMMARY_MAX_CHARS = 6000
CONTEXT_MAX_CHARS = 80_000
SUMMARY_MAX_TOKENS = 700


def _now():
    return datetime.now(timezone.utc).isoformat()


def _schema(db):
    db.execute("CREATE TABLE IF NOT EXISTS agent_turns (id INTEGER PRIMARY KEY, scope TEXT, data TEXT)")
    db.execute(
        "CREATE TABLE IF NOT EXISTS agent_conversations ("
        "session_id TEXT NOT NULL, document_id TEXT NOT NULL, title TEXT NOT NULL, "
        "created_at TEXT NOT NULL, updated_at TEXT NOT NULL, summary TEXT NOT NULL DEFAULT '', "
        "summary_through INTEGER NOT NULL DEFAULT 0, turn_count INTEGER NOT NULL DEFAULT 0, "
        "PRIMARY KEY(session_id, document_id))"
    )


def _first_user_text(messages):
    for message in messages:
        if message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            text = content
        else:
            text = "".join(block.get("text", "") for block in content or [] if block.get("type") == "text")
        text = " ".join(text.split())
        if text:
            return text[:80]
    return "New conversation"


def _ensure_conversation(db, session_id, document_id):
    row = db.execute(
        "SELECT * FROM agent_conversations WHERE session_id=? AND document_id=?",
        (session_id, document_id),
    ).fetchone()
    if row:
        return row
    scope = session_id + ":" + document_id
    first = db.execute("SELECT data FROM agent_turns WHERE scope=? ORDER BY id LIMIT 1", (scope,)).fetchone()
    count = db.execute("SELECT COUNT(*) FROM agent_turns WHERE scope=?", (scope,)).fetchone()[0]
    created = _now()
    title = "New conversation"
    if first:
        try:
            title = _first_user_text(json.loads(first["data"]).get("messages", []))
        except (ValueError, TypeError):
            pass
    db.execute(
        "INSERT INTO agent_conversations(session_id, document_id, title, created_at, updated_at, turn_count) "
        "VALUES (?,?,?,?,?,?)",
        (session_id, document_id, title, created, created, count),
    )
    return db.execute(
        "SELECT * FROM agent_conversations WHERE session_id=? AND document_id=?",
        (session_id, document_id),
    ).fetchone()


def _backfill_conversations(db, document_id=None):
    query = "SELECT DISTINCT scope FROM agent_turns"
    params = ()
    if document_id:
        query += " WHERE scope LIKE ?"
        params = ("%:" + document_id,)
    for row in db.execute(query, params).fetchall():
        session_id, _, document = row["scope"].partition(":")
        if session_id and document:
            _ensure_conversation(db, session_id, document)


def load_history(key):
    session_id, _, document_id = key.partition(":")
    with documents.database() as db:
        _schema(db)
        _ensure_conversation(db, session_id, document_id)
        conversation = db.execute(
            "SELECT summary, summary_through FROM agent_conversations WHERE session_id=? AND document_id=?",
            (session_id, document_id),
        ).fetchone()
        rows = db.execute("SELECT id, data FROM agent_turns WHERE scope=? ORDER BY id", (key,)).fetchall()
    summary = conversation["summary"] if conversation else ""
    through = conversation["summary_through"] if conversation else 0
    selected = [row for row in rows if row["id"] > through]
    if not summary:
        selected = selected[-RECENT_TURNS:]
    messages, evidence = [], {}
    size = 0
    chosen = []
    for row in reversed(selected):
        size += len(row["data"])
        if size > CONTEXT_MAX_CHARS and len(chosen) >= 2:
            break
        chosen.append(row)
    for row in reversed(chosen):
        turn = json.loads(row["data"])
        messages.extend(turn["messages"])
        evidence.update(turn["evidence"])
    return {"messages": messages, "evidence": evidence, "summary": summary}


def _summary_transcript(rows):
    chunks = []
    for row in rows:
        turn = json.loads(row["data"])
        question = _first_user_text(turn.get("messages", []))
        answer = " ".join((turn.get("answer") or "").split())
        if question or answer:
            chunks.append(f"Student: {question}\nTutor: {answer[:1200]}")
    return "\n\n".join(chunks)


def maybe_summarize(key, previous_summary):
    if not os.getenv("DEEPSEEK_API_KEY", "").strip():
        return
    session_id, _, document_id = key.partition(":")
    with documents.database() as db:
        _schema(db)
        _ensure_conversation(db, session_id, document_id)
        rows = db.execute("SELECT id, data FROM agent_turns WHERE scope=? ORDER BY id", (key,)).fetchall()
        if len(rows) <= SUMMARY_TRIGGER_TURNS:
            return
        cutoff_id = rows[-RECENT_TURNS - 1]["id"]
        old = db.execute(
            "SELECT summary_through FROM agent_conversations WHERE session_id=? AND document_id=?",
            (session_id, document_id),
        ).fetchone()
        if old and cutoff_id <= old["summary_through"]:
            return
        through = old["summary_through"] if old else 0
        older = [row for row in rows if through < row["id"] <= cutoff_id]
    transcript = _summary_transcript(older)
    if not transcript.strip():
        return
    try:
        response = deepseek_client.chat([
            {"role": "system", "content": (
                "Compress an earlier tutoring conversation into a compact context summary. "
                "Preserve the student's goals, questions, misconceptions, decisions, unresolved follow-ups, "
                "and lecture page numbers or source IDs cited. Do not add facts. Keep it under 500 words. "
                "Return JSON only: {\"summary\":\"...\"}."
            )},
            {"role": "user", "content": json.dumps({
                "previous_summary": previous_summary,
                "turns": transcript,
            }, ensure_ascii=False)},
        ], os.getenv("DEEPSEEK_BASE_URL", deepseek_client.DEFAULT_BASE_URL),
            max_tokens=SUMMARY_MAX_TOKENS, temperature=0, timeout=60)
        raw = response["choices"][0]["message"]["content"].strip()
        try:
            parsed = json.loads(raw.removeprefix("```json").removesuffix("```").strip())
            summary = parsed.get("summary", "") if isinstance(parsed, dict) else raw
        except (ValueError, TypeError):
            summary = raw
        summary = summary.strip()[:SUMMARY_MAX_CHARS]
    except Exception as exc:
        logger.warning("Agent summary failed: %s", exc)
        return
    with documents.database() as db:
        db.execute(
            "UPDATE agent_conversations SET summary=?, summary_through=? WHERE session_id=? AND document_id=?",
            (summary, cutoff_id, session_id, document_id),
        )


def save_history(key, event):
    data = {"messages": event.pop("messages"), "evidence": event.pop("evidence"),
            "answer": event["answer"], "citations": event["citations"], "trace": event["trace"]}
    session_id, _, document_id = key.partition(":")
    with documents.database() as db:
        _schema(db)
        conversation = _ensure_conversation(db, session_id, document_id)
        db.execute("INSERT INTO agent_turns(scope,data) VALUES (?,?)", (key, json.dumps(data)))
        count = db.execute("SELECT COUNT(*) FROM agent_turns WHERE scope=?", (key,)).fetchone()[0]
        title = conversation["title"] if conversation["title"] != "New conversation" else _first_user_text(data["messages"])
        db.execute(
            "UPDATE agent_conversations SET title=?, updated_at=?, turn_count=? "
            "WHERE session_id=? AND document_id=?",
            (title, _now(), count, session_id, document_id),
        )
    maybe_summarize(key, conversation["summary"] if conversation else "")

locks = {}


class Turn(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    document_id: str
    question: str = Field(min_length=1, max_length=2000)
    context: str = Field(default="", max_length=2000)
    page: int | None = Field(default=None, ge=1)
    additional_document_ids: list[str] = Field(default_factory=list, max_length=4)


@router.get("/conversations")
def conversations(document_id: str | None = None):
    """List saved threads for the current lecture, newest first."""
    with documents.database() as db:
        _schema(db)
        _backfill_conversations(db, document_id)
        if document_id:
            rows = db.execute(
                "SELECT session_id, title, updated_at, turn_count FROM agent_conversations "
                "WHERE document_id=? ORDER BY updated_at DESC", (document_id,)).fetchall()
        else:
            rows = db.execute(
                "SELECT session_id, title, updated_at, turn_count FROM agent_conversations "
                "ORDER BY updated_at DESC").fetchall()
    return {"conversations": [{
        "id": row["session_id"], "title": row["title"],
        "updated_at": row["updated_at"], "turn_count": row["turn_count"],
    } for row in rows]}


@router.get("/history")
def conversation_history(session_id: str, document_id: str):
    """Return every saved turn for the thread, not just the model context window."""
    documents.document(document_id)
    key = session_id + ":" + document_id
    with documents.database() as db:
        _schema(db)
        conversation = _ensure_conversation(db, session_id, document_id)
        rows = db.execute("SELECT id,data FROM agent_turns WHERE scope=? ORDER BY id", (key,)).fetchall()
    messages = []
    for row in rows:
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
                         "citations": [{"document_id": c["document_id"], "page": c["page"]}
                                       for c in turn.get("citations", [])],
                         "trace": [f"{t['tool']} {json.dumps(t['args'])} → {t['pages']}" for t in turn.get("trace", [])]})
    return {"messages": messages, "title": conversation["title"],
            "summary": conversation["summary"] if conversation else ""}


def tool(name, args, sources):
    if name == "list_documents":
        return {"documents": list(sources.values()), "citations": []}
    if args.get("document_id") not in sources:
        raise ValueError("This lecture is outside the current workspace.")
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
    sources = {doc_id: documents.document(doc_id)
               for doc_id in dict.fromkeys([body.document_id, *body.additional_document_ids])}
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
                                result = await asyncio.to_thread(tool, event["name"], event["args"], sources)
                            except (HTTPException, ValueError, KeyError) as exc:
                                result = {"error": str(exc)}
                            proc.stdin.write((json.dumps({"id": event["id"], **result})+"\n").encode())
                            await proc.stdin.drain()
                            continue
                        if event["type"] == "done":
                            await asyncio.to_thread(save_history, key, event)
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
