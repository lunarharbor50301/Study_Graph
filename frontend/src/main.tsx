import React, { FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { askAgent, loadLecture } from './api'
import { lecture as fallbackLecture, sampleQuestions, starterMessages } from './data'
import type { ChatMessage, Concept, DetailLevel, Lecture, Mode, QuestionProgress, TestQuestion } from './types'
import './style.css'

type IconName = 'book' | 'brain' | 'chat' | 'check' | 'chevron' | 'close' | 'expand' | 'file' | 'graph' | 'help' | 'home' | 'learn' | 'menu' | 'minus' | 'next' | 'previous' | 'sparkle' | 'test'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v15h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></>,
    brain: <><path d="M9.5 4.5A3 3 0 0 0 4 6.2a3.2 3.2 0 0 0 .6 6.2A3 3 0 0 0 9.5 16"/><path d="M14.5 4.5A3 3 0 0 1 20 6.2a3.2 3.2 0 0 1-.6 6.2 3 3 0 0 1-4.9 3.6M12 3v18M7.5 8.5H12M16.5 8.5H12M8 14h4m4 0h-4"/></>,
    chat: <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>,
    check: <path d="m5 12 4 4L19 6"/>, chevron: <path d="m9 18 6-6-6-6"/>, close: <path d="M6 6l12 12M18 6 6 18"/>,
    expand: <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></>,
    graph: <><circle cx="5" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="12" r="2"/><circle cx="12" cy="19" r="2"/><path d="m6.5 10.5 4-4m3 0 4 4m0 3-4 4m-3 0-4-4"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.5 2.2c-.8.4-1.2.9-1.2 1.8M12 17h.01"/></>,
    home: <><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></>,
    learn: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>, minus: <path d="M5 12h14"/>, next: <path d="m9 18 6-6-6-6"/>, previous: <path d="m15 18-6-6 6-6"/>,
    sparkle: <><path d="m12 3 1.1 3.2L16 8l-2.9 1.8L12 13l-1.1-3.2L8 8l2.9-1.8z"/><path d="m19 14 .7 2.1L22 17.5l-2.3 1.4L19 21l-.7-2.1-2.3-1.4 2.3-1.4zM5 13l.7 2L8 16.2l-2.3 1.3L5 20l-.7-2.5L2 16.2 4.3 15z"/></>,
    test: <><path d="M9 3h6l1 3h3v16H5V6h3z"/><path d="M9 6h6M9 12h6M9 16h4"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function Panel({ id, title, subtitle, icon, canClose, hidden, expanded, onClose, onExpand, children, className = '' }: {
  id: string; title: string; subtitle?: string; icon: IconName; canClose?: boolean; hidden?: boolean; expanded: string | null
  onClose?: () => void; onExpand: () => void; children: ReactNode; className?: string
}) {
  if (hidden) return null
  const isExpanded = expanded === id
  return <section id={`panel-${id}`} className={`panel ${className} ${isExpanded ? 'panel--expanded' : ''}`} aria-label={title}>
    <div className="panel__header">
      <div className="panel__heading"><span className="panel__icon"><Icon name={icon}/></span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
      <div className="panel__actions">
        <button className="icon-button" onClick={onExpand} aria-label={isExpanded ? `Restore ${title}` : `Expand ${title}`} title={isExpanded ? 'Restore panel' : 'Expand panel'}><Icon name={isExpanded ? 'minus' : 'expand'} size={17}/></button>
        {canClose && <button className="icon-button" onClick={onClose} aria-label={`Close ${title}`} title="Close panel"><Icon name="close" size={17}/></button>}
      </div>
    </div>
    <div className="panel__body">{children}</div>
  </section>
}

function SplitHandle({ axis, label, controls, value, onChange }: {
  axis: 'x' | 'y'
  label: string
  controls: string
  value: number
  onChange: (value: number) => void
}) {
  const drag = useRef<{ start: number; value: number; available: number } | null>(null)
  const horizontalMovement = axis === 'x'
  const dimension = horizontalMovement ? 'width' : 'height'
  const coordinate = horizontalMovement ? 'clientX' : 'clientY'
  const updateValue = (next: number) => onChange(Math.min(100, Math.max(0, next)))

  return <div
    className={`split-handle split-handle--${axis}`}
    role="separator"
    tabIndex={0}
    aria-label={label}
    aria-controls={controls}
    aria-orientation={horizontalMovement ? 'vertical' : 'horizontal'}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(value)}
    title={label}
    onPointerDown={event => {
      if (event.button !== 0 || !event.isPrimary) return
      const handle = event.currentTarget
      const layout = handle.parentElement!
      const styles = getComputedStyle(layout)
      const primaryMin = parseFloat(styles.getPropertyValue('--split-primary-min'))
      const secondaryMin = parseFloat(styles.getPropertyValue('--split-secondary-min'))
      const available = layout.getBoundingClientRect()[dimension]
        - handle.getBoundingClientRect()[dimension] - primaryMin - secondaryMin
      if (available <= 0) return

      event.preventDefault()
      handle.focus({ preventScroll: true })
      handle.setPointerCapture(event.pointerId)
      drag.current = { start: event[coordinate], value, available }
    }}
    onPointerMove={event => {
      const active = drag.current
      if (!active || !event.currentTarget.hasPointerCapture(event.pointerId)) return
      updateValue(active.value + (event[coordinate] - active.start) / active.available * 100)
    }}
    onLostPointerCapture={() => { drag.current = null }}
    onKeyDown={event => {
      const decrease = horizontalMovement ? 'ArrowLeft' : 'ArrowUp'
      const increase = horizontalMovement ? 'ArrowRight' : 'ArrowDown'
      if (event.key === decrease) updateValue(value - 5)
      else if (event.key === increase) updateValue(value + 5)
      else if (event.key === 'Home') updateValue(0)
      else if (event.key === 'End') updateValue(100)
      else return
      event.preventDefault()
    }}
  />
}

