"""Replay saved quiz evaluation slots, retaining every provider reply and validation error."""
import argparse
import json
import time
from pathlib import Path

from fastapi import HTTPException

from backend.quiz import PracticeRequest, generate_practice_question


def generate_record(record, doc):
    slots = []
    for saved in record["slots"]:
        request = PracticeRequest.model_validate(saved["request"])
        slot = {"seed_page": saved["seed_page"], "request": request.model_dump(), "attempts": []}
        start = time.monotonic()
        try:
            slot["result"] = generate_practice_question(doc, request, attempts=slot["attempts"])
        except HTTPException as exc:
            slot["error"] = f"{exc.status_code}: {exc.detail}"
        slot["elapsed_s"] = round(time.monotonic() - start, 2)
        slots.append(slot)
    return {"input": record["input"], "slots": slots}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("records", nargs="+", type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--provider", choices=["deepseek", "tacc"], help="Override generation provider")
    args = parser.parse_args()
    if args.provider:
        import os
        from evaluation.runners.provider import resolve_provider
        from backend.llm_provider import reset_runtime_provider
        resolve_provider(args.provider)
        reset_runtime_provider()
        os.environ["STUDYGRAPH_GENERATION_PROVIDER"] = args.provider
    manifest = Path(__file__).resolve().parents[2] / "sources/documents.json"
    docs = {row["id"]: row["sha256"] for row in json.loads(manifest.read_text())["documents"]}
    args.output_dir.mkdir(parents=True, exist_ok=True)
    for path in args.records:
        record = json.loads(path.read_text())
        doc = docs[record["input"]["document_id"]]
        dest = args.output_dir / path.name
        with dest.open("x", encoding="utf-8") as output:
            json.dump(generate_record(record, doc), output, ensure_ascii=False, indent=2)
            output.write("\n")
        print(dest)


if __name__ == "__main__":
    main()
