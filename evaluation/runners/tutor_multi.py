"""Run six ordered AI tutor dialogues; one server-side session per dialogue."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import http.client
import json
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from uuid import uuid4
from evaluation.runners.tutor_single import ROOT, read, save
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--base-url", required=True)
    parser.add_argument("--job", required=True)
    args = parser.parse_args()
    docs = {d["id"]: d["sha256"] for d in read(ROOT/"sources/documents.json")["documents"]}
    args.directory.mkdir(parents=True, exist_ok=False)

    def run(item):
        doc, case = item
        session = "multi-" + uuid4().hex
        record = dict(id=case["id"], document_id=doc, session=session, job=args.job, turns=[])
        for turn in case["turns"]:
            payload = dict(document_id=docs[doc], session_id=session, question=turn["input"]["user_message"])
            row = dict(question=payload["question"], status="error")
            if record["turns"] and record["turns"][-1]["status"] != "done":
                record["turns"].append(dict(question=payload["question"], status="skipped",
                                            error="An earlier turn failed."))
                save(args.directory / (case["id"] + ".json"), record)
                continue
            start = time.monotonic()
            for attempt in range(3):
                try:
                    req = Request(args.base_url + "/api/agent/stream", data=json.dumps(payload).encode(),
                                  headers={"Content-Type": "application/json"})
                    with urlopen(req, timeout=200) as resp:
                        for line in resp:
                            event = json.loads(line)
                            if event["type"] == "done" and event.get("answer", "").strip():
                                row.update(status="done", answer=event["answer"], citations=event.get("citations", []))
                            elif event["type"] == "error":
                                row["error"] = event.get("message", "agent error")
                except HTTPError as exc:
                    with exc:
                        detail = exc.read(4096).decode("utf-8", errors="replace")
                    row.setdefault("http_errors", []).append({"status": exc.code, "body": detail})
                    if exc.code == 503 and attempt < 2:
                        time.sleep(6 * (attempt + 1))
                        continue
                    row["error"] = f"HTTP {exc.code}: {detail}"
                except (OSError, ValueError, http.client.HTTPException) as exc:
                    row["error"] = str(exc)
                break
            if row["status"] == "error":
                row.setdefault("error", "Stream ended without a completed answer.")
            row["elapsed_s"] = round(time.monotonic()-start, 2)
            record["turns"].append(row)
            save(args.directory/(case["id"]+".json"), record)
            print(case["id"], turn["turn"], row["status"], flush=True)
    cases = [(f"ACS-L{i}", c) for i in (1,2)
             for c in read(ROOT/f"02_ai_tutor/multi_turn/lecture{i}.json")["cases"]]
    with ThreadPoolExecutor(max_workers=1) as pool:
        list(pool.map(run, cases))


if __name__ == "__main__":
    main()
