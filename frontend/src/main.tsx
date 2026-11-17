import UploadWorkspace, { SavedQuestionSet } from './Documents'
import TutorMarkdown from './TutorMarkdown'
import { CourseShelf } from './CourseShelf'
import {Icon, Panel, SplitHandle} from './Layout'
import { getMapTopics, MindMap, type MapTopic } from './MindMap'
import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { demoUser, request, streamAgent, streamEvents, withDemoUser } from './api'
import { currentDocument, firstEntryPage, lectureName, useCourseStore, type CourseItem, type SavedMap, type SavedTest } from './courseStore'
import { lecture as fallbackLecture, starterMessages } from './data'
import { createSlideOutline, type SlideText } from './slideOutline'
import type { ChatMessage, Concept, CourseQuestion, DocumentInfo, Lecture, Mode, QuestionProgress, TestQuestion } from './types'
import './style.css'

function Navigation({ workspaceActive, courseShelf, mode, onMode, chatVisible, viewerVisible, onChatVisibilityChange, onViewerVisibilityChange }: {
  workspaceActive: boolean; courseShelf: React.ReactNode
  mode: Mode; onMode: (mode: Mode) => void
  chatVisible: boolean; viewerVisible: boolean
  onChatVisibilityChange: (visible: boolean) => void; onViewerVisibilityChange: (visible: boolean) => void
}) {
  return <aside className="sidebar">
    <div className="brand">
      <span className="brand__mark">
        <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12.5 14h3m0 0c2.8 0 2.2-7.5 5.4-7.5h.8m-6.2 7.5h6.2m-6.2 0c2.8 0 2.2 7.5 5.4 7.5h.8"/>
          <rect x="3" y="10.25" width="9.5" height="7.5" rx="2" fill="#eaf2fc"/>
          <circle cx="23.75" cy="6.5" r="2" fill="white"/>
          <circle cx="23.75" cy="14" r="2" fill="white"/>
          <circle cx="23.75" cy="21.5" r="2" fill="white"/>
        </svg>
      </span>
      <strong>StudyGraph</strong>
    </div>

    <nav className="sidebar__section" aria-labelledby="sidebar-workspace-label">
      <span className="sidebar__label" id="sidebar-workspace-label">Workspace</span>
      <button type="button" className="sidebar__item" aria-current={workspaceActive && mode === 'learn' ? 'page' : undefined} onClick={() => onMode('learn')}>
        <Icon name="learn" size={16}/>Learning
      </button>
      <button type="button" className="sidebar__item" aria-current={workspaceActive && mode === 'test' ? 'page' : undefined} onClick={() => onMode('test')}>
        <Icon name="test" size={16}/>Test
      </button>
    </nav>

    {!workspaceActive && <div className="sidebar__section" role="group" aria-labelledby="sidebar-panels-label">
      <span id="sidebar-panels-label" className="sidebar__label">Panels</span>
      <button type="button" className="sidebar__item" aria-expanded={chatVisible} aria-controls={chatVisible ? 'panel-chat' : undefined}
        onClick={() => onChatVisibilityChange(!chatVisible)}>
        <Icon name="chat" size={16}/><span>AI Tutor</span>
        <small className="sidebar__action" aria-hidden="true">{chatVisible ? 'Hide' : 'Show'}</small>
      </button>
      <button type="button" className="sidebar__item" aria-expanded={viewerVisible} aria-controls={viewerVisible ? 'panel-viewer' : undefined}
        onClick={() => onViewerVisibilityChange(!viewerVisible)}>
        <Icon name="file" size={16}/><span>Lecture Viewer</span>
        <small className="sidebar__action" aria-hidden="true">{viewerVisible ? 'Hide' : 'Show'}</small>
      </button>
    </div>}

    {courseShelf}

    <div className="sidebar__footer">
      <span className="sidebar__label" id="demo-user-label">Demo user</span>
      <nav className="demo-user-switch" aria-labelledby="demo-user-label">
        {(['A', 'B'] as const).map(user =>
          <a key={user} aria-current={user === demoUser ? 'true' : undefined}
            href={withDemoUser(location.pathname + (mode === 'test' ? '?tests' : ''), user)}>User {user}</a>)}
      </nav>
    </div>
  </aside>
}

type GeneratedNote = {
  summary: string; explanation: string; formula?: string | null; key_points: string[]
  evidence?: { page: number; quote: string } | null
}
type NoteEvent =
  | {type: 'section'; field: 'summary' | 'explanation' | 'formula'; value: string}
  | {type: 'section'; field: 'key_points'; value: string[]}
  | {type: 'done'; note: GeneratedNote}