function Navigation({ mode, onMode, chatVisible, viewerVisible, onRestoreChat, onRestoreViewer, questionCounts, setQuestionCounts }: {
  mode: Mode; onMode: (mode: Mode) => void; chatVisible: boolean; viewerVisible: boolean; onRestoreChat: () => void; onRestoreViewer: () => void
  questionCounts: Record<string, number>; setQuestionCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
}) {
  const controls = [
    { id: 'multiple-choice', label: 'Multiple choice' },
    { id: 'true-false', label: 'True / False' },
    { id: 'short-answer', label: 'Short answer' },
  ]
  return <aside className="sidebar">
    <div className="brand"><div className="brand__mark"><Icon name="graph" size={22}/></div><div><strong>StudyGraph</strong><span>Learn with evidence</span></div></div>
    <div className="sidebar__section"><span className="sidebar__label">Workspace</span>
      <button className={`nav-item ${mode === 'learn' ? 'nav-item--active' : ''}`} onClick={() => onMode('learn')}><Icon name="learn"/><span><b>Learning</b><small>Explore concepts</small></span></button>
      <button className={`nav-item ${mode === 'test' ? 'nav-item--active' : ''}`} onClick={() => onMode('test')}><Icon name="test"/><span><b>Test</b><small>Practice & review</small></span></button>
    </div>
    {mode === 'learn' ? <>
      <div className="sidebar__section"><span className="sidebar__label">Learning tools</span>
        <div className="tool-row"><Icon name="graph"/><div><b>Concept map</b><small>8 lecture concepts</small></div><span className="status-dot"/></div>
        <div className="tool-row"><Icon name="book"/><div><b>Study notes</b><small>Page-linked details</small></div><span className="status-dot"/></div>
      </div>
      <div className="learning-tip"><Icon name="sparkle"/><p><b>Suggested path</b>Start with the transformation hierarchy, then compare CPU and GPU design.</p></div>
    </> : <div className="sidebar__section test-builder"><div className="builder-heading"><span className="sidebar__label">Test builder</span><span>5 questions</span></div>
      {controls.map(control => <label key={control.id} className="stepper"><span>{control.label}</span><span><button onClick={() => setQuestionCounts(v => ({...v, [control.id]: Math.max(0, v[control.id] - 1)}))} aria-label={`Remove ${control.label}`}><Icon name="minus" size={14}/></button><b>{questionCounts[control.id]}</b><button onClick={() => setQuestionCounts(v => ({...v, [control.id]: Math.min(9, v[control.id] + 1)}))} aria-label={`Add ${control.label}`}>+</button></span></label>)}
      <label className="select-label">Difficulty<select defaultValue="Mixed"><option>Mixed</option><option>Foundational</option><option>Advanced</option></select></label>
      <button className="button button--secondary button--full"><Icon name="sparkle"/> Regenerate test</button>
      <p className="builder-note">The sample test uses all selected lecture pages. Generation can be connected to the backend later.</p>
    </div>}
    {(!chatVisible || !viewerVisible) && <div className="sidebar__section restore-section"><span className="sidebar__label">Hidden panels</span>
      {!chatVisible && <button onClick={onRestoreChat}><Icon name="chat"/>Restore AI tutor</button>}
      {!viewerVisible && <button onClick={onRestoreViewer}><Icon name="file"/>Restore lecture</button>}
    </div>}
    <div className="sidebar__footer"><div className="avatar">LS</div><div><b>Student workspace</b><small>Lecture 1 loaded</small></div></div>
  </aside>
}

