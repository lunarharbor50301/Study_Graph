"""Run from the repository root: python -m evaluation.retrieval PDF CASES.csv"""
import argparse
import csv
import os
import tempfile
from pathlib import Path
from statistics import median
from time import perf_counter

from fastapi import UploadFile
from backend import documents


def evaluate(pdf, cases):
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["STUDYGRAPH_DATABASE"] = str(Path(tmp) / "benchmark.sqlite3")
        with pdf.open("rb") as source:
            doc = documents.upload(UploadFile(source, filename=pdf.name))
        with cases.open(encoding="utf-8-sig", newline="") as source:
            rows = list(csv.DictReader(source))
        ranks, times = [], []
        for row in rows:
            start = perf_counter()
            hits = documents.search(doc["document_id"], documents.Search(query=row["en"]))
            times.append((perf_counter() - start) * 1000)
            rank = next((i for i,h in enumerate(hits, 1) if h["page"] == int(row["page"])), 0)
            ranks.append(rank)
            print(f"en reference={row['page']} rank={rank or 'miss'} pages={[h['page'] for h in hits]}")
        print(f"en: top1={ranks.count(1)}/{len(rows)} top4={sum(bool(r) for r in ranks)}/{len(rows)} median_ms={median(times):.2f}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("cases", type=Path)
    args = parser.parse_args()
    evaluate(args.pdf, args.cases)
