import io
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pymupdf
from fastapi import UploadFile
from pptx import Presentation
from pptx.util import Inches

from backend import documents as api


class DocumentFlow(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        config = patch.dict(os.environ, {"STUDYGRAPH_DATABASE": str(Path(temp.name) / "db.sqlite3")})
        config.start()
        self.addCleanup(config.stop)

    def test_blank_page_and_duplicate_pdf(self):
        with pymupdf.open() as pdf:
            pdf.new_page()
            pdf.new_page().insert_text((20, 40), "Retrieval systems")
            data = pdf.tobytes()
        def upload():
            return api.upload(UploadFile(io.BytesIO(data), filename="example.pdf"))
        doc = upload()
        self.assertEqual(doc["pages_without_text"], [1])
        self.assertEqual(upload()["document_id"], doc["document_id"])
        hits = api.search(doc["document_id"], api.Search(query="retrieval"))
        self.assertEqual([h["page"] for h in hits], [2])
        self.assertTrue(api.preview(doc["document_id"], 2).body.startswith(b"\x89PNG"))

    def test_slide_page_numbers_and_original(self):
        slides = Presentation()
        slides.slides.add_slide(slides.slide_layouts[6])
        slide = slides.slides.add_slide(slides.slide_layouts[6])
        slide.shapes.add_textbox(0, 0, Inches(4), Inches(1)).text = "向量检索"
        stream = io.BytesIO()
        slides.save(stream)
        data = stream.getvalue()
        doc = api.upload(UploadFile(io.BytesIO(data), filename="example.pptx"))
        self.assertEqual(api.original(doc["document_id"]).body, data)
        hit = api.search(doc["document_id"], api.Search(query="检索"))[0]
        self.assertEqual(hit["page"], 2)
        self.assertEqual(api.page(doc["document_id"], 2)["chunks"][0]["chunk_id"], hit["chunk_id"])
