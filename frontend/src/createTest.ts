import { request } from './api'
import type { SlideText } from './slideOutline'
import type { CourseQuestion, DocumentInfo, GeneratedQuestion, QuestionType, TestQuestion } from './types'

export const questionTypes: { type: QuestionType; label: string }[] = [
  { type: 'multiple-choice', label: 'Multiple choice' },
  { type: 'true-false', label: 'True / False' },
  { type: 'short-answer', label: 'Short answer' },
]
export const maxQuestions = 12
export type Difficulty = 'Mixed' | 'Foundational' | 'Advanced'
export type QuestionCounts = Record<QuestionType, number>

type PracticeQuestion = GeneratedQuestion & Pick<TestQuestion, 'type' | 'answer' | 'options' | 'hint' | 'explanation'> & {
  accepted_answers: string[]
}

async function lectureTopics(doc: DocumentInfo, count: number) {
  const blank = new Set(doc.pages_without_text)
  const readable = Array.from({ length: doc.page_count }, (_, index) => index + 1).filter(page => !blank.has(page))
  if (!readable.length) throw new Error(`${doc.name} has no readable text. Choose a lecture with selectable text.`)
  const pages = Array.from({ length: Math.min(count, readable.length) }, (_, index) =>
    readable[Math.floor((index + .5) * readable.length / Math.min(count, readable.length))])
  const slides = await Promise.all(pages.map(page => request<SlideText>(`documents/${doc.document_id}/pages/${page}`)))
  const topics = slides.map(slide => {
    const lines = slide.text.split(/\r?\n/).map(line => line.trim()).filter(line => /\p{L}/u.test(line))
    return {
      label: lines[0]?.slice(0, 78) ?? `Slide ${slide.page}`,
      query: lines.slice(0, 4).join(' ').slice(0, 240),
    }
  }).filter(topic => topic.query)
  if (!topics.length) throw new Error(`No readable topics were found in ${doc.name}.`)
  return topics
}

export async function createTest(documents: DocumentInfo[], counts: QuestionCounts, difficulty: Difficulty,
  onProgress: (completed: number, total: number) => void, instructions = ''): Promise<CourseQuestion[]> {
  const types = questionTypes.flatMap(({ type }) => Array<QuestionType>(counts[type]).fill(type))
  const topics = await Promise.all(documents.map((doc, index) =>
    lectureTopics(doc, types.filter((_, position) => position % documents.length === index).length)))
  const questions: CourseQuestion[] = []

  for (const [index, type] of types.entries()) {
    const sourceIndex = index % documents.length
    const doc = documents[sourceIndex]
    const sourceTopics = topics[sourceIndex]
    const topic = sourceTopics[Math.floor(index / documents.length) % sourceTopics.length]
    const result = await request<PracticeQuestion>(`documents/${doc.document_id}/practice-question`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, difficulty, topic: topic.label, query: topic.query, instructions,
        previous: questions.map(question => question.prompt),
      }),
    })
    questions.push({
      concept: result.concept, prompt: result.prompt, citations: result.citations, documentId: doc.document_id,
      exercise: {
        id: `q-${index + 1}`, page: result.citations[0].page, conceptId: '', type: result.type,
        prompt: result.prompt, answer: result.answer, options: result.options, hint: result.hint,
        explanation: result.explanation, acceptedAnswers: result.accepted_answers,
      },
    })
    onProgress(questions.length, types.length)
  }
  return questions
}
