import { useEffect, useRef } from 'react'
import { Icon } from './Layout'
import type { ChatMessage } from './types'

export function ChatTranscript({ messages, busy, onCitation }: {
  messages: ChatMessage[]
  busy: boolean
  onCitation?: (page: number, documentId?: string) => void
}) {
  const transcript = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const element = transcript.current
    if (element) element.scrollTop = element.scrollHeight
  }, [messages.length, busy])

  return <div ref={transcript} className="chat-messages" role="log" aria-label="AI Tutor conversation">
    {messages.map(message => {
      const citations = message.citations?.map(citation => ({ page: citation.page, documentId: citation.document_id }))
        ?? message.pages?.map(page => ({ page, documentId: message.documentId })) ?? []
      const sources = new Map(citations.map(source => [`${source.documentId ?? ''}:${source.page}`, source]))
      return <div key={message.id} className={`message message--${message.role}`}>
        {message.role === 'assistant' && <span className="assistant-avatar"><Icon name="sparkle" size={15}/></span>}
        <div><p>{message.text}</p>
          {[...sources].map(([key, { page, documentId }]) => onCitation
            ? <button type="button" key={key} onClick={() => onCitation(page, documentId)}><Icon name="file" size={13}/>View source · p. {page}</button>
            : documentId && <a key={key} href={`/api/documents/${encodeURIComponent(documentId)}/pages/${page}/preview`}
              target="_blank" rel="noreferrer"><Icon name="file" size={13}/>View source · p. {page}</a>)}
        </div>
      </div>
    })}
    {busy && <div className="message message--assistant" role="status" aria-label="AI Tutor is replying">
      <span className="assistant-avatar"><Icon name="sparkle" size={15}/></span><div className="typing"><i/><i/><i/></div>
    </div>}
  </div>
}
