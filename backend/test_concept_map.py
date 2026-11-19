"""Tests for staged concept-map generation."""

import json
import os
import shutil
import unittest
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

from fastapi import HTTPException

from backend import concept_map, documents


def page_text(number: int) -> str:
    return f"Page {number} explains a concept in detail. " + "content " * 40


def outline_payload(topics) -> dict:
    return {
        "title": "Test map",
        "topics": [
            {"title": title, "concepts": [{"title": name, "page": page} for name, page in concepts]}
            for title, concepts in topics
        ],
    }


class FakeModel:
    def __init__(self, outline, notes=None, gap=None):
        self.outline = outline
        self.notes = notes or self.default_notes
        self.gap = gap or (lambda payload: {"notes": []})
        self.calls = []

    @staticmethod
    def default_notes(payload):
        return {"notes": [{
            "title": item["title"],
            "page": item["page"],
            "summary": f"Summary of {item['title']}.",
            "detail": f"Detail of {item['title']}.",
            "keyPoints": ["First point", "Second point"],
            "formula": None,
            "quote": None,
        } for item in payload["concepts"]]}

    def __call__(self, messages, max_tokens, timeout, temperature=0):
        system = messages[0]["content"]
        payload = json.loads(messages[1]["content"])
        self.calls.append({"system": system, "payload": payload, "temperature": temperature})
        if system.startswith("You are planning"):
            return json.dumps(self.outline)
        if system.startswith("Write the study notes"):
            return json.dumps(self.notes(payload))
        if system.startswith("These pages"):
            return json.dumps(self.gap(payload))
        raise AssertionError(system[:60])