function StudyNote({ concept, fileName, documentId, noteCache, backLabel, onCitation, onBack }: {
  concept: Concept
  fileName: string
  documentId?: string
  noteCache: Map<string, GeneratedNote>
  backLabel: string
  onCitation: (page: number) => void
  onBack: () => void
}) {
  const pages = concept.sourcePages ?? [concept.page]
  const noteKey = `${documentId}:${concept.name}:${pages.join(',')}`
  const [note, setNote] = useState(() => noteCache.get(noteKey))
  const [draft, setDraft] = useState<Partial<GeneratedNote>>({})
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!documentId || noteCache.has(noteKey)) return
    const controller = new AbortController()
    void streamEvents<NoteEvent>(`/api/documents/${documentId}/study-note/stream`, { concept: concept.name, pages }, controller.signal, event => {
      if (controller.signal.aborted) return
      if (event.type === 'section') setDraft(previous => ({ ...previous, [event.field]: event.value }))
      if (event.type === 'done') {
        noteCache.set(noteKey, event.note)
        setNote(event.note)
      }
    }).catch(error => { if (!controller.signal.aborted) setError(error.message) })
    return () => controller.abort()
  }, [noteKey, attempt])

  const content = note ?? draft
  const summary = documentId ? content.summary : concept.summary
  const explanation = documentId ? content.explanation : concept.detail
  const formula = documentId ? content.formula : concept.formula
  const points = documentId ? content.key_points : concept.keyPoints
  const evidence = documentId ? note?.evidence : { page: concept.page, quote: concept.sourceText }
  return <article className="study-note">
    <div className="note-toolbar"><button className="back-to-map" onClick={onBack}><Icon name="previous" size={15}/>{backLabel}</button></div>
    <header className="note-hero"><span className="eyebrow">{concept.eyebrow}</span><h3 id="study-note-title" tabIndex={-1}>{concept.name}</h3>{summary && <p>{summary}</p>}
      <div className="note-citations" aria-label={`Source pages in ${fileName}`}>
        {pages.map(page => <button className="citation" key={page} onClick={() => onCitation(page)}><Icon name="file" size={14}/>Page {page}</button>)}
      </div>
    </header>
    {explanation && <section className="note-section"><h4>How it works</h4><p>{explanation}</p></section>}
    {formula && <section className="formula-card"><span>Key relationship</span><strong>{formula}</strong></section>}
    {!!points?.length && <section className="note-section"><h4>Key points</h4><ul>{points.map(point => <li key={point}><span><Icon name="check" size={14}/></span>{point}</li>)}</ul></section>}
    {evidence && <section className="source-card"><div><Icon name="book"/><span><b>Lecture evidence</b><small>Directly grounded in the uploaded material</small></span></div><blockquote>“{evidence.quote}”</blockquote><button onClick={() => onCitation(evidence.page)}>Locate on slide <Icon name="chevron" size={15}/></button></section>}
    {documentId && !note && <section className="note-section">
      {error ? <><p role="alert">{error}</p><button className="button button--secondary" onClick={() => { setError(''); setDraft({}); setAttempt(value => value + 1) }}>Retry</button></>
        : <p role="status">{summary ? 'Preparing the rest of the note…' : 'Preparing the summary…'}</p>}
    </section>}
  </article>
}

function readVisitedTopics(key: string): Set<string> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    if (Array.isArray(stored)) return new Set(stored.filter((id): id is string => typeof id === 'string'))
  } catch {
    // Visiting topics still works if browser storage is unavailable.
  }
  return new Set()
}

