"""Run against a configured StudyGraph server and an already imported lecture."""
import argparse
import json
from pathlib import Path
from urllib.request import Request, urlopen

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    parser.add_argument("document_id")
    parser.add_argument("cases", type=Path)
    args = parser.parse_args()
    for case in json.loads(args.cases.read_text(encoding="utf-8-sig")):
        body = {"document_id": args.document_id, "session_id": "english-eval", "question": case["question"]}
        request = Request(args.base_url.rstrip("/") + "/api/ask", data=json.dumps(body).encode(),
                          headers={"Content-Type": "application/json"})
        with urlopen(request, timeout=125) as response:
            result = json.load(response)
        pages = [item["page"] for item in result["citations"]]
        matched = bool(set(pages).intersection(case["pages"])) if case["pages"] else (
            result["evidence"] == "insufficient" and not pages)
        print(json.dumps({"question": case["question"], "provider": result["provider"], "pages": pages,
                          "page_or_abstention_match": matched, "answer": result["answer"],
                          "timing_ms": result["timing_ms"]}), flush=True)
