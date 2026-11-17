import { useRef, useState } from 'react'
import { acsDocumentId } from './api'
import { lecture as sampleLecture, sampleQuestions } from './data'
import type { ChatMessage, CourseQuestion, DocumentInfo, GeneratedQuestion, Lecture, QuestionProgress } from './types'

export type CourseProject = 'map' | 'test'

type CourseEntry = {
  id: string
  title: string
  document: DocumentInfo
  messages: ChatMessage[]
}

export type SavedMap = CourseEntry & { kind: 'map'; lecture: Lecture }
export type SavedTest = CourseEntry & {
  kind: 'test'
  documents?: DocumentInfo[]
  questions: (GeneratedQuestion | CourseQuestion)[]
  current: number
  responses: Record<number, string>
  progress?: Record<string, QuestionProgress>
}
export type CourseItem = SavedMap | SavedTest

const storageKey = 'studygraph:my-course:v1'
const sample: SavedMap = {
  id: 'acs-lecture-1',
  kind: 'map',
  title: 'Processor Evolution',
  document: {
    document_id: acsDocumentId,
    name: sampleLecture.fileName,
    page_count: sampleLecture.totalPages,
    original_url: `/api/documents/${acsDocumentId}/original`,
    preview_mode: 'page_image',
    pages_without_text: [],
  },
  messages: [],
  lecture: sampleLecture,
}
const sampleTest: SavedTest = {
  id: 'acs-lecture-1-practice',
  kind: 'test',
  title: 'AI Computing Foundations',
  document: sample.document,
  messages: [],
  current: 0,
  responses: {},
  questions: sampleQuestions.map(exercise => ({
    concept: sampleLecture.concepts.find(concept => concept.id === exercise.conceptId)?.name ?? 'Lecture review',
    prompt: exercise.prompt,
    citations: [],
    exercise,
    documentId: sample.document.document_id,
  })),
}

function loadCourse(): CourseItem[] {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored) {
      const parsed: unknown = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        const entries = parsed.filter(isCourseItem)
        return entries.some(item => item.id === sampleTest.id) ? entries : [...entries, sampleTest]
      }
    }
  } catch {
    // The sample remains available if browser storage cannot be read.
  }
  return [sample, sampleTest]
}

function isCourseItem(item: unknown): item is CourseItem {
  if (!item || typeof item !== 'object') return false
  const entry = item as Partial<CourseItem>
  if (typeof entry.id !== 'string' || typeof entry.title !== 'string' ||
      typeof entry.document?.document_id !== 'string' || !Array.isArray(entry.messages)) return false
  return entry.kind === 'map' ? Array.isArray(entry.lecture?.concepts) && entry.lecture.concepts.length > 0
    : entry.kind === 'test' && Array.isArray(entry.questions) && entry.questions.length > 0 &&
      Number.isInteger(entry.current) && entry.current! >= 0 && entry.current! < entry.questions.length &&
      !!entry.responses && typeof entry.responses === 'object'
}

export function useCourseStore() {
  const [items, setItems] = useState(loadCourse)
  const latest = useRef(items)
  const unsaved = useRef(false)
  const [storageError, setStorageError] = useState(false)

  function change(transform: (items: CourseItem[]) => CourseItem[]) {
    // Read prior writes by other tabs. Keep this tab's unsaved work if storage
    // failed on the previous write.
    const next = transform(unsaved.current ? latest.current : loadCourse())
    latest.current = next
    setItems(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify(next))
      unsaved.current = false
      setStorageError(false)
    } catch {
      unsaved.current = true
      setStorageError(true)
    }
  }

  function update(id: string, apply: (item: CourseItem) => CourseItem) {
    change(entries => entries.map(item => item.id === id ? apply(item) : item))
  }

  return { items, storageError, change, update }
}

export function lectureName(name: string) {
  return name.replace(/\.(pdf|pptx)$/i, '').replaceAll('_', ' ').trim() || 'Untitled lecture'
}

export function firstEntryPage(item: CourseItem) {
  if (item.kind === 'map') return item.lecture.concepts[0].page
  const question = item.questions[item.current]
  return question.citations[0]?.page ?? ('exercise' in question ? question.exercise.page : 1)
}

export function currentDocument(item: CourseItem) {
  if (item.kind === 'test') {
    const question = item.questions[item.current]
    if ('documentId' in question) {
      return item.documents?.find(doc => doc.document_id === question.documentId) ?? item.document
    }
  }
  return item.document
}