function ConceptGraph({ lecture, selected, onSelect, onOpenNote }: { lecture: Lecture; selected: Concept; onSelect: (concept: Concept) => void; onOpenNote: () => void }) {
  const byId = useMemo(() => new Map(lecture.concepts.map(c => [c.id, c])), [lecture])
  return <div className="concept-map" role="group" aria-label="Interactive concept map">
    <div className="map-legend"><span><i className="legend-dot legend-dot--selected"/>Selected concept</span><span><i className="legend-line"/>Knowledge relation</span><span>Click a node to study</span></div>
    <div className="map-canvas">
      <svg className="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {lecture.relations.map(relation => {
          const source = byId.get(relation.source)!, target = byId.get(relation.target)!
          return <g key={`${relation.source}-${relation.target}`}><line x1={source.position.x + 8} y1={source.position.y + 5} x2={target.position.x + 8} y2={target.position.y + 5}/><circle cx={(source.position.x + target.position.x) / 2 + 8} cy={(source.position.y + target.position.y) / 2 + 5} r=".75"/></g>
        })}
      </svg>
      {lecture.concepts.map(concept => <button key={concept.id} className={`concept-node ${selected.id === concept.id ? 'concept-node--selected' : ''}`} style={{ left: `${concept.position.x}%`, top: `${concept.position.y}%` }} onClick={() => onSelect(concept)}>
        <span className="concept-node__dot"/><span>{concept.shortName}</span><small>p. {concept.page}</small>
      </button>)}
      <div className="relation-label label-1">coordinates</div><div className="relation-label label-2">uses</div><div className="relation-label label-3">modeled by</div>
    </div>
    <div className="selected-summary"><div><span className="eyebrow">Current focus · Page {selected.page}</span><h3>{selected.name}</h3><p>{selected.summary}</p></div><button className="button button--primary" onClick={onOpenNote}>Open study note <Icon name="chevron" size={16}/></button></div>
  </div>
}

