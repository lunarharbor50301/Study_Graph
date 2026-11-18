import { request } from './api'
import type { Concept, DocumentInfo, Lecture, LectureTopic } from './types'

export type SlideText = { page: number; text: string }

type StudyGuide = {
  title: string
  topics: { title: string; notes: { page: number; title: string; summary: string; detail: string; keyPoints: string[]; formula: string | null }[] }[]
  sources: Record<number, string>
}

export async function createGeneratedOutline(doc: DocumentInfo, instructions = ''): Promise<Lecture> {
  const guide = await request<StudyGuide>(`documents/${doc.document_id}/study-guide`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ instructions }),
  })
  const concepts: Concept[] = []
  const topics = guide.topics.map((topic, index): LectureTopic => {
    const notes = topic.notes.map((note, position): Concept => ({
      id: `topic-${index}-note-${position}`, name: note.title, shortName: shorten(note.title, 45),
      page: note.page, eyebrow: topic.title, summary: note.summary, detail: note.detail,
      keyPoints: note.keyPoints, formula: note.formula ?? undefined, sourceText: guide.sources[note.page],
    }))
    concepts.push(...notes)
    return {
      id: `topic-${index}`, title: topic.title,
      firstPage: Math.min(...notes.map(note => note.page)), lastPage: Math.max(...notes.map(note => note.page)),
      conceptIds: notes.map(note => note.id),
    }
  })
  return {
    title: guide.title, fileName: doc.name, totalPages: doc.page_count, concepts, relations: [],
    outline: { title: guide.title, topics },
  }
}

function shorten(text: string, length: number) {
  return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`
}
