export type Mode = 'learn' | 'test'
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer'

export type Concept = {
  id: string
  name: string
  shortName: string
  page: number
  sourcePages?: number[]
  eyebrow: string
  summary: string
  detail: string
  formula?: string
  keyPoints: string[]
  sourceText: string
}

export type LectureTopic = {
  id: string
  title: string
  firstPage: number
  lastPage: number
  conceptIds: string[]
}

export type LectureOutline = {
  title: string
  subtitle?: string
  strategy?: 'heading-groups'
  topics: LectureTopic[]
}

export type Relation = {
  source: string
  target: string
  label: string
}

export type Lecture = {
  title: string
  fileName: string
  totalPages: number
  concepts: Concept[]
  relations: Relation[]
  outline?: LectureOutline
}

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  pages?: number[]
  documentId?: string
  trace?: string[]
  citations?: { page: number; document_id: string }[]
}

export type DocumentInfo = {
  document_id: string
  name: string
  page_count: number
  original_url: string
  preview_mode: 'page_image' | 'slide_content'
  pages_without_text: number[]
}

export type EvidenceHit = { chunk_id: string; page: number; text: string }
export type GeneratedQuestion = { concept: string; citations: EvidenceHit[]; prompt: string }

export type TestQuestion = {
  id: string
  type: QuestionType
  conceptId: string
  page: number
  prompt: string
  options?: string[]
  answer: string
  acceptedAnswers?: string[]
  hint: string
  explanation: string
}

export type CourseQuestion = GeneratedQuestion & { exercise: TestQuestion; documentId: string }

export type QuestionProgress = {
  response: string
  submitted: boolean
  correct: boolean | null
  hintVisible: boolean
  answerVisible: boolean
  attempts: number
}