function StudyNote({ concept, level, onLevel, onCitation, onBack }: { concept: Concept; level: DetailLevel; onLevel: (level: DetailLevel) => void; onCitation: () => void; onBack: () => void }) {
  return <article className="study-note">
    <div className="note-toolbar"><button className="back-to-map" onClick={onBack}><Icon name="previous" size={15}/>Concept map</button><div className="segmented"><button className={level === 'concise' ? 'active' : ''} onClick={() => onLevel('concise')}>Concise</button><button className={level === 'detailed' ? 'active' : ''} onClick={() => onLevel('detailed')}>Detailed</button></div></div>
    <header className="note-hero"><span className="eyebrow">{concept.eyebrow}</span><h3>{concept.name}</h3><p>{concept.summary}</p><button className="citation" onClick={onCitation}><Icon name="file" size={14}/>{fallbackLecture.fileName} · p. {concept.page}</button></header>
    {level === 'detailed' && <section className="note-section"><h4>How it works</h4><p>{concept.detail}</p></section>}
    {concept.formula && <section className="formula-card"><span>Key relationship</span><strong>{concept.formula}</strong></section>}
    <section className="note-section"><h4>Key points</h4><ul>{concept.keyPoints.map(point => <li key={point}><span><Icon name="check" size={14}/></span>{point}</li>)}</ul></section>
    {level === 'detailed' && <section className="source-card"><div><Icon name="book"/><span><b>Lecture evidence</b><small>Directly grounded in the uploaded material</small></span></div><blockquote>“{concept.sourceText}”</blockquote><button onClick={onCitation}>Locate on slide <Icon name="chevron" size={15}/></button></section>}
  </article>
}

function LearningPanel({ lecture, selected, onSelect, onPage }: { lecture: Lecture; selected: Concept; onSelect: (concept: Concept) => void; onPage: (page: number) => void }) {
  const [view, setView] = useState<'map' | 'note'>('map')
  const [level, setLevel] = useState<DetailLevel>('detailed')
  const choose = (concept: Concept) => { onSelect(concept); onPage(concept.page) }
  return <><div className="content-tabs"><button className={view === 'map' ? 'active' : ''} onClick={() => setView('map')}><Icon name="graph"/>Concept map</button><button className={view === 'note' ? 'active' : ''} onClick={() => setView('note')}><Icon name="book"/>Study note</button><span className="grounded-badge"><Icon name="check" size={13}/>Lecture-grounded</span></div>
    {view === 'map' ? <ConceptGraph lecture={lecture} selected={selected} onSelect={choose} onOpenNote={() => setView('note')}/> : <StudyNote concept={selected} level={level} onLevel={setLevel} onCitation={() => onPage(selected.page)} onBack={() => setView('map')}/>}
  </>
}

function QuestionInput({ question, progress, onResponse }: { question: TestQuestion; progress: QuestionProgress; onResponse: (response: string) => void }) {
  if (question.options) return <div className="answer-options">{question.options.map((option, index) => <label key={option} className={`answer-option ${progress.response === option ? 'answer-option--selected' : ''} ${progress.submitted && option === question.answer ? 'answer-option--correct' : ''} ${progress.submitted && progress.response === option && option !== question.answer ? 'answer-option--wrong' : ''}`}>
    <input type="radio" name={question.id} value={option} checked={progress.response === option} disabled={progress.submitted} onChange={() => onResponse(option)}/><span className="option-marker">{question.type === 'true-false' ? <Icon name={option === 'True' ? 'check' : 'close'} size={16}/> : String.fromCharCode(65 + index)}</span><span>{option}</span>
  </label>)}</div>
  return <label className="written-answer"><span>Your answer</span><textarea placeholder="Show your reasoning or enter a concise answer…" value={progress.response} disabled={progress.submitted} onChange={event => onResponse(event.target.value)}/><small>Your response is checked against the lecture-based reference answer.</small></label>
}