function LearningPanel({ lecture, documentId, selected, onSelect, onPage, onCitation }: {
  lecture: Lecture
  documentId: string
  selected: Concept
  onSelect: (concept: Concept) => void
  onPage: (page: number) => void
  onCitation: (page: number) => void
}) {
  const [view, setView] = useState<'map' | 'note'>('map')
  const noteCache = useRef(new Map<string, GeneratedNote>())
  const [topicId, setTopicId] = useState<string | null>(null)
  const progressPrefix = demoUser === 'A' ? 'studygraph:lecture-progress:v1' : 'studygraph:lecture-progress:v1:B'
  const storageKey = `${progressPrefix}:${lecture.fileName}`
  const [visited, setVisited] = useState(() => readVisitedTopics(storageKey))
  const topics = useMemo(() => getMapTopics(lecture), [lecture])
  const activeTopic = topics.find(topic => topic.id === topicId)
  const learningPanel = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)

  useEffect(() => {
    const id = pendingFocus.current
    if (!id) return
    pendingFocus.current = null
    learningPanel.current?.closest('.panel__body')?.scrollTo({ top: 0 })
    document.getElementById(id)?.focus({ preventScroll: true })
  }, [topicId, view])

  function openTopic(topic: MapTopic) {
    pendingFocus.current = 'mind-map-back'
    setTopicId(topic.id)
    onSelect(topic.concepts[0])
    onPage(topic.firstPage)
    if (visited.has(topic.id)) return
    const next = new Set(visited).add(topic.id)
    setVisited(next)
    try {
      localStorage.setItem(storageKey, JSON.stringify([...next]))
    } catch {
      // The current view can still show the visit.
    }
  }

  function openNote(concept: Concept) {
    if (view === 'note') return
    pendingFocus.current = 'study-note-title'
    onSelect(concept)
    setView('note')
  }

  function showMap() {
    if (view === 'map') return
    pendingFocus.current = activeTopic ? 'mind-map-back' : 'concept-map-tab'
    setView('map')
  }

  function showOverview() {
    pendingFocus.current = activeTopic ? `mind-map-topic-${activeTopic.id}` : 'concept-map-tab'
    setTopicId(null)
  }

  return <div ref={learningPanel} className={`learning-panel${view === 'map' ? ' learning-panel--map' : ''}`}>
    <div className="content-tabs">
      <button id="concept-map-tab" className={view === 'map' ? 'active' : ''} aria-pressed={view === 'map'} onClick={showMap}><Icon name="graph"/>Concept map</button>
      <button className={view === 'note' ? 'active' : ''} aria-pressed={view === 'note'} onClick={() => openNote(selected)}><Icon name="book"/>Study note</button>
      <span className="grounded-badge"><Icon name="check" size={13}/>Lecture-grounded</span>
    </div>
    <MindMap title={lecture.outline?.title ?? lecture.title} subtitle={lecture.outline?.subtitle}
      topics={topics} activeTopic={activeTopic} visited={visited} hidden={view !== 'map'}
      onOpenTopic={openTopic} onOpenConcept={openNote} onBack={showOverview}/>
    {view === 'note' &&
      <StudyNote key={`${selected.id}:${selected.sourcePages?.join(',')}`} concept={selected} fileName={lecture.fileName}
          documentId={lecture.outline?.subtitle === 'From slide text' ? documentId : undefined} noteCache={noteCache.current}
          backLabel={activeTopic ? `Back to ${activeTopic.title}` : 'Back to overview'}
          onCitation={onCitation} onBack={showMap}/>}
  </div>
}

function QuestionInput({ question, progress, onResponse }: { question: TestQuestion; progress: QuestionProgress; onResponse: (response: string) => void }) {
  if (question.options) return <div className="answer-options">{question.options.map((option, index) => <label key={option} className={`answer-option ${progress.response === option ? 'answer-option--selected' : ''} ${progress.submitted && option === question.answer ? 'answer-option--correct' : ''} ${progress.submitted && progress.response === option && option !== question.answer ? 'answer-option--wrong' : ''}`}>
    <input type="radio" name={question.id} value={option} checked={progress.response === option} disabled={progress.submitted} onChange={() => onResponse(option)}/><span className="option-marker">{question.type === 'true-false' ? <Icon name={option === 'True' ? 'check' : 'close'} size={16}/> : String.fromCharCode(65 + index)}</span><span>{option}</span>
  </label>)}</div>
  return <label className="written-answer"><span>Your answer</span><textarea placeholder="Show your reasoning or enter a concise answer…" value={progress.response} disabled={progress.submitted} onChange={event => onResponse(event.target.value)}/><small>Your response is checked against the lecture-based reference answer.</small></label>
}

