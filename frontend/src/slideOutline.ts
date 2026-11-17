import { acsDocumentId, request } from './api'
import { lecture as sampleLecture } from './data'
import { lectureName } from './courseStore'
import type { Concept, DocumentInfo, Lecture, LectureTopic } from './types'

export type SlideText = { page: number; text: string }
export const outlinePageLimit = 80

type StudyGuide = {
  title: string
  topics: { title: string; notes: { page: number; title: string; summary: string; detail: string; keyPoints: string[]; formula: string | null }[] }[]
  sources: Record<number, string>
}

export async function createPersonalizedOutline(doc: DocumentInfo, instructions: string): Promise<Lecture> {
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

function slideConcept(slide: SlideText): Concept | undefined {
  const lines = slide.text.split(/\r?\n/)
    .map(line => line.replace(/^[\s•●▪◦·¡]+/u, '').replace(/\s+/g, ' ').trim())
    .filter(line => /\p{L}/u.test(line))
  if (!lines.length) return

  const heading = lines.find(line => line.length >= 3 && line.length <= 95) ?? `Slide ${slide.page}`
  const body = lines.filter(line => line !== heading)
  const summary = shorten(body.find(line => line.length >= 20) ?? heading, 195)
  return {
    id: `slide-${slide.page}`,
    name: shorten(heading, 76),
    shortName: shorten(heading, 45),
    page: slide.page,
    eyebrow: 'Slide notes',
    summary,
    detail: shorten(body.slice(0, 12).join(' ') || heading, 950),
    keyPoints: [...new Set(body)].slice(0, 4).map(line => shorten(line, 155)),
    sourceText: shorten(lines.join(' '), 260),
  }
}

export async function createSlideOutline(doc: DocumentInfo, getPage: (page: number) => Promise<SlideText>): Promise<Lecture> {
  if (doc.document_id === acsDocumentId) return sampleLecture
  const empty = new Set(doc.pages_without_text)
  const available = Array.from({ length: doc.page_count }, (_, i) => i + 1).filter(page => !empty.has(page))
  const pageNumbers = available.length <= outlinePageLimit ? available
    : Array.from({ length: outlinePageLimit }, (_, index) =>
      available[Math.round(index * (available.length - 1) / (outlinePageLimit - 1))])

  const concepts: Concept[] = []
  for (let offset = 0; offset < pageNumbers.length; offset += 6) {
    const slides = await Promise.all(pageNumbers.slice(offset, offset + 6).map(getPage))
    for (const slide of slides) {
      const concept = slideConcept(slide)
      if (concept) concepts.push(concept)
    }
  }
  if (!concepts.length) throw Error('This lecture has no readable text. Try a PDF or PPTX with selectable text.')

  const groupCount = Math.min(7, Math.max(1, Math.ceil(concepts.length / 4)))
  const topics: LectureTopic[] = Array.from({ length: groupCount }, (_, index) => {
    const group = concepts.slice(Math.floor(index * concepts.length / groupCount),
      Math.floor((index + 1) * concepts.length / groupCount))
    return {
      id: `section-${group[0].page}`,
      title: group[0].name,
      firstPage: group[0].page,
      lastPage: group[group.length - 1].page,
      conceptIds: group.map(concept => concept.id),
    }
  })
  const title = lectureName(doc.name)
  return {
    title, fileName: doc.name, totalPages: doc.page_count, concepts, relations: [],
    outline: { title, subtitle: 'From slide text', topics },
  }
}
