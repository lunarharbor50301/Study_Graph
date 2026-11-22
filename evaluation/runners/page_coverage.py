"""Check physical page coverage in a knowledge prediction or archived guide."""
import argparse
from collections import Counter
import json
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path)
    parser.add_argument("--pages", type=int, required=True)
    args = parser.parse_args()
    if args.pages < 1:
        parser.error("--pages must be positive")
    data = json.loads(args.artifact.read_text())
    nodes = data["concepts"] if "concepts" in data else [
        note for topic in data["topics"] for note in topic["notes"]
    ]
    counts = Counter()
    invalid = []
    for i, node in enumerate(nodes, start=1):
        if "evidence_pages" not in node:
            parser.error("Full evidence_pages required. Use the archived guide or regenerate.")
        pages = node["evidence_pages"]
        valid = {p for p in pages if type(p) is int and 1 <= p <= args.pages}
        counts.update(valid)
        if not valid or sorted(valid) != list(range(min(valid), max(valid) + 1)) or len(valid) != len(pages):
            invalid.append(node.get("id", i))
    print(json.dumps(dict(total_pages=args.pages, covered=len(counts),
                          missing=sorted(set(range(1, args.pages + 1)) - counts.keys()),
                          overlap=sorted(p for p in counts if counts[p] > 1),
                          invalid_ranges=invalid), indent=2))


if __name__ == "__main__":
    main()
