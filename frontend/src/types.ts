export type Mode = 'learn' | 'test'
export type DetailLevel = 'concise' | 'detailed'
export type QuestionType = 'multiple-choice' | 'true-false' | 'short-answer'

export type Concept = {
  id: string
  name: string
  shortName: string
  page: number
  eyebrow: string
  summary: string
  detail: string
  formula?: string
  keyPoints: string[]
  sourceText: string
  position: { x: number; y: number }
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
}

export type ChatMessage = {
  id: string
  role: 'assistant' | 'user'
  text: string
  pages?: number[]
  trace?: string[]
}

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

export type QuestionProgress = {
  response: string
  submitted: boolean
  correct: boolean | null
  hintVisible: boolean
  answerVisible: boolean
  attempts: number
}
