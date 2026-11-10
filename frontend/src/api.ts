import { lecture as fallbackLecture } from './data'
import type { Lecture } from './types'

type AskResponse = { answer: string; citations?: { page: number }[] }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/${path}`, init)
  if (!response.ok) throw new Error(`API request failed (${response.status})`)
  return response.json() as Promise<T>
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

export async function askAgent(question: string, conceptId: string, sessionId: string): Promise<AskResponse | null> {
  try {
    return await request<AskResponse>('ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, concept_id: conceptId, question }),
    })
  } catch {
    return null
  }
}