function TestPanel({ current, question, progress, allProgress, onCurrent, onResponse, onHint, onSubmit, onRetry, onReveal }: {
  current: number; question: TestQuestion; progress: QuestionProgress; allProgress: Record<string, QuestionProgress>
  onCurrent: (index: number) => void; onResponse: (value: string) => void; onHint: () => void; onSubmit: () => void; onRetry: () => void; onReveal: () => void
}) {
  const completed = Object.values(allProgress).filter(p => p.correct).length
  return <div className="test-workspace">
    <div className="test-topbar"><div><span className="eyebrow">Lecture review</span><h3>AI Computing Foundations</h3></div><div className="test-score"><b>{completed}/{sampleQuestions.length}</b><span>correct</span></div></div>
    <div className="question-progress" aria-label="Question navigation">{sampleQuestions.map((item, index) => { const itemProgress = allProgress[item.id]; return <button key={item.id} onClick={() => onCurrent(index)} className={`${index === current ? 'current' : ''} ${itemProgress?.correct ? 'correct' : itemProgress?.submitted ? 'wrong' : ''}`}><span>{itemProgress?.correct ? <Icon name="check" size={13}/> : index + 1}</span><small>{item.type === 'multiple-choice' ? 'MCQ' : item.type === 'true-false' ? 'T/F' : 'Short'}</small></button>})}<div className="progress-line"><span style={{width: `${(completed / sampleQuestions.length) * 100}%`}}/></div></div>
    <article className="question-card">
      <div className="question-meta"><span>Question {current + 1} of {sampleQuestions.length}</span><span>{question.type.replace('-', ' ')}</span><span><Icon name="file" size={13}/>Page {question.page}</span></div>
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
    <div className="question-nav"><button disabled={current === 0} onClick={() => onCurrent(current - 1)}><Icon name="previous"/>Previous</button><span>Responses are saved automatically</span><button disabled={current === sampleQuestions.length - 1} onClick={() => onCurrent(current + 1)}>Next<Icon name="next"/></button></div>
  </div>
}

function ChatPanel({ mode, concept, question, onCitation }: { mode: Mode; concept: Concept; question: TestQuestion; onCitation: (page: number) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ id: 'welcome', role: 'assistant', text: starterMessages[mode] }])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const sessionId = useMemo(() => {
    const stored = sessionStorage.getItem('studygraph-session')
    if (stored) return stored
    const next = crypto.randomUUID(); sessionStorage.setItem('studygraph-session', next); return next
  }, [])
  useEffect(() => { setMessages([{ id: `${mode}-welcome`, role: 'assistant', text: starterMessages[mode] }]) }, [mode])
  const suggestions = mode === 'learn' ? [`Explain ${concept.shortName} simply`, 'How is it related to the previous concept?', 'Give me one practice question'] : ['Clarify the question without giving the answer', 'What concept should I review?', 'Check my reasoning approach']
  function fallbackAnswer(prompt: string) {
    if (mode === 'test') return `Focus on ${fallbackLecture.concepts.find(c => c.id === question.conceptId)?.name}. ${question.hint} I will keep the final answer hidden until you submit.`
    if (/practice|question/i.test(prompt)) return `Quick check: ${concept.keyPoints[0]} Can you explain why this matters in one sentence?`
    return `${concept.summary} ${concept.detail} The supporting material is on page ${concept.page}.`
  }
  async function send(event?: FormEvent, suggested?: string) {
    event?.preventDefault(); const prompt = (suggested ?? input).trim(); if (!prompt || busy) return
    setInput(''); setMessages(value => [...value, { id: crypto.randomUUID(), role: 'user', text: prompt }]); setBusy(true)
    const response = await askAgent(prompt, mode === 'learn' ? concept.id : question.conceptId, sessionId)
    const citationPage = response?.citations?.[0]?.page ?? (mode === 'learn' ? concept.page : question.page)
    setMessages(value => [...value, { id: crypto.randomUUID(), role: 'assistant', text: response?.answer ?? fallbackAnswer(prompt), page: citationPage }]); setBusy(false)
  }
  return <div className="chat-layout"><div className="chat-context"><span><Icon name={mode === 'learn' ? 'book' : 'test'} size={14}/>{mode === 'learn' ? `Discussing: ${concept.name}` : `Question ${sampleQuestions.indexOf(question) + 1}: ${fallbackLecture.concepts.find(c => c.id === question.conceptId)?.name}`}</span><small>Source-linked answers</small></div>
    <div className="chat-messages" aria-live="polite">{messages.map(message => <div key={message.id} className={`message message--${message.role}`}>{message.role === 'assistant' && <span className="assistant-avatar"><Icon name="sparkle" size={15}/></span>}<div><p>{message.text}</p>{message.page && <button onClick={() => onCitation(message.page!)}><Icon name="file" size={13}/>View source · p. {message.page}</button>}</div></div>)}{busy && <div className="message message--assistant"><span className="assistant-avatar"><Icon name="sparkle" size={15}/></span><div className="typing"><i/><i/><i/></div></div>}</div>
    <div className="suggestions">{suggestions.map(suggestion => <button key={suggestion} onClick={() => send(undefined, suggestion)}>{suggestion}</button>)}</div>
    <form className="chat-input" onSubmit={send}><textarea aria-label="Message AI tutor" placeholder={mode === 'learn' ? 'Ask about this concept…' : 'Discuss your reasoning…'} value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }}/><button disabled={!input.trim() || busy} aria-label="Send message"><Icon name="chevron"/></button><span>Enter to send · Shift + Enter for a new line</span></form>
  </div>
}

