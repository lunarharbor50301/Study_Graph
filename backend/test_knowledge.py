"""Regression checks for export isolation and honest evaluation denominators."""
import unittest
from unittest.mock import patch
from backend.knowledge_export import knowledge
from backend.study_guide import StudyRequest
from backend.study_guide import StudyGuide
from evaluation.runners.knowledge import evaluate, template


def fixture():
    ref = {'document_id': 'ACS-L1', 'concepts': [
        {'id': 'a', 'importance': 'core'}, {'id': 'b', 'importance': 'core'}],
        'relations': [], 'study_notes': [
            {'id': 'N-a', 'required_points': [{'id': 'p', 'max_score': 2}]}]}
    pred = {'document_id': 'ACS-L1', 'concepts': [{'id': 'x'}, {'id': 'y'}],
            'relations': [], 'study_notes': []}
    review = template(ref, pred)
    review.update(reviewer='tester', review_date='2026-11-18')
    review['concepts'][0].update(correct=True, matches=['a'], reason='Equivalent')
    review['concepts'][1].update(correct=True, matches=[], reason='Valid extra concept')
    review['study_notes'][0]['points'][0].update(score=1, prediction_ids=['x'], reason='Partial')
    return ref, pred, review


class KnowledgeTests(unittest.TestCase):
    def test_valid_extras_and_fixed_recall(self):
        result = evaluate(*fixture())
        self.assertEqual(result['concepts']['precision']['value'], 1)
        self.assertEqual(result['concepts']['core_recall']['value'], .5)
        self.assertEqual(result['study_notes']['mean_point_score']['value'], .5)

    def test_missing_output(self):
        ref, pred, _ = fixture()
        pred['concepts'] = []
        review = template(ref, pred)
        review.update(reviewer='tester', review_date='today')
        review['study_notes'][0]['points'][0].update(score=0, reason='Missing')
        result = evaluate(ref, pred, review)
        self.assertIsNone(result['concepts']['precision']['value'])
        self.assertEqual(result['concepts']['core_recall']['value'], 0)
        self.assertEqual(result['study_notes']['mean_point_score']['value'], 0)

    def test_pending_or_stale_review_rejected(self):
        ref, pred, review = fixture()
        review['concepts'][0]['correct'] = None
        with self.assertRaises(ValueError):
            evaluate(ref, pred, review)
        ref, pred, review = fixture()
        pred['concepts'].append({'id': 'z'})
        with self.assertRaises(ValueError):
            evaluate(ref, pred, review)

    def test_duplicates_not_in_denominator(self):
        ref, pred, review = fixture()
        review['concepts'][1].update(duplicate_of='x')
        result = evaluate(ref, pred, review)
        self.assertEqual(result['concepts']['precision']['denominator'], 1)

    def test_invalid_support_rejected(self):
        ref, pred, review = fixture()
        review['study_notes'][0]['points'][0]['prediction_ids'] = []
        with self.assertRaises(ValueError):
            evaluate(ref, pred, review)

    def test_backend_uses_existing_generator_without_gold(self):
        guide = StudyGuide(title='Lecture', topics=[{'title': 'Memory', 'notes': [
            {'page': 2, 'title': 'Cache', 'summary': 'Summary', 'detail': 'Details',
             'keyPoints': ['Point'], 'formula': None}]}])
        with patch('backend.knowledge_export.study_guide.study_guide', return_value=guide) as generate, \
             patch('backend.knowledge_export.documents.page', return_value={'text': 'Actual page text'}):
            data = knowledge('doc1', StudyRequest(instructions='Cover lecture'))
        self.assertEqual(data['relations'], [])
        self.assertEqual(data['concepts'][0]['facts'], ['Summary', 'Details', 'Point'])
        self.assertEqual(data['concepts'][0]['evidence'][0]['quote'], 'Actual page text')
        self.assertEqual(generate.call_args.args[1].instructions, 'Cover lecture')


if __name__ == '__main__':
    unittest.main()
