import { lecture as fallbackLecture } from './data'
import type { DocumentInfo, Lecture } from './types'

type AskResponse = { answer: string; citations?: { page: number }[] }

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(typeof error.detail === 'string' ? error.detail : `API request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export function uploadLecture(file: File) {
  const body = new FormData()
  body.append('file', file)
  return request<DocumentInfo>('documents', { method: 'POST', body })
}

export async function loadLecture(): Promise<Lecture> {
  try {
    const remote = await request<Partial<Lecture> & { concepts?: unknown[] }>('lecture')
    // The existing demo API returns a much smaller schema. Use the complete
    // sample until the backend adopts the frontend contract in types.ts.
    if (remote.totalPages && remote.concepts?.length) return remote as Lecture
  } catch {
    // A fully interactive fallback keeps frontend and backend work independent.
  }
  return fallbackLecture
}


// The curated graph describes this exact version of the bundled ACS lecture.
export const acsDocumentId = '34911c46e78edc833f283f8dd678b85d6f8c92d66859e6bf6886949181d95402'

export function askAgent(question: string, sessionId: string, context: string, documentId = acsDocumentId): Promise<AskResponse> {
  return request<AskResponse>('ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, document_id: documentId, tutor_context: context, question }),
  })
}