function SlideArtwork({ concept }: { concept: Concept }) {
  if (concept.id === 'roofline') return <div className="roofline-chart"><div className="axis axis--y">Performance</div><div className="axis axis--x">Arithmetic intensity</div><svg viewBox="0 0 500 260"><path d="M45 225 L230 55 L460 55"/><line x1="230" y1="55" x2="230" y2="225" strokeDasharray="5 5"/><text x="80" y="175">memory-bound</text><text x="320" y="42">compute-bound</text><text x="238" y="245">ridge point</text></svg></div>
  if (concept.id === 'amdahl') return <div className="speedup-chart"><svg viewBox="0 0 500 250"><path className="chart-axis" d="M48 20v195h420"/><path d="M50 210 C100 150 160 110 220 88 S360 62 460 57"/><path className="chart-limit" d="M50 55h410" strokeDasharray="6 6"/><text x="270" y="45">Serial fraction limits speedup</text><text x="360" y="235">Processors</text><text x="8" y="25">Speedup</text></svg></div>
  if (concept.id === 'simt' || concept.id === 'divergence') return <div className="warp-grid"><span className="warp-label">Warp · 32 threads</span>{Array.from({ length: 32 }, (_, i) => <i key={i} className={concept.id === 'divergence' && i > 15 ? 'inactive' : ''}>{i}</i>)}</div>
  if (concept.id === 'pipeline') return <div className="pipeline-diagram">{['IF', 'ID', 'EX', 'MEM', 'WB'].map((stage, index) => <React.Fragment key={stage}><span>{stage}<small>{['Fetch', 'Decode', 'Execute', 'Memory', 'Write back'][index]}</small></span>{index < 4 && <Icon name="chevron"/>}</React.Fragment>)}</div>
  if (concept.id === 'hierarchy') return <div className="hierarchy-diagram">{['Application / Problem', 'Algorithm', 'Program / Language', 'System Software', 'Operating System', 'Microarchitecture', 'Digital Logic'].map((layer, index) => <span key={layer} className={index === 5 ? 'highlight' : ''}>{layer}</span>)}</div>
  return <div className="architecture-diagram"><div className="chip chip--cpu"><b>CPU</b><span>Host controller</span></div><div className="bus">PCIe / NVLink <Icon name="chevron"/></div><div className="chip chip--gpu"><b>GPU</b><span>Compute engine</span><div>{Array.from({ length: 12 }, (_, i) => <i key={i}/>)}</div></div></div>
}