function TestPanel({ title, questions, current, question, progress, allProgress, onCurrent, onResponse, onHint, onSubmit, onRetry, onReveal, onPage }: {
  title: string; questions: TestQuestion[]; current: number; question: TestQuestion
  progress: QuestionProgress; allProgress: Record<string, QuestionProgress>
  onCurrent: (index: number) => void; onResponse: (value: string) => void; onHint: () => void; onSubmit: () => void; onRetry: () => void; onReveal: () => void
  onPage: (page: number) => void
}) {
  const completed = Object.values(allProgress).filter(p => p.correct).length
  return <div className="test-workspace">
    <div className="test-topbar"><div><span className="eyebrow">Lecture review</span><h3>{title}</h3></div><div className="test-score"><b>{completed}/{questions.length}</b><span>correct</span></div></div>
    <div className="question-progress" aria-label="Question navigation">{questions.map((item, index) => { const itemProgress = allProgress[item.id]; return <button key={item.id} aria-label={`Question ${index + 1}`} aria-current={index === current ? "step" : undefined} onClick={() => onCurrent(index)} className={`${index === current ? 'current' : ''} ${itemProgress?.correct ? 'correct' : itemProgress?.submitted ? 'wrong' : ''}`}><span>{itemProgress?.correct ? <Icon name="check" size={13}/> : index + 1}</span><small>{item.type === 'multiple-choice' ? 'MCQ' : item.type === 'true-false' ? 'T/F' : 'Short'}</small></button>})}<div className="progress-line"><span style={{width: `${(completed / questions.length) * 100}%`}}/></div></div>
    <article className="question-card">
      <div className="question-meta"><span>Question {current + 1} of {questions.length}</span><span>{question.type.replace('-', ' ')}</span><button type="button" className="question-citation" onClick={() => onPage(question.page)}><Icon name="file" size={13}/>Page {question.page}</button></div>
      <h4>{question.prompt}</h4>
      <QuestionInput question={question} progress={progress} onResponse={onResponse}/>
      {progress.hintVisible && <div className="hint-box"><Icon name="help"/><div><b>Hint</b><p>{question.hint}</p></div></div>}
      {progress.submitted && <div className={`feedback-box ${progress.correct ? 'feedback-box--correct' : 'feedback-box--wrong'}`}><span className="feedback-icon"><Icon name={progress.correct ? 'check' : 'close'}/></span><div><b>{progress.correct ? 'Correct — well done.' : 'Not quite. Review the feedback and try again.'}</b><p>{progress.correct ? question.explanation : 'Check the related concept and reconsider the key relationship. You can retry without revealing the answer.'}</p></div></div>}
      {progress.answerVisible && <div className="solution-box"><span>Reference answer</span><b>{question.answer}</b><p>{question.explanation}</p></div>}
      <div className="question-actions"><button className="button button--ghost" onClick={onHint}><Icon name="help"/> {progress.hintVisible ? 'Hide hint' : 'Get a hint'}</button><div>
        {progress.submitted && !progress.correct && <button className="button button--secondary" onClick={onRetry}>Try again</button>}
        {progress.submitted && <button className="button button--ghost" onClick={onReveal}>{progress.answerVisible ? 'Hide answer' : 'View answer'}</button>}
        {!progress.submitted && <button className="button button--primary" disabled={!progress.response.trim()} onClick={onSubmit}>Submit answer <Icon name="chevron" size={16}/></button>}
      </div></div>
    </article>
    <div className="question-nav"><button disabled={current === 0} onClick={() => onCurrent(current - 1)}><Icon name="previous"/>Previous</button><span>Responses are saved automatically</span><button disabled={current === questions.length - 1} onClick={() => onCurrent(current + 1)}>Next<Icon name="next"/></button></div>
  </div>
}

function describeLookup(line: string) {
  const match = /^(\w+) (\{.*\}) → (.*)$/.exec(line)
  if (!match) return line
  try {
    const [, tool, args, rawPages] = match
    const { query, page } = JSON.parse(args)
    const pages = rawPages.replace(/[\[\]]/g, '').trim()
    if (tool === 'search_lecture') return `Searched for “${query}” · ${pages ? `pages ${pages}` : 'no matches'}`
    if (tool === 'read_page') return `Read page ${page}`
    if (tool === 'list_documents') return 'Checked available lectures'
  } catch {
    // Older messages may contain traces in a different format.
  }
  return line
}

