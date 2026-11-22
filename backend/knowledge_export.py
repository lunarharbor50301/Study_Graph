"""Export the existing model-generated study guide in knowledge dataset format."""
import os
from fastapi import APIRouter
from backend import documents, study_guide
from backend.llm_provider import provider_for

router = APIRouter(prefix="/api/documents")


@router.post("/{doc}/knowledge")
def knowledge(doc: str, body: study_guide.StudyRequest):
    guide = study_guide.study_guide(doc, body)
    concepts, notes = [], []
    for i, topic in enumerate(guide.topics):
        for j, note in enumerate(topic.notes):
            cid = f"topic-{i}-note-{j}"
            evidence = [{"document_id": doc, "page": note.page,
                         "quote": documents.page(doc, note.page)["text"]}]
            facts = list(dict.fromkeys([note.summary, note.detail, *note.keyPoints,
                                       *([note.formula] if note.formula else [])]))
            concepts.append({"id": cid, "document_id": doc, "name": note.title,
                             "aliases": [], "importance": "generated", "facts": facts,
                             "evidence": evidence, "evidence_pages": note.evidence_pages})
            notes.append({"id": f"N-{cid}", "title": note.title,
                          "required_points": [{"id": f"{cid}-P{k+1}", "text": fact,
                                               "max_score": 2, "evidence": evidence}
                                              for k, fact in enumerate(facts)]})
    config = provider_for("STUDYGRAPH_GENERATION_PROVIDER", require=False)
    return {"version": "0.3", "status": "generated", "document_id": doc,
            "concepts": concepts, "relations": [], "study_notes": notes,
            "generation": {"path": "study-guide", "instructions": body.instructions,
                           "provider": config.name,
                           "model": config.model,
                           "pipeline": os.getenv("STUDYGRAPH_CONCEPT_MAP_MODE", "staged"),
                           "limitations": ["Uses the study-guide endpoint; node count scales with the lecture.",
                                           "May return partial notes when the call/time budget is exhausted.",
                                           "Exports study-guide notes, not lazy study-note endpoint output."]}}
