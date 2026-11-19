"""Default and custom preferences must follow the same real generation path."""
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import pymupdf
from fastapi import HTTPException, UploadFile

from backend import documents, knowledge_export, study_guide


class GenerationFlow(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        env = patch.dict(os.environ, {'STUDYGRAPH_DATABASE': str(Path(tmp.name)/'test.sqlite3'),
                                      'STUDYGRAPH_CONCEPT_MAP_MODE': 'single',
                                      'DEEPSEEK_API_KEY': 'test', 'STUDYGRAPH_LLM_PROVIDER': 'deepseek'})
        env.start()
        self.addCleanup(env.stop)
        with pymupdf.open() as pdf:
            pdf.new_page().insert_text((20, 40), 'Cache memory stores frequently accessed data.')
            data = pdf.tobytes()
        self.doc = documents.upload(UploadFile(io.BytesIO(data), filename='lecture.pdf'))['document_id']
        self.guide = {'title': 'Memory', 'topics': [{'title': 'Cache', 'notes': [{
            'page': 1, 'title': 'Cache memory', 'summary': 'Stores frequently accessed data.',
            'detail': 'Cache provides fast access.', 'keyPoints': ['Fast access'], 'formula': None}]}]}

    def response(self):
        return {'choices': [{'message': {'content': json.dumps(self.guide)}}]}

    def test_omitted_empty_and_whitespace_preferences_use_default_model_path(self):
        for body in ({}, {'instructions': ''}, {'instructions': ' \n\t '}):
            with self.subTest(body=body), patch('backend.llm_provider.deepseek_client.chat', return_value=self.response()) as model:
                result = study_guide.study_guide(self.doc, study_guide.StudyRequest(**body))
                payload = json.loads(model.call_args.args[0][1]['content'])
                self.assertEqual(payload['student_preferences'], study_guide.DEFAULT_INSTRUCTIONS)
                self.assertIn('1', payload['pages'])
                self.assertEqual(result.topics[0].notes[0].page, 1)

    def test_custom_preference_preserved_and_export_records_effective_default(self):
        with patch('backend.llm_provider.deepseek_client.chat', return_value=self.response()) as model:
            study_guide.study_guide(self.doc, study_guide.StudyRequest(instructions='  Focus on caching  '))
            self.assertEqual(json.loads(model.call_args.args[0][1]['content'])['student_preferences'], 'Focus on caching')
            exported = knowledge_export.knowledge(self.doc, study_guide.StudyRequest())
            self.assertEqual(exported['generation']['instructions'], study_guide.DEFAULT_INSTRUCTIONS)
            self.assertEqual(exported['concepts'][0]['name'], 'Cache memory')

    def test_model_failure_is_reported_without_rule_based_fallback(self):
        with patch('backend.llm_provider.deepseek_client.chat', side_effect=RuntimeError('Model unavailable')):
            with self.assertRaises(HTTPException) as error:
                study_guide.study_guide(self.doc, study_guide.StudyRequest())
        self.assertEqual(error.exception.status_code, 502)
        self.assertIn('Model unavailable', error.exception.detail)

    def test_unknown_source_page_rejected(self):
        self.guide['topics'][0]['notes'][0]['page'] = 2
        with patch('backend.llm_provider.deepseek_client.chat', return_value=self.response()):
            with self.assertRaises(HTTPException) as error:
                study_guide.study_guide(self.doc, study_guide.StudyRequest())
        self.assertEqual(error.exception.status_code, 502)


if __name__ == '__main__':
    unittest.main()
