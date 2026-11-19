"""Run the paired single-turn Tutor benchmark and summarize reviewed answers."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from itertools import zip_longest
import json
from pathlib import Path
from statistics import mean, median, quantiles
import time
from urllib.request import Request, urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return json.loads(path.read_text(encoding="utf-8"))


def save(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def questions(language):
    folder = ROOT / "02_ai_tutor/single_turn"
    bank = {q["id"]: q for q in read(ROOT / "shared/question_bank.json")["questions"]}
    groups = []
    for name in ("lecture1.json", "lecture2.json"):
        ids = read(folder / name)["question_ids"]
        group = read(folder / "en" / name)["questions"] if language == "en" else [bank[i] for i in ids]
        if [q["id"] for q in group] != ids:
            raise ValueError(f"Question IDs differ in {name}")
        groups.append(group)
    return [q for pair in zip_longest(*groups) for q in pair if q is not None]


def run(args, cases):
    docs = {d["id"]: d["sha256"] for d in read(ROOT / "sources/documents.json")["documents"]}
    base = args.base_url.rstrip("/")
    with urlopen(base + "/api/documents", timeout=10) as response:
        available = {d["document_id"] for d in json.load(response)}
    if not set(docs.values()) <= available:
        raise ValueError("Upload both original lecture PDFs to the backend first.")
    args.directory.mkdir(parents=True, exist_ok=False)

    def collect(q):
        payload = {"document_id": docs[q["document_id"]], "session_id": "single-" + uuid4().hex,
                   "question": q["input"]["instruction"] + "\n" + q["input"]["question"]}
        record = {"id": q["id"], "input": payload, "events": [], "status": "error"}
        request = Request(base + "/api/agent/stream", data=json.dumps(payload).encode(),
                          headers={"Content-Type": "application/json"})
        start = time.monotonic()
        try:
            with urlopen(request, timeout=195) as response:
                for line in response:
                    event = json.loads(line)
                    if event["type"] != "text_delta":
                        record["events"].append(event)
            last = record["events"][-1]
            if last["type"] == "done" and last.get("answer", "").strip():
                record["status"] = "done"
        except Exception as exc:
            record["error"] = str(exc)
        record["elapsed_s"] = round(time.monotonic() - start, 2)
        save(args.directory / (q["id"] + ".json"), record)
        print(q["id"], record["status"], flush=True)
        return {"id": q["id"], "scores": {r["id"]: 0 if record["status"] == "error" else None
                                          for r in q["expected"]["rubric"]}, "note": ""}

    with ThreadPoolExecutor(max_workers=3) as pool:
        rows = list(pool.map(collect, cases))
    save(args.directory / "review.json", {"language": args.language, "job": args.job, "rows": rows})


def summarize(args, cases):
    rows = read(args.directory / "review.json")["rows"]
    reviews = {r["id"]: r for r in rows}
    if len(rows) != len(cases) or reviews.keys() != {q["id"] for q in cases}:
        raise ValueError("Expected one review per question.")
    grades = {}
    times = []
    citations = supported = 0
    for q in cases:
        key = q["id"]
        record = read(args.directory / (key + ".json"))
        rubric = {r["id"]: r["max_score"] for r in q["expected"]["rubric"]}
        scores = reviews[key]["scores"]
        valid = record["status"] == "done"
        if scores.keys() != rubric.keys() or any(type(v) != int or not 0 <= v <= rubric[k]
                                                 or (not valid and v != 0) for k, v in scores.items()):
            raise ValueError(f"{key}: enter a valid score for each criterion (zero on failure).")
        grades.setdefault(q["document_id"], []).append(sum(scores.values()) / sum(rubric.values()))
        if valid:
            times.append(record["elapsed_s"])
        if q["expected"]["answerability"] == "supported":
            supported += 1
            if valid and record["events"][-1].get("citations"):
                citations += 1
    means = {doc: mean(values) for doc, values in grades.items()}
    return {"language": args.language, "questions": len(cases), "completed": len(times),
            "failed": len(cases) - len(times), "lecture_scores": means, "macro_score": mean(means.values()),
            "supported_with_citations": citations, "supported": supported,
            "median_s": median(times) if times else None,
            "p95_s": quantiles(times, n=100, method="inclusive")[94] if len(times) > 1 else next(iter(times), None)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("run", "summarize"))
    parser.add_argument("language", choices=("zh", "en"))
    parser.add_argument("directory", type=Path)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--job", help="TACC job ID for provenance")
    args = parser.parse_args()
    cases = questions(args.language)
    if args.action == "run":
        run(args, cases)
    else:
        print(json.dumps(summarize(args, cases), indent=2))