class StagedGuideTest(unittest.TestCase):
    def setUp(self):
        self.folder = Path(f".test-concept-map-{uuid4().hex}")
        self.folder.mkdir()
        self.config = patch.dict(os.environ, {
            "STUDYGRAPH_DATABASE": str(self.folder / "test.sqlite3"),
            "STUDYGRAPH_CONCEPT_MAP_CACHE": "0",
            "STUDYGRAPH_CONCEPT_MAP_MAX_CALLS": "18",
            "STUDYGRAPH_CONCEPT_MAP_TIMEOUT": "120",
            "STUDYGRAPH_CONCEPT_MAP_CONCURRENCY": "1",
        })
        self.config.start()
        self.addCleanup(self.config.stop)
        for name, value in {
            "BATCH_MAX_CONCEPTS": 12,
            "BATCH_CHAR_BUDGET": 6_000,
            "GAP_GROUPS": 4,
        }.items():
            patcher = patch.object(concept_map, name, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.addCleanup(shutil.rmtree, self.folder, True)

    def seed(self, pages):
        with documents.database() as db:
            db.execute("INSERT INTO docs VALUES (?,?,?,?,?)",
                       ("doc", "Test lecture", "pdf", len(pages), b""))
            for number, text in pages.items():
                db.execute("INSERT INTO pages VALUES (?,?,?,?)", ("doc", number, text, ""))

    def build(self, fake, **kwargs):
        return concept_map.build_study_guide(
            "doc", "focus on the exam", generate=fake, provider_name="test",
            model="test", cache=False, concurrency=1, **kwargs)

    def test_concepts_can_cite_multiple_evidence_pages(self):
        self.seed({number: page_text(number) for number in range(1, 4)})
        outline = {
            "title": "Test map",
            "topics": [{"title": "Topic", "concepts": [
                {"title": "Alpha", "page": 1, "pages": [1, 2]},
            ]}],
        }
        guide = self.build(FakeModel(outline))
        note = guide.topics[0].notes[0]
        self.assertEqual(note.page, 1)
        self.assertEqual(note.pages, [1, 2])
        self.assertIn(1, guide.sources)
        self.assertIn(2, guide.sources)

    def test_no_node_cap(self):
        topics = [(f"Topic {topic}", [(f"Concept {topic}-{item}", topic * 5 + item + 1)
                                      for item in range(5)]) for topic in range(6)]
        self.seed({number: page_text(number) for number in range(1, 31)})
        guide = self.build(FakeModel(outline_payload(topics)))
        self.assertEqual(len(guide.topics), 6)
        self.assertEqual(sum(len(topic.notes) for topic in guide.topics), 30)

    def test_partial_batch_failure_keeps_other_batches(self):
        topics = [(f"Topic {topic}", [(f"Concept {topic}-{item}", topic * 3 + item + 1)
                                      for item in range(3)]) for topic in range(4)]
        self.seed({number: page_text(number) for number in range(1, 13)})

        def notes(payload):
            if any(item["title"].startswith("Concept 3-") for item in payload["concepts"]):
                raise RuntimeError("batch failed")
            return FakeModel.default_notes(payload)

        guide = self.build(FakeModel(outline_payload(topics), notes=notes))
        self.assertEqual(sum(len(topic.notes) for topic in guide.topics), 9)

    def test_title_and_page_mismatches_are_dropped(self):
        topics = [("Topic", [("Alpha", 1), ("Beta", 2), ("Gamma", 3)])]
        self.seed({number: page_text(number) for number in range(1, 5)})

        def notes(payload):
            return {"notes": [
                {"title": "Wrong title", "page": 1, "summary": "s", "detail": "d",
                 "keyPoints": ["p"], "formula": None, "quote": None},
                {"title": "Beta", "page": 99, "summary": "s", "detail": "d",
                 "keyPoints": ["p"], "formula": None, "quote": None},
                {"title": "Gamma", "page": 3, "summary": "s", "detail": "d",
                 "keyPoints": ["p"], "formula": None, "quote": None},
            ]}

        guide = self.build(FakeModel(outline_payload(topics), notes=notes))
        self.assertEqual([note.title for topic in guide.topics for note in topic.notes], ["Gamma"])

    def test_quote_must_come_from_the_page(self):
        raw = {"title": "Alpha", "page": 1, "summary": "s", "detail": "d",
               "keyPoints": ["p"], "formula": None, "quote": "Page 1 explains"}
        accepted = concept_map._note_fields(raw, page_text(1))
        rejected = concept_map._note_fields({**raw, "quote": "not on this page"}, page_text(1))
        self.assertEqual(accepted.quote, "Page 1 explains")
        self.assertIsNone(rejected.quote)

    def test_invalid_json_is_retried_once(self):
        topics = [("Topic", [("Alpha", 1)])]
        self.seed({1: page_text(1)})
        attempts = {"notes": 0}

        def notes(payload):
            attempts["notes"] += 1
            if attempts["notes"] == 1:
                return "not json"
            return FakeModel.default_notes(payload)

        guide = self.build(FakeModel(outline_payload(topics), notes=notes))
        self.assertEqual(sum(len(topic.notes) for topic in guide.topics), 1)
        self.assertEqual(attempts["notes"], 2)

    def test_need_pages_reads_one_extra_round(self):
        topics = [("Topic", [("Alpha", 1)])]
        pages = {number: page_text(number) for number in range(1, 7)}
        pages[7] = "Appendix map only."
        self.seed(pages)
        gap_calls = []

        def gap(payload):
            gap_calls.append(sorted(payload["pages"]))
            if len(gap_calls) == 1:
                return {"need_pages": [7]}
            return {"notes": [{
                "topic": "Topic", "title": "Appendix", "page": 7,
                "summary": "s", "detail": "d", "keyPoints": ["p"],
                "formula": None, "quote": "Appendix map only.",
            }]}

        guide = self.build(FakeModel(outline_payload(topics), gap=gap))
        self.assertEqual([(note.title, note.page) for topic in guide.topics for note in topic.notes],
                         [("Alpha", 1), ("Appendix", 7)])
        self.assertEqual(len(gap_calls), 2)
        self.assertIn("7", gap_calls[1])

    def test_cache_hit_skips_generation(self):
        topics = [("Topic", [("Alpha", 1)])]
        self.seed({1: page_text(1)})
        fake = FakeModel(outline_payload(topics))
        first = concept_map.build_study_guide(
            "doc", "focus", generate=fake, provider_name="test", model="test",
            cache=True, concurrency=1)
        calls = len(fake.calls)
        second = concept_map.build_study_guide(
            "doc", "focus", generate=fake, provider_name="test", model="test",
            cache=True, concurrency=1)
        self.assertEqual(first.model_dump(), second.model_dump())
        self.assertEqual(len(fake.calls), calls)
        concept_map.build_study_guide(
            "doc", "focus", generate=fake, provider_name="test", model="test",
            cache=False, concurrency=1)
        self.assertGreater(len(fake.calls), calls)

    def test_call_budget_returns_partial_map(self):
        topics = [(f"Topic {topic}", [(f"Concept {topic}-{item}", topic * 3 + item + 1)
                                      for item in range(3)]) for topic in range(4)]
        self.seed({number: page_text(number) for number in range(1, 13)})
        fake = FakeModel(outline_payload(topics))
        guide = self.build(fake, max_calls=2)
        self.assertEqual(sum(len(topic.notes) for topic in guide.topics), 9)
        self.assertEqual(len(fake.calls), 2)

    def test_zero_notes_is_an_error(self):
        topics = [("Topic", [("Alpha", 1)])]
        self.seed({1: page_text(1)})
        fake = FakeModel(outline_payload(topics), notes=lambda payload: {"notes": []})
        with self.assertRaises(HTTPException) as error:
            self.build(fake)
        self.assertEqual(error.exception.status_code, 502)

    def test_invalid_outline_is_an_error(self):
        self.seed({1: page_text(1)})
        fake = FakeModel({"title": "Map", "topics": [
            {"title": "Topic", "concepts": [{"title": "Alpha", "page": 99}]}
        ]})
        with self.assertRaises(HTTPException) as error:
            self.build(fake)
        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(len(fake.calls), 2)

    def test_page_index_covers_every_page(self):
        pages = {1: page_text(1), 2: "", 3: page_text(3)}
        index = concept_map._page_index(pages)
        self.assertEqual(len(index), 3)
        self.assertIn("[no text]", index[1])
        self.assertTrue(index[0].startswith("1 "))

    def test_batches_split_topics_before_twelve_concepts(self):
        topics = [(f"Topic {topic}", [(f"Concept {topic}-{item}", topic * 5 + item + 1)
                                      for item in range(5)]) for topic in range(3)]
        pages = {number: page_text(number) for number in range(1, 16)}
        outline = concept_map.Outline.model_validate({
            "title": "Map",
            "topics": [{"title": title, "concepts": [{"title": name, "page": page}
                                                     for name, page in concepts]}
                       for title, concepts in topics],
        })
        batches = concept_map._make_batches(outline, pages)
        self.assertGreater(len(batches), 1)
        self.assertTrue(all(len(batch.concepts) <= 12 for batch in batches))

    def test_truncated_gap_groups_mark_incomplete(self):
        self.seed({number: "content " * 150 for number in range(1, 31)})
        fake = FakeModel(outline_payload([("Topic", [("Alpha", 1)])]))
        guide, metrics = concept_map._generate_guide("doc", "focus", fake, "test", 1, 18)
        self.assertEqual(sum(len(topic.notes) for topic in guide.topics), 1)
        self.assertTrue(metrics["gap_incomplete"])
        self.assertTrue(metrics["incomplete"])
