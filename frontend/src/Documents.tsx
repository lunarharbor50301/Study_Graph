import { useEffect, useRef, useState } from 'react'
import { Icon } from './Layout'
import { askAgent, request, uploadLecture } from './api'
import { ChatTranscript } from './ChatTranscript'
import { createTest, maxQuestions, questionTypes, type Difficulty, type QuestionCounts } from './createTest'
import { createPersonalizedOutline, createSlideOutline, type SlideText } from './slideOutline'
import type { SavedTest } from './courseStore'
import type { ChatMessage, CourseQuestion, DocumentInfo, EvidenceHit, Lecture, Mode } from './types'

type WorkspaceConversation = { id: string; messages: ChatMessage[] }

const promptLimit = 2000
const promptSuggestions = {
  learn: [
    { label: 'Highlight key formulas', text: 'Highlight the key formulas and explain when to use each one.' },
    { label: 'Organize by chapter', text: 'Group the concept map and notes by chapter or lecture section.' },
    { label: 'Explain with examples', text: 'Explain the most difficult concepts with examples from the lecture.' },
  ],
  test: [
    { label: 'Focus on calculations', text: 'Focus on calculation and quantitative reasoning where the lecture supports it.' },
    { label: 'Use real-world scenarios', text: 'Use realistic scenarios to test how the lecture concepts are applied.' },
    { label: 'Test common mistakes', text: 'Target common mistakes and explain why tempting wrong answers are incorrect.' },
  ],
}

type WorkspaceProps = {
  mode: Mode
  onMapCreated: (doc: DocumentInfo, lecture: Lecture, open: boolean, conversation: WorkspaceConversation) => void
  onTestCreated: (docs: DocumentInfo[], questions: CourseQuestion[], open: boolean, conversation: WorkspaceConversation) => void
}