function ChatPanel({ doc, page, mode, concept, item, onAgentSession, onCitation }: {
  doc: DocumentInfo; page: number; mode: Mode; concept: Concept
  item: CourseItem
  onAgentSession: (sessionId: string) => void; onCitation: (page: number, documentId?: string) => void
}) {
  const [sessionId, setSessionId] = useState(() => item.agentSessionId ?? crypto.randomUUID())
  const [agentMessages, setAgentMessages] = useState<ChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [status, setStatus] = useState('')
  const abort = useRef<AbortController | null>(null)
  useEffect(() => () => abort.current?.abort(), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoadingHistory(true)
    setAgentMessages([])
    const query = new URLSearchParams({ session_id: sessionId, document_id: doc.document_id })
    void request<{messages: ChatMessage[]}>(`agent/history?${query}`, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setAgentMessages(data.messages.map(message => ({ ...message, documentId: doc.document_id })))
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('Could not restore conversation.') })
      .finally(() => { if (!controller.signal.aborted) setLoadingHistory(false) })
    return () => controller.abort()
  }, [sessionId, doc.document_id])
  const welcome: ChatMessage = { id: 'welcome', role: 'assistant', text: starterMessages[mode] }
  const archivedQuestion = item?.kind === 'test' ? item.questions[item.current] : undefined
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const context = archivedQuestion?.prompt ?? concept.name
  const contextLabel = item.kind === 'test' ? `Question ${item.current + 1}: ${archivedQuestion?.concept}` : `Discussing: ${concept.name}`
  const suggestions = mode === 'learn' ? [`Explain ${concept.shortName} simply`, 'How is it related to the previous concept?', 'Give me one practice question'] : ['Clarify the question without giving the answer', 'What concept should I review?', 'Check my reasoning approach']
  async function send(event?: FormEvent, suggested?: string) {
    event?.preventDefault()
    const prompt = (suggested ?? input).trim()
    if (!prompt || busy || loadingHistory) return
    setInput('')
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: prompt }
    setBusy(true)
    setStatus('')
    const controller = new AbortController()
    abort.current = controller
    if (!item.agentSessionId) onAgentSession(sessionId)
    const replyId = crypto.randomUUID()
    setAgentMessages(messages => [...messages, userMessage, { id: replyId, role: 'assistant', text: '' }])
    const updateReply = (update: (message: ChatMessage) => ChatMessage) => {
      if (!controller.signal.aborted) setAgentMessages(messages => messages.map(message => message.id === replyId ? update(message) : message))
    }
    try {
      await streamAgent(prompt, sessionId, context.slice(0, 2000), doc.document_id, page, controller.signal, event => {
        if (event.type === 'model_start') setStatus('Preparing answer…')
        if (event.type === 'tool_start') {
          if (event.tool === 'read_page') setStatus(`Reading page ${event.args.page}…`)
          else if (event.tool === 'search_lecture') setStatus('Searching the lecture…')
          else setStatus('Checking available lectures…')
        }
        if (event.type === 'answer_start') updateReply(message => ({ ...message, text: '' }))
        if (event.type === 'delta') updateReply(message => ({ ...message, text: message.text + event.text }))
        if (event.type === 'done') {
          const pages = [...new Set<number>(event.citations.filter((citation: {document_id: string}) => citation.document_id === doc.document_id).map((citation: {page: number}) => citation.page))]
          const trace = event.trace.map((entry: {tool: string; args: unknown; pages: number[]}) => `${entry.tool} ${JSON.stringify(entry.args)} → ${entry.pages.join(', ')}`)
          updateReply(message => ({ ...message, text: event.answer, pages, trace, documentId: doc.document_id }))
          setStatus(`${event.model_calls} model calls · ${(event.timing_ms.total / 1000).toFixed(2)} s`)
        }
      })
    } catch (error) {
      setAgentMessages(messages => messages.filter(message => message.id !== replyId && message.id !== userMessage.id))
      setStatus(controller.signal.aborted ? 'Stopped.' : String(error))
    } finally {
      abort.current = null
      setBusy(false)
    }
  }
  return <div className="chat-layout"><div className="chat-context">
    <span><Icon name={mode === 'learn' ? 'book' : 'test'} size={14}/>{contextLabel}</span>
    {busy ? <button onClick={() => abort.current?.abort()}>Stop</button> : <button onClick={() => {
      const next = crypto.randomUUID()
      setStatus('')
      onAgentSession(next)
      setSessionId(next)
    }}>New conversation</button>}
    <small role="status">{loadingHistory ? 'Restoring conversation…' : status}</small>
  </div>
    <div className="chat-messages" aria-live="polite">{[welcome, ...agentMessages].map(message => <div key={message.id} className={`message message--${message.role}`}>
      {message.role === 'assistant' && <span className="assistant-avatar"><Icon name="sparkle" size={15}/></span>}
      <div>
        {message.role === 'assistant' ? <TutorMarkdown text={message.text}/> : <p>{message.text}</p>}
        {!!message.trace?.length && <details><summary>Lecture lookups</summary>{message.trace.map((line, i) => <p key={i}>{describeLookup(line)}</p>)}</details>}
        {message.pages?.map(page => <button key={page} onClick={() => onCitation(page, message.documentId)}><Icon name="file" size={13}/>View source · p. {page}</button>)}
      </div>
    </div>)}{busy && <div className="message message--assistant"><span className="assistant-avatar"><Icon name="sparkle" size={15}/></span><div className="typing"><i/><i/><i/></div></div>}</div>
    <div className="suggestions">{suggestions.map(suggestion => <button key={suggestion} onClick={() => send(undefined, suggestion)}>{suggestion}</button>)}</div>
    <form className="chat-input" onSubmit={send}><textarea aria-label="Message AI tutor" placeholder={mode === 'learn' ? 'Ask about this concept…' : 'Discuss your reasoning…'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }}/><button disabled={!input.trim() || busy || loadingHistory} aria-label="Send message"><Icon name="chevron"/></button><span>Enter to send · Shift + Enter for a new line</span></form>
  </div>
}