function LectureViewer({ lecture, page, selected, onPage, evidenceVisible, setEvidenceVisible }: { lecture: Lecture; page: number; selected: Concept; onPage: (page: number) => void; evidenceVisible: boolean; setEvidenceVisible: (visible: boolean) => void }) {
  const pageConcept = lecture.concepts.find(concept => concept.page === page) ?? selected
  return <div className="viewer-layout"><div className="file-strip"><span className="pdf-mark">PDF</span><div><b>{lecture.fileName}</b><small>{lecture.totalPages} pages · Text and layout extracted</small></div><span className="ready-badge"><i/>Ready</span></div>
    <div className="viewer-toolbar"><button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} aria-label="Previous page"><Icon name="previous"/></button><label>Page<input type="number" min="1" max={lecture.totalPages} value={page} onChange={event => onPage(Math.max(1, Math.min(lecture.totalPages, Number(event.target.value))))}/><span>of {lecture.totalPages}</span></label><button onClick={() => onPage(Math.min(lecture.totalPages, page + 1))} disabled={page >= lecture.totalPages} aria-label="Next page"><Icon name="next"/></button><button className={`evidence-toggle ${evidenceVisible ? 'active' : ''}`} onClick={() => setEvidenceVisible(!evidenceVisible)}><Icon name="sparkle" size={14}/>Evidence</button></div>
    <div className="slide-stage"><article className="slide-page"><div className="slide-brand">Advanced AI Computing and Systems <span>Lecture 1</span></div><div className="slide-accent"/><span className="slide-kicker">{pageConcept.eyebrow}</span><h3>{pageConcept.name}</h3><div className="slide-content"><ul>{pageConcept.keyPoints.map(point => <li key={point}>{point}</li>)}</ul><SlideArtwork concept={pageConcept}/></div>{pageConcept.formula && <div className="slide-formula">{pageConcept.formula}</div>}{evidenceVisible && <div className="evidence-highlight"><span><Icon name="sparkle" size={13}/>Source evidence</span></div>}<span className="slide-number">{page}</span></article></div>
    <div className="evidence-panel"><div><span className="eyebrow">Selected evidence</span><p>{pageConcept.sourceText}</p></div><button onClick={() => setEvidenceVisible(!evidenceVisible)}>{evidenceVisible ? 'Hide highlight' : 'Highlight on slide'}</button></div>
  </div>
}

function createProgress(): Record<string, QuestionProgress> {
  return Object.fromEntries(sampleQuestions.map(question => [question.id, { response: '', submitted: false, correct: null, hintVisible: false, answerVisible: false, attempts: 0 }]))
}

function normalize(value: string) { return value.toLowerCase().replace(/[×x]/g, 'x').replace(/[^a-z0-9]+/g, ' ').trim() }

