"""Create a manual multi-turn review or recompute metrics from a filled review."""
import argparse
import json
from pathlib import Path
from statistics import mean

from evaluation.runners.tutor_single import ROOT, read


def cases():
    return {case["id"]: case["turns"] for i in (1, 2)
            for case in read(ROOT / f"02_ai_tutor/multi_turn/lecture{i}.json")["cases"]}


def template(directory):
    dialogues = []
    for key, turns in cases().items():
        raw = read(directory / f"{key}.json")["turns"]
        rows = []
        if len(raw) != len(turns):
            raise ValueError(f"{key}: incomplete raw record")
        for i, (ref, row) in enumerate(zip(turns, raw), 1):
            if row["question"] != ref["input"]["user_message"]:
                raise ValueError(f"{key}: question mismatch at turn {i}")
            done = row["status"] == "done"
            rows.append(dict(turn=i, question=row["question"], execution_status=row["status"],
                             points=[dict(point=p, score=None if done else 0, maximum=2)
                                     for p in ref["expected"]["required_points"]],
                             context_check=dict(status="not_applicable" if i == 1 else "measured",
                                                passed=None if i == 1 or done else False),
                             substantive_error=None if done else False,
                             required_evidence_complete=None if done else False,
                             review_note=""))
        dialogues.append(dict(id=key, turns=rows))
    return dict(dialogues=dialogues)


def summarize(review):
    refs = cases()
    seen = set()
    normalized = []
    successes = completed = context_pass = context_total = 0
    for dialogue in review["dialogues"]:
        key, rows = dialogue["id"], dialogue["turns"]
        if key in seen or key not in refs or len(rows) != len(refs[key]):
            raise ValueError(f"{key}: unexpected, duplicate or incomplete dialogue")
        seen.add(key)
        strict = True
        for i, (row, ref) in enumerate(zip(rows, refs[key]), 1):
            label = f"{key} turn {i}"
            points = row["points"]
            if row["turn"] != i or row["question"] != ref["input"]["user_message"] or [
                p["point"] for p in points
            ] != ref["expected"]["required_points"]:
                raise ValueError(f"{label}: reference mismatch")
            done = row["execution_status"] == "done"
            completed += done
            if any(type(p["score"]) is not int or not 0 <= p["score"] <= 2
                   or p["maximum"] != 2 or (not done and p["score"] != 0) for p in points):
                raise ValueError(f"{label}: enter a valid score for each point")
            score = sum(p["score"] for p in points) / (2 * len(points))
            normalized.append(score)
            check = row["context_check"]
            expected_status = "measured" if i > 1 else "not_applicable"
            if check["status"] != expected_status or (i > 1 and
                    (type(check["passed"]) is not bool or (not done and check["passed"]))):
                raise ValueError(f"{label}: enter a valid context check")
            if i > 1:
                context_total += 1
                context_pass += check["passed"]
            error, evidence = row["substantive_error"], row["required_evidence_complete"]
            if type(error) is not bool or type(evidence) is not bool:
                raise ValueError(f"{label}: enter factual error and evidence decisions")
            strict &= done and score == 1 and not error and evidence and (i == 1 or check["passed"])
        successes += strict
    if seen != refs.keys():
        raise ValueError("Review must contain all reference dialogues")
    return dict(mean_turn_score=mean(normalized), completed_turns=completed,
                total_turns=len(normalized), strict_dialogues=successes, total_dialogues=len(seen),
                context_checks_passed=context_pass, context_checks_total=context_total)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--template", type=Path, metavar="RAW_RUN_DIRECTORY")
    mode.add_argument("--review", type=Path, metavar="FILLED_REVIEW_JSON")
    args = parser.parse_args()
    result = template(args.template) if args.template else summarize(read(args.review))
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