function LectureViewer({ doc, page, onPage, evidenceVisible, setEvidenceVisible }: { doc: DocumentInfo; page: number; onPage: (page: number) => void; evidenceVisible: boolean; setEvidenceVisible: (visible: boolean) => void }) {
  const pageUrl = '/api/documents/' + doc.document_id + '/pages/' + page
  const [excerpt, setExcerpt] = useState<{url: string; text: string} | null>(null)
  useEffect(() => {
    if (!evidenceVisible) return
    const controller = new AbortController()
    fetch(withDemoUser(pageUrl), {signal: controller.signal}).then(async response => {
      if (!response.ok) throw Error()
      const data = await response.json()
      if (!controller.signal.aborted) setExcerpt({url:pageUrl, text:data.text || 'No searchable text on this page.'})
    }).catch(() => {
      if (!controller.signal.aborted) setExcerpt({url:pageUrl, text:'Page text unavailable.'})
    })
    return () => controller.abort()
  }, [pageUrl, evidenceVisible])
  return <div className="viewer-layout"><div className="file-strip"><span className="pdf-mark">{doc.name.toLowerCase().endsWith('.pptx')?'PPTX':'PDF'}</span><div><b>{doc.name}</b><small>{doc.page_count} pages · <a href={withDemoUser(doc.original_url)}>Download original</a></small></div><span className="ready-badge"><i/>Ready</span></div>
    <div className="viewer-toolbar"><button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page"><Icon name="previous"/></button><label>Page<input type="number" min="1" max={doc.page_count} value={page} onChange={event => onPage(Math.max(1, Math.min(doc.page_count, Math.trunc(Number(event.target.value)))))}/><span>of {doc.page_count}</span></label><button onClick={() => onPage(Math.min(doc.page_count, page + 1))} disabled={page >= doc.page_count} aria-label="Next page"><Icon name="next"/></button><button className={`evidence-toggle ${evidenceVisible ? 'active' : ''}`} onClick={() => setEvidenceVisible(!evidenceVisible)}><Icon name="sparkle" size={14}/>Evidence</button></div>
    <div className="slide-stage">{doc.preview_mode==='slide_content' ? <iframe title="Slide content" sandbox="" src={withDemoUser(pageUrl+'/preview')} style={{width:'100%',height:'100%'}}/> : <img key={pageUrl} src={withDemoUser(pageUrl+'/preview')} alt={'Lecture page '+page} style={{width:'100%',height:'auto'}}/>}</div>
    {evidenceVisible && <div className="evidence-panel" style={{maxHeight:'25%',overflow:'auto'}}><div><span className="eyebrow">Page {page} text</span><p>{excerpt?.url===pageUrl ? excerpt.text : 'Loading…'}</p></div></div>}
  </div>
}

const emptyProgress: QuestionProgress = {
  response: '', submitted: false, correct: null, hintVisible: false, answerVisible: false, attempts: 0,
}

function normalize(value: string) {
  return value.normalize('NFKC').toLowerCase().trim().replaceAll('−', '-').replaceAll('×', 'x')
    .replace(/[.!?]+$/, '').replace(/\s+/g, ' ').trim()
}

