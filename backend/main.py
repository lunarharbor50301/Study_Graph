"""StudyGraph's offline reference API. Run from the repository root."""
import json
import sqlite3
from contextlib import closing
from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[1]
lecture = json.loads((ROOT / "examples/roofline.json").read_text(encoding="utf-8"))
concepts = {c["id"]: c for c in lecture["concepts"]}
app = FastAPI(title="StudyGraph", version="0.1.0")


class Question(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    question: str = Field(min_length=1, max_length=2000)
    concept_id: str | None = None


class Attempt(BaseModel):
    session_id: str = Field(min_length=1, max_length=100)
    answer: str = Field(min_length=1, max_length=200)


@app.get("/api/lecture")
def get_lecture():
    return lecture


@app.post("/api/ask")
def ask(body: Question):
    if body.concept_id and body.concept_id not in concepts:
        raise HTTPException(404, "概念不存在")
    hits = [c for c in concepts.values() if any(k.lower() in body.question.lower() for k in c["keywords"])]
    if body.concept_id and body.question.strip() in {"解释这个概念", "举个例子"}:
        hits = [concepts[body.concept_id]]
    if not hits:
        return {"answer": "这份样例讲义里没有足够证据。", "evidence": "insufficient", "citations": []}
    c = next((c for c in hits if c["id"] == body.concept_id), hits[0])
    return {"answer": c["text"], "evidence": "lecture", "citations": [
        {"document_id": lecture["document_id"], "chunk_id": c["chunk_id"], "page": c["page"]}]}


@app.get("/api/exercises/bw-01")
def exercise():
    return {"exercise_id": "bw-01", "concept_id": "bandwidth",
            "prompt": "内存带宽为 50 GB/s，计算强度为 2 FLOP/byte。带宽给出的性能上限是多少 GFLOP/s？请填写数字。"}


@app.post("/api/exercises/bw-01/attempts")
def attempt(body: Attempt):
    try:
        correct = float(body.answer.strip()) == 100
    except ValueError:
        correct = False
    attempt_id = str(uuid4())
    feedback = "正确，50 × 2 = 100 GFLOP/s。" if correct else "提示：用带宽乘以计算强度，再试一次。"
    with closing(sqlite3.connect(ROOT / "backend/practice.sqlite3")) as db, db:
        db.execute("CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, session TEXT, exercise TEXT, answer TEXT, correct INTEGER, feedback TEXT)")
        db.execute("INSERT INTO attempts VALUES (?, ?, ?, ?, ?, ?)", (attempt_id, body.session_id, "bw-01", body.answer, correct, feedback))
        count = db.execute("SELECT COUNT(*) FROM attempts WHERE session=? AND exercise=?", (body.session_id, "bw-01")).fetchone()[0]
    return {"attempt_id": attempt_id, "attempt_number": count, "correct": correct, "feedback": feedback}


if (ROOT / "frontend/dist").is_dir():
    app.mount("/", StaticFiles(directory=ROOT / "frontend/dist", html=True), name="workspace")
