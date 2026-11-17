import { lecture as fallbackLecture } from './data'
import type { ChatMessage, DocumentInfo, Lecture } from './types'

export const demoUser = new URLSearchParams(location.search).get('user') === 'B' ? 'B' : 'A'

export function withDemoUser(path: string, user = demoUser) {
  const url = new URL(path, location.origin)
  if (user === 'B') url.searchParams.set('user', 'B')
  else url.searchParams.delete('user')
  return url.pathname + url.search + url.hash
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(withDemoUser(`/api/${path}`), init)
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

export async function askAgent(question: string, sessionId: string, context: string, documentIds: string[], history: ChatMessage[]): Promise<ChatMessage> {
  const [documentId, ...otherDocuments] = documentIds
  const result = await request<{ answer: string; citations?: ChatMessage['citations'] }>('ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId, document_id: documentId, additional_document_ids: otherDocuments,
      tutor_context: context.slice(0, 2000), question,
      history: history.slice(-8).map(({ role, text }) => ({ role, text: text.slice(0, 2000) })),
    }),
  })
  return { id: crypto.randomUUID(), role: 'assistant', text: result.answer, citations: result.citations }
}
export async function streamAgent(question: string, sessionId: string, context: string, documentId: string, page: number, signal: AbortSignal, onEvent: (event: any) => void, additionalDocuments: string[]) {
  return streamEvents('/api/agent/stream', {
    question, session_id: sessionId, context, page, document_id: documentId, additional_document_ids: additionalDocuments,
  }, signal, onEvent)
}

export async function streamEvents<T>(url: string, body: unknown, signal: AbortSignal, onEvent: (event: T) => void) {
  const response = await fetch(withDemoUser(url), {
    method:'POST', headers:{'Content-Type':'application/json'}, signal,
    body:JSON.stringify(body),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw Error(typeof error.detail === 'string' ? error.detail : `Request failed (${response.status})`)
  }
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finished = false
  while (true) {
    const {value,done} = await reader.read()
    buffer += decoder.decode(value,{stream:!done})
    const lines = buffer.split('\n')
    buffer = lines.pop()!
    for (const line of lines) {
      if (!line.trim()) continue
      const event = JSON.parse(line)
      if (event.type==='error') throw Error(event.message)
      if (event.type==='done') finished = true
      onEvent(event)
    }
    if (done) break
  }
  if (!finished) throw Error('The answer stream ended early.')
}