function ArchivedTest({ item, onEdit, onSource, onPage }: {
  item: SavedTest
  onEdit: (id: string, apply: (test: SavedTest) => SavedTest) => void
  onSource: (page: number, documentId: string) => void
  onPage: (page: number, documentId?: string) => void
}) {
  const current = item.questions[item.current]
  const choose = (index: number) => {
    const next = { ...item, current: index }
    onEdit(item.id, entry => ({ ...entry, current: index }))
    onSource(firstEntryPage(next), currentDocument(next).document_id)
  }
  if (!('exercise' in current)) {
    return <SavedQuestionSet item={item} onQuestion={choose} onPage={onPage}
      onResponse={(index, response) => onEdit(item.id, entry => ({ ...entry, responses: { ...entry.responses, [index]: response } }))}/>
  }

  const exercises = item.questions.flatMap(question => 'exercise' in question ? [question.exercise] : [])
  const question = current.exercise
  const progress = item.progress?.[question.id] ?? emptyProgress
  function update(values: Partial<QuestionProgress>) {
    onEdit(item.id, entry => ({
      ...entry,
      progress: { ...entry.progress, [question.id]: { ...(entry.progress?.[question.id] ?? emptyProgress), ...values } },
    }))
  }
  function submit() {
    const response = normalize(progress.response)
    const accepted = [question.answer, ...(question.acceptedAnswers ?? [])].map(normalize)
    const correct = !!response && accepted.some(answer =>
      response === answer || (item.id === 'acs-lecture-1-practice' && question.type === 'short-answer' && response.includes(answer)))
    update({ submitted: true, correct, attempts: progress.attempts + 1 })
  }
  return <TestPanel title={item.title} questions={exercises} current={item.current} question={question}
    onPage={next => onPage(next, currentDocument(item).document_id)}
    progress={progress} allProgress={item.progress ?? {}} onCurrent={choose}
    onResponse={response => update({ response })} onHint={() => update({ hintVisible: !progress.hintVisible })}
    onSubmit={submit} onRetry={() => update({ submitted: false, correct: null, answerVisible: false })}
    onReveal={() => update({ answerVisible: !progress.answerVisible })}/>
}

