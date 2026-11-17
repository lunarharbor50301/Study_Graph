"""Compare V1 single-pass retrieval and pi on the same document questions."""
import argparse
import json
from collections import defaultdict
from pathlib import Path
from statistics import median
from time import perf_counter
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from uuid import uuid4


def run_turn(base_url, document_id, session, question, system, context, page):
    body = {"session_id": session, "document_id": document_id, "question": question}
    if system == "agent":
        body.update(context=context, page=page)
    path = "/api/agent/stream" if system == "agent" else "/api/ask"
    request = Request(base_url.rstrip("/") + path, data=json.dumps(body).encode(),
                      headers={"Content-Type": "application/json"})
    started = perf_counter()
    first_text_ms = None
    final = None
    events = []
    try:
        with urlopen(request, timeout=200) as response:
            if system == "baseline":
                final = json.load(response)
            else:
                for line in response:
                    if not line.strip():
                        continue
                    event = json.loads(line)
                    kind = event["type"]
                    if kind == "delta" and first_text_ms is None:
                        first_text_ms = round((perf_counter() - started) * 1000, 2)
                    if kind != "delta":
                        events.append(event)
                    if kind == "error":
                        raise ValueError(event["message"])
                    if kind == "done":
                        final = event
                        break
                if final is None:
                    raise ValueError("Agent stream ended without a completed answer")
        return {"status": "complete", "result": final, "events": events,
                "first_text_ms": first_text_ms, "client_total_ms": round((perf_counter() - started) * 1000, 2)}
    except (HTTPError, URLError, TimeoutError, OSError, ValueError) as exc:
        return {"status": "error", "error": str(exc), "events": events,
                "first_text_ms": first_text_ms, "client_total_ms": round((perf_counter() - started) * 1000, 2)}


def evidence_coverage(citations, case, document_id):
    # A group represents alternative pages supporting one required answer point.
    # Covering all groups still needs a human check of what those citations support.
    pages = sorted({c["page"] for c in citations if c["document_id"] == document_id})
    groups = case.get("evidence_groups")
    return {"pages": pages,
            "required_evidence_covered": all(set(group).intersection(pages) for group in groups) if groups else None,
            "legacy_reference_page_hit": bool(set(case.get("pages", [])).intersection(pages)) if case.get("pages") else None}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    parser.add_argument("document_id")
    parser.add_argument("cases", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--systems", nargs="+", choices=["baseline", "agent"], default=["baseline", "agent"])
    parser.add_argument("--agent-candidate-url", help="Also evaluate an Agent running on a second backend")
    parser.add_argument("--repeats", type=int, default=1)
    args = parser.parse_args()
    if args.repeats < 1:
        parser.error("--repeats must be positive")
    targets = [(system, args.base_url, system) for system in args.systems]
    if args.agent_candidate_url:
        targets.append(("agent-candidate", args.agent_candidate_url, "agent"))
    cases = json.loads(args.cases.read_text(encoding="utf-8-sig"))
    run_id = str(uuid4())
    durations = defaultdict(list)
    failures = defaultdict(int)
    # Exclusive creation prevents accidentally overwriting a previous experiment.
    with args.output.open("x", encoding="utf-8") as output:
        for repeat in range(args.repeats):
            for index, case in enumerate(cases):
                # Alternate order so one system is not always tested first.
                ordered_targets = targets if (repeat + index) % 2 == 0 else reversed(targets)
                turns = case.get("turns", [case])
                for system, base_url, mode in ordered_targets:
                    session = str(uuid4())
                    for number, turn in enumerate(turns, 1):
                        result = run_turn(base_url, args.document_id, session, turn["question"], mode,
                                          turn.get("context", case.get("context", "")), turn.get("page", case.get("page")))
                        record = {"run_id": run_id, "case_id": case.get("id", index + 1),
                                  "kind": case.get("kind", "unspecified"), "repeat": repeat + 1,
                                  "system": system, "session_id": session, "turn": number,
                                  "question": turn["question"], "document_id": args.document_id,
                                  "base_url": base_url, "reference": turn, **result}
                        if result["status"] == "complete":
                            record.update(evidence_coverage(result["result"]["citations"], turn, args.document_id))
                            record["review"] = {"answer_complete": None, "citations_supported": None,
                                                "appropriate_abstention": None, "notes": ""}
                            durations[system].append(result["client_total_ms"])
                        else:
                            failures[system] += 1
                        output.write(json.dumps(record, ensure_ascii=False) + "\n")
                        output.flush()
                        if result["status"] == "error":
                            # Subsequent turns would lack the intended conversation context.
                            break
    for system, _, _ in targets:
        values = durations[system]
        print(json.dumps({"system": system, "successful_turns": len(values), "failed_turns": failures[system],
                          "median_ms": median(values) if values else None, "max_ms": max(values) if values else None}))


if __name__ == "__main__":
    main()