function App() {
  const [loadedLecture, setLecture] = useState<Lecture>(fallbackLecture)
  const [mode, setMode] = useState<Mode>('learn')
  const [selectedId, setSelectedId] = useState('hierarchy')
  const [page, setPage] = useState(6)
  const [chatVisible, setChatVisible] = useState(true)
  const [viewerVisible, setViewerVisible] = useState(true)
  const [workspaceShare, setWorkspaceShare] = useState(68)
  const [mainShare, setMainShare] = useState(83)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [evidenceVisible, setEvidenceVisible] = useState(true)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [progress, setProgress] = useState<Record<string, QuestionProgress>>(createProgress)
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({ 'multiple-choice': 2, 'true-false': 1, 'short-answer': 2 })
  useEffect(() => { void loadLecture().then(setLecture) }, [])
  const selected = loadedLecture.concepts.find(concept => concept.id === selectedId) ?? loadedLecture.concepts[0]
  const question = sampleQuestions[currentQuestion]
  const questionProgress = progress[question.id]
  const toggleExpand = (id: string) => setExpanded(value => value === id ? null : id)
  const selectConcept = (concept: Concept) => { setSelectedId(concept.id); setPage(concept.page); setEvidenceVisible(true) }
  const switchMode = (next: Mode) => { setMode(next); setExpanded(null); if (next === 'test') { const q = sampleQuestions[currentQuestion]; setSelectedId(q.conceptId); setPage(q.page) } else setPage(selected.page) }
  const chooseQuestion = (index: number) => { const next = Math.max(0, Math.min(sampleQuestions.length - 1, index)); setCurrentQuestion(next); setSelectedId(sampleQuestions[next].conceptId); setPage(sampleQuestions[next].page); setEvidenceVisible(true) }
  const updateCurrent = (update: Partial<QuestionProgress>) => setProgress(value => ({ ...value, [question.id]: { ...value[question.id], ...update } }))
  const submit = () => {
    const accepted = [question.answer, ...(question.acceptedAnswers ?? [])].map(normalize)
    const response = normalize(questionProgress.response)
    const correct = accepted.some(answer => response === answer || (question.type === 'short-answer' && response.includes(answer)))
    updateCurrent({ submitted: true, correct, attempts: questionProgress.attempts + 1 })
  }
  const currentMainTitle = mode === 'learn' ? 'Knowledge explorer' : 'Practice test'
  return <div className="app-shell">
    <Navigation mode={mode} onMode={switchMode} chatVisible={chatVisible} viewerVisible={viewerVisible} onRestoreChat={() => setChatVisible(true)} onRestoreViewer={() => setViewerVisible(true)} questionCounts={questionCounts} setQuestionCounts={setQuestionCounts}/>
    <div className={`study-area ${viewerVisible ? 'study-area--with-viewer' : ''}`} style={{ '--split-share': workspaceShare / 100 } as React.CSSProperties}>
      <main id="study-workspace" className={`workspace ${chatVisible ? 'workspace--with-chat' : ''}`} style={{ '--split-share': mainShare / 100 } as React.CSSProperties}>
        <Panel id="main" title={currentMainTitle} subtitle={mode === 'learn' ? 'Explore the lecture as a connected knowledge structure' : 'Answer, get feedback, and retry'} icon={mode === 'learn' ? 'brain' : 'test'} expanded={expanded} onExpand={() => toggleExpand('main')} className="panel--main">
          {mode === 'learn' ? <LearningPanel lecture={loadedLecture} selected={selected} onSelect={selectConcept} onPage={setPage}/> : <TestPanel current={currentQuestion} question={question} progress={questionProgress} allProgress={progress} onCurrent={chooseQuestion} onResponse={response => updateCurrent({ response })} onHint={() => updateCurrent({ hintVisible: !questionProgress.hintVisible })} onSubmit={submit} onRetry={() => updateCurrent({ submitted: false, correct: null, answerVisible: false })} onReveal={() => updateCurrent({ answerVisible: !questionProgress.answerVisible })}/>}
        </Panel>
        {chatVisible && <SplitHandle axis="y" label="Resize main panel and AI tutor" controls="panel-main" value={mainShare} onChange={setMainShare}/>}
        <Panel id="chat" title="AI tutor" subtitle={mode === 'learn' ? 'Ask, compare, and practice' : 'Discuss your reasoning without spoilers'} icon="chat" canClose hidden={!chatVisible} expanded={expanded} onClose={() => { setChatVisible(false); if (expanded === 'chat') setExpanded(null) }} onExpand={() => toggleExpand('chat')} className="panel--chat">
          <ChatPanel mode={mode} concept={selected} question={question} onCitation={citation => { setPage(citation); setViewerVisible(true); setEvidenceVisible(true) }}/>
        </Panel>
      </main>
      {viewerVisible && <SplitHandle axis="x" label="Resize workspace and lecture viewer" controls="study-workspace" value={workspaceShare} onChange={setWorkspaceShare}/>}
      <Panel id="viewer" title="Lecture viewer" subtitle="Source evidence from the uploaded material" icon="file" canClose hidden={!viewerVisible} expanded={expanded} onClose={() => { setViewerVisible(false); if (expanded === 'viewer') setExpanded(null) }} onExpand={() => toggleExpand('viewer')} className="panel--viewer">
        <LectureViewer lecture={loadedLecture} page={page} selected={selected} onPage={setPage} evidenceVisible={evidenceVisible} setEvidenceVisible={setEvidenceVisible}/>
      </Panel>
    </div>
  </div>
}

createRoot(document.getElementById('root')!).render(<App/>)