export default function UploadWorkspace({ mode, onMapCreated, onTestCreated }: WorkspaceProps) {
  const tests = mode === 'test'
  const [files, setFiles] = useState<File[]>([])
  const [counts, setCounts] = useState<QuestionCounts>({ 'multiple-choice': 2, 'true-false': 1, 'short-answer': 2 })
  const [difficulty, setDifficulty] = useState<Difficulty>('Mixed')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [asking, setAsking] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [sessionId] = useState(() => crypto.randomUUID())
  const input = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const imported = useRef(new WeakMap<File, DocumentInfo>())
  const mounted = useRef(true)
  const pending = useRef(false)
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  const busy = !!status || asking
  const fileLimit = tests ? 5 : 1

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function addFiles(added: File[]) {
    if (pending.current || !added.length) return
    if (added.some(file => !/\.(pdf|pptx)$/i.test(file.name))) {
      setError('Choose a PDF or PPTX file.')
      return
    }
    const next = tests ? [...files, ...added.filter(file =>
      !files.some(existing => existing.name === file.name && existing.size === file.size && existing.lastModified === file.lastModified))]
      : added
    if (next.length > fileLimit) {
      setError(tests ? 'Choose up to five lecture files.' : 'Choose one lecture file.')
      return
    }
    setFiles(next)
    setError('')
  }

  async function uploadSelected() {
    const uploaded: DocumentInfo[] = []
    for (const file of files) {
      const doc = imported.current.get(file) ?? await uploadLecture(file)
      imported.current.set(file, doc)
      if (!uploaded.some(existing => existing.document_id === doc.document_id)) uploaded.push(doc)
    }
    return uploaded
  }

  async function askTutor() {
    const question = prompt.trim()
    if (pending.current || !question) return
    const message: ChatMessage = { id: crypto.randomUUID(), role: 'user', text: question }
    pending.current = true
    setAsking(true)
    setError('')
    setPrompt('')
    setMessages([...messages, message])
    try {
      const docs = await uploadSelected()
      const reply = await askAgent(question, sessionId, docs.map(doc => doc.name).join(', '),
        docs.map(doc => doc.document_id), messages)
      setMessages([...messages, message, reply])
    } catch (error) {
      setMessages(messages)
      setPrompt(question)
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      pending.current = false
      setAsking(false)
    }
  }

  async function generate() {
    if (pending.current || !files.length || (tests && total < files.length)) return
    pending.current = true
    setError('')
    setStatus(files.length === 1 ? 'Uploading lecture…' : 'Uploading lectures…')
    try {
      const uploaded = await uploadSelected()
      const instructions = prompt.trim()
      const conversation = { id: sessionId, messages }
      if (tests) {
        setStatus(`Generating questions (0/${total})…`)
        const questions = await createTest(uploaded, counts, difficulty,
          (completed, count) => setStatus(`Generating questions (${completed}/${count})…`), instructions)
        onTestCreated(uploaded, questions, mounted.current, conversation)
      } else {
        const doc = uploaded[0]
        setStatus('Building your concept map…')
        const lecture = instructions ? await createPersonalizedOutline(doc, instructions)
          : await createSlideOutline(doc, page => request<SlideText>(`documents/${doc.document_id}/pages/${page}`))
        onMapCreated(doc, lecture, mounted.current, conversation)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error))
    } finally {
      pending.current = false
      setStatus('')
    }
  }

  return <main className="creation-workspace">
    <section className="creation-content" aria-labelledby="creation-title">
      <header>
        <h1 id="creation-title">{tests ? 'Create a practice test' : 'Create a concept map'}</h1>
        <p>{tests ? 'Upload lecture slides and choose how you want to practice.'
          : 'Turn a lecture into an interactive concept map and study notes.'}</p>
      </header>
      <form className="creation-card" onSubmit={event => { event.preventDefault(); void generate() }}>
        <input ref={input} type="file" aria-label="Upload lecture files" accept=".pdf,.pptx" multiple={tests}
          hidden disabled={busy} onChange={event => {
            addFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}/>
        <button className="creation-drop" data-dragging={dragging} type="button" disabled={busy}
          onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(!busy) }}
          onDragLeave={() => setDragging(false)} onDrop={event => {
            event.preventDefault()
            setDragging(false)
            addFiles(Array.from(event.dataTransfer.files))
          }}>
          <span className="creation-drop__icon"><Icon name="file" size={22}/></span>
          <span><strong>Choose or drop {tests ? 'lecture files' : 'a lecture file'}</strong>
            <small>{tests ? 'Up to five PDF or PPTX files' : 'One PDF or PPTX file'}</small></span>
        </button>
        {files.length > 0 && <ul className="creation-files">{files.map((file, index) => <li key={`${file.name}-${file.lastModified}`}>
          <Icon name="file" size={16}/><span title={file.name}>{file.name}</span>
          <button className="icon-button" type="button" disabled={busy} aria-label={`Remove ${file.name}`}
            onClick={() => { setFiles(current => current.filter((_, position) => position !== index)); setError('') }}><Icon name="close" size={16}/></button>
        </li>)}</ul>}
        {(asking || messages.length > 0) && <section className="creation-tutor" aria-label="AI Tutor">
          <div className="creation-tutor__heading"><Icon name="chat" size={16}/>AI Tutor</div>
          <ChatTranscript messages={messages} busy={asking}/>
        </section>}
        <div className="creation-composer">
          <label htmlFor="creation-message">Message AI Tutor or add generation instructions</label>
          <textarea ref={composer} id="creation-message" rows={3} maxLength={promptLimit} disabled={busy} value={prompt}
            placeholder={tests ? 'Focus on calculations and use realistic examples.' : 'Highlight the key formulas and keep the study notes concise.'}
            onChange={event => setPrompt(event.target.value)}/>
          <div className="creation-composer__actions">
            <button className="button button--secondary" type="button" disabled={busy || !prompt.trim()}
              onClick={() => void askTutor()}><Icon name="chat" size={15}/>Ask AI Tutor</button>
          </div>
        </div>
        <div className="creation-prompt-suggestions" role="group" aria-label="Suggested generation prompts">
          {promptSuggestions[mode].map(({ label, text }) => {
            const draft = prompt.trimEnd()
            const next = draft ? `${draft}\n${text}` : text
            return <button key={label} type="button" title={text}
              disabled={busy || next.length > promptLimit || draft.split('\n').includes(text)}
              onClick={() => {
                setPrompt(next)
                composer.current?.focus()
              }}>{label}</button>
          })}
        </div>
        {tests && <fieldset className="creation-options" disabled={busy}>
          <legend>Question types</legend>
          <div className="creation-counts">
            {questionTypes.map(({ type, label }) => <div className="creation-count" key={type}>
              <span>{label}</span><div className="creation-stepper">
                <button type="button" aria-label={`Remove ${label}`} disabled={!counts[type]}
                  onClick={() => setCounts(value => ({ ...value, [type]: value[type] - 1 }))}>−</button>
                <output aria-label={`${label} count`}>{counts[type]}</output>
                <button type="button" aria-label={`Add ${label}`} disabled={total >= maxQuestions}
                  onClick={() => setCounts(value => ({ ...value, [type]: value[type] + 1 }))}>+</button>
              </div>
            </div>)}
          </div>
          <label className="creation-difficulty">Difficulty
            <select value={difficulty} onChange={event => setDifficulty(event.target.value as Difficulty)}>
              <option>Mixed</option><option>Foundational</option><option>Advanced</option>
            </select>
          </label>
        </fieldset>}
        {error && <p className="creation-error" role="alert">{error}</p>}
        {tests && files.length > total && <p className="creation-status">Choose at least one question per lecture file.</p>}
        <div className="creation-footer">
          <span aria-live="polite">{status || (tests ? `${total} of ${maxQuestions} questions` : '')}</span>
          <button className="button button--primary" type="submit" disabled={busy || !files.length || (tests && total < files.length)}>
            {tests ? 'Generate test' : 'Generate concept map'}<Icon name="chevron" size={16}/>
          </button>
        </div>
      </form>
    </section>
  </main>
}

function EvidenceList({ citations, onPage }: { citations: EvidenceHit[]; onPage: (page: number) => void }) {
  if (!citations.length) return null
  return <div className="question-evidence">{citations.map(hit => <details key={hit.chunk_id}>
    <summary>Evidence · page {hit.page}</summary>
    <p>{hit.text}</p>
    <button onClick={() => onPage(hit.page)}>Open page {hit.page}</button>
  </details>)}</div>
}

export function SavedQuestionSet({ item, onQuestion, onResponse, onPage }: {
  item: SavedTest
  onQuestion: (index: number) => void
  onResponse: (index: number, response: string) => void
  onPage: (page: number) => void
}) {
  const { current, questions, responses } = item
  const question = questions[current]
  return <div className="live-content saved-test">
    <nav aria-label="Question navigation">{questions.map((_, index) => <button type="button" key={index}
      aria-label={`Question ${index + 1}`} aria-pressed={index === current} onClick={() => onQuestion(index)}>
      {index + 1}
    </button>)}</nav>
    <article>
      <p className="eyebrow">Question {current + 1} of {questions.length} · {question.concept}</p>
      <h3>{question.prompt}</h3>
      <label>Your draft answer
        <textarea value={responses[current] ?? ''} onChange={event => onResponse(current, event.target.value)}/>
      </label>
      <EvidenceList citations={question.citations} onPage={onPage}/>
    </article>
  </div>
}