function App() {
  const initial = new URLSearchParams(location.search)
  const course = useCourseStore()
  const [entryId, setEntryId] = useState(() => initial.get('entry'))
  const item = course.items.find(entry => entry.id === entryId)
  useEffect(() => {
    if (item?.kind !== 'map' || item.lecture.outline?.subtitle !== 'From slide text' || item.lecture.outline.strategy) return
    const controller = new AbortController()
    const doc = item.document
    void createSlideOutline(doc, page => request<SlideText>(`documents/${doc.document_id}/pages/${page}`, { signal: controller.signal }))
      .then(lecture => {
        if (!controller.signal.aborted) course.update(item.id, entry => entry.kind === 'map' ? { ...entry, lecture } : entry)
      })
      .catch(error => { if (!controller.signal.aborted) console.warn('Could not regroup saved concept map.', error) })
    return () => controller.abort()
  }, [item])
  const [workspaceMode, setWorkspaceMode] = useState<Mode>(() => initial.has('tests') ? 'test' : 'learn')
  const mode = item ? item.kind === 'test' ? 'test' : 'learn' : workspaceMode
  const [selectedId, setSelectedId] = useState(() => item?.kind === 'map' ? item.lecture.concepts[0].id : 'hierarchy')
  const [page, setPage] = useState(() => item ? firstEntryPage(item) : 1)
  const [sourceId, setSourceId] = useState<string>()
  const [chatVisible, setChatVisible] = useState(true)
  const [viewerVisible, setViewerVisible] = useState(true)
  const [workspaceShare, setWorkspaceShare] = useState(68)
  const [mainShare, setMainShare] = useState(83)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [evidenceVisible, setEvidenceVisible] = useState(true)
  const lecture = item?.kind === 'map' ? item.lecture : fallbackLecture
  const selected = lecture.concepts.find(concept => concept.id === selectedId) ?? lecture.concepts[0]
  const activeDoc = item ? currentDocument(item) : null
  const sourceDoc = (item?.kind === 'test' && item.documents?.find(document => document.document_id === sourceId)) || activeDoc

  const toggleExpand = (id: string) => setExpanded(value => value === id ? null : id)
  const setChatPanelVisible = (visible: boolean) => {
    setChatVisible(visible)
    if (!visible) setExpanded(value => value === 'chat' ? null : value)
  }
  const setViewerPanelVisible = (visible: boolean) => {
    setViewerVisible(visible)
    if (!visible) setExpanded(value => value === 'viewer' ? null : value)
  }
  const selectConcept = (concept: Concept) => { setSelectedId(concept.id); setPage(concept.page); setEvidenceVisible(true) }
  const openCitation = (citation: number, documentId?: string) => {
    setPage(citation)
    setSourceId(documentId)
    setViewerVisible(true)
    setEvidenceVisible(true)
  }

  function switchMode(next: Mode) {
    setEntryId(null)
    setWorkspaceMode(next)
    setExpanded(null)
    history.replaceState(null, '', withDemoUser(location.pathname + (next === 'test' ? '?tests' : '')))
  }

  function openSaved(entry: CourseItem) {
    setEntryId(entry.id)
    if (entry.kind === 'map') setSelectedId(entry.lecture.concepts[0].id)
    setExpanded(null)
    openCitation(firstEntryPage(entry))
    history.replaceState(null, '', withDemoUser(location.pathname + `?entry=${encodeURIComponent(entry.id)}`))
  }

  function addMap(document: DocumentInfo, newLecture: Lecture, open: boolean) {
    const entry: SavedMap = {
      id: crypto.randomUUID(), kind: 'map', title: newLecture.outline?.title ?? newLecture.title,
      document, lecture: newLecture, messages: [],
    }
    course.change(items => [entry, ...items])
    if (open) openSaved(entry)
  }

  function addTest(documents: DocumentInfo[], questions: CourseQuestion[], open: boolean) {
    const document = documents[0]
    const entry: SavedTest = {
      id: crypto.randomUUID(), kind: 'test', title: '', document, documents, questions, messages: [], current: 0, responses: {},
    }
    course.change(items => {
      const count = items.filter(saved => saved.kind === 'test' && saved.document.document_id === document.document_id).length
      const lectureTitle = documents.length === 1 ? lectureName(document.name) : `${lectureName(document.name)} + ${documents.length - 1} more`
      return [{ ...entry, title: `${lectureTitle} — Test ${count + 1}` }, ...items]
    })
    if (open) openSaved(entry)
  }

  const courseShelf = <CourseShelf items={course.items} activeId={item?.id} storageError={course.storageError}
    onOpen={openSaved} onRename={(id, title) => course.update(id, entry => ({ ...entry, title }))}/>
  return <div className="app-shell">
    <Navigation workspaceActive={!item} courseShelf={courseShelf} mode={mode} onMode={switchMode}
      chatVisible={chatVisible} viewerVisible={viewerVisible}
      onChatVisibilityChange={setChatPanelVisible} onViewerVisibilityChange={setViewerPanelVisible}/>
    {item && activeDoc && sourceDoc ? <div className={`study-area ${viewerVisible ? 'study-area--with-viewer' : ''}`} style={{ '--split-share': workspaceShare / 100 } as React.CSSProperties}>
      <main id="study-workspace" className={`workspace${chatVisible ? ' workspace--with-chat' : ''}${mode === 'learn' ? ' workspace--learning' : ''}`} style={{ '--split-share': mainShare / 100 } as React.CSSProperties}>
        <Panel id="main" title={item.title} subtitle={activeDoc.name} icon={mode === 'learn' ? 'brain' : 'test'} expanded={expanded} onExpand={() => toggleExpand('main')} className="panel--main">
          {item.kind === 'map'
            ? <LearningPanel key={item.id} lecture={item.lecture} documentId={activeDoc.document_id} selected={selected} onSelect={selectConcept} onPage={setPage} onCitation={openCitation}/>
            : <ArchivedTest key={item.id} item={item} onPage={openCitation}
              onSource={(nextPage, documentId) => { setPage(nextPage); setSourceId(documentId); setEvidenceVisible(true) }}
              onEdit={(id, apply) => course.update(id, entry => entry.kind === 'test' ? apply(entry) : entry)}/>}
        </Panel>
        {chatVisible && <SplitHandle axis="y" label="Resize main panel and AI tutor" controls="panel-main" value={mainShare} onChange={setMainShare}/>}
        <Panel id="chat" title="AI Tutor" subtitle={mode === 'learn' ? 'Ask, compare, and practice' : 'Discuss your reasoning without spoilers'} icon="chat" canClose hidden={!chatVisible} expanded={expanded} onClose={() => setChatPanelVisible(false)} onExpand={() => toggleExpand('chat')} className="panel--chat">
          <ChatPanel key={`${item.id}:${activeDoc.document_id}`} item={item} doc={activeDoc} page={sourceDoc.document_id === activeDoc.document_id ? page : firstEntryPage(item)} mode={mode} concept={selected} onCitation={openCitation}
            onAgentSession={agentSessionId => course.update(item.id, entry => ({ ...entry, agentSessionId }))}/>
        </Panel>
      </main>
      {viewerVisible && <SplitHandle axis="x" label="Resize workspace and lecture viewer" controls="study-workspace" value={workspaceShare} onChange={setWorkspaceShare}/>}
      <Panel id="viewer" title="Lecture Viewer" subtitle="Source evidence from the uploaded material" icon="file" canClose hidden={!viewerVisible} expanded={expanded} onClose={() => setViewerPanelVisible(false)} onExpand={() => toggleExpand('viewer')} className="panel--viewer">
        <LectureViewer doc={sourceDoc} page={page} onPage={setPage} evidenceVisible={evidenceVisible} setEvidenceVisible={setEvidenceVisible}/>
      </Panel>
    </div> : <UploadWorkspace key={mode} mode={mode} onMapCreated={addMap} onTestCreated={addTest}/>}
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>)
