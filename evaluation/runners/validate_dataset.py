"""Validate active evaluation data without calling a model. Run from any directory."""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
def read(path):
    return json.loads(path.read_text())
def main():
    docs = {d['id']: d for d in read(ROOT/'sources/documents.json')['documents']}
    pages = {f'ACS-L{n}': read(ROOT/f'sources/lecture{n}_pages.json') for n in (1, 2)}
    bank = {q['id']: q for q in read(ROOT/'shared/question_bank.json')['questions']}
    assert len(bank) == len(read(ROOT/'shared/question_bank.json')['questions'])
    checked = 0
    def check(value, document):
        nonlocal checked
        if isinstance(value, dict):
            if 'document_id' in value:
                assert value['document_id'] == document, value
            if 'quote' in value:
                assert 1 <= value['page'] <= docs[document]['page_count']
                assert value['quote'] == pages[document][value['page']-1]['text'].strip()
                checked += 1
            for item in value.values():
                check(item, document)
        elif isinstance(value, list):
            for item in value:
                check(item, document)
    files = [f for folder in ROOT.glob('0*_*') for f in folder.rglob('*.json')]
    for f in files:
        data = read(f)
        document = data['document_id']
        assert document in docs
        check(data, document)
        if 'question_ids' in data:
            assert (f.parent/data['question_bank']).resolve() == (ROOT/'shared/question_bank.json').resolve()
            for qid in data['question_ids']:
                assert bank[qid]['document_id'] == document
                check(bank[qid], document)
        cases = data.get('cases', [])
        assert len({c['id'] for c in cases}) == len(cases)
        for case in cases:
            if 'turns' in case:
                assert [t['turn'] for t in case['turns']] == [1, 2, 3, 4]
            if 'grading_key' in case:
                key = case['grading_key']
                assert sum(key['point_scores'].values()) == key['total_score']
                for error in key['errors']:
                    assert error['span'] in case['input']['student_answer']
        if 'concepts' in data:
            ids = {c['id'] for c in data['concepts']}
            for relation in data['relations']:
                assert relation['source'] in ids and relation['target'] in ids
    for n in (1, 2):
        assert len(read(ROOT/f'02_ai_tutor/multi_turn/lecture{n}.json')['cases']) == 3
    print(f'PASS: {len(files)} module files, {len(bank)} shared questions, {checked} evidence references; 6 dialogues / 24 turns.')
if __name__ == '__main__':
    main()
