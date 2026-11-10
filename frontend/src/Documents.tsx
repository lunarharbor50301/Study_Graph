import {Icon, Panel, SplitHandle} from './Layout'
import { useEffect, useState } from 'react'

type DocumentInfo = {
  document_id: string; name: string; page_count: number
  original_url: string; preview_mode: 'page_image' | 'slide_content'; pages_without_text: number[]
}
type Hit = {chunk_id: string; page: number; text: string}
type Group = {concept: string; citations: Hit[]; prompt?: string}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(typeof error.detail === 'string' ? error.detail : 'Request failed: ' + response.status)
  }
  return response.json()
}

export default function Documents() {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const [id, setId] = useState('')
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [answer, setAnswer] = useState('')
  const [stats, setStats] = useState('')
  const [tests, setTests] = useState(new URLSearchParams(location.search).has('tests'))
  const [concepts, setConcepts] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)
  const [session] = useState(() => crypto.randomUUID())
  const doc = docs.find(d => d.document_id === id)
  useEffect(() => {
    request<DocumentInfo[]>('/api/documents').then(list => {
      setDocs(list)
      setId(list[0]?.document_id ?? '')
    }).catch(e => setError(String(e))).finally(() => setBusy(false))
  }, [])
  function select(value: string) {
    setId(value); setPage(1); setHits([]); setAnswer(''); setError('')
    setQuery(''); setConcepts(''); setGroups([]); setStats('')
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function submit(ask: boolean) {
    setAnswer(''); setHits([]); setStats('')
    const options = (body: object) => ({method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)})
    if (ask) {
      const result = await request<{answer:string;provider:string;citations:Hit[];timing_ms:{retrieval:number;generation:number}}>('/api/ask',
        options({session_id:session, document_id:id, question:query}))
      setAnswer(result.answer)
      setStats((result.provider === 'extractive' ? 'Lecture excerpt' : 'TACC mode') +
        ' · Retrieval ' + result.timing_ms.retrieval + ' ms · Model ' + (result.timing_ms.generation/1000).toFixed(2) + ' s')
      setHits(result.citations)
    } else {
      const list = await request<Hit[]>('/api/documents/' + id + '/search', options({query}))
      setHits(list)
      if (!list.length) setAnswer('No matching passages.')
    }
  }
  const topics = [...new Set(concepts.split(',').map(s => s.trim()).filter(Boolean))]
  async function generate(useModel: boolean) {
    setGroups([]); setCurrent(0); setResponses({})
    const url = '/api/documents/' + id + '/'
    const options = {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({concepts:topics})}
    if (useModel) setGroups((await request<{questions:Group[]}>(url+'question-set', options)).questions)
    else setGroups(await request<Group[]>(url+'concept-evidence', options))
  }
  const preview = '/api/documents/' + id + '/pages/' + page + '/preview'
  const [share, setShare] = useState(62)
  const [expanded, setExpanded] = useState<string | null>(null)
  const toggle = (panel: string) => setExpanded(value => value === panel ? null : panel)
  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<number,string>>({})
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand__mark"><Icon name="graph"/></div><strong>StudyGraph</strong></div>
    <nav className="sidebar__section">{['Learning','Tests'].map((label,i)=><button key={label} className={'nav-item '+(tests===Boolean(i)?'nav-item--active':'')} disabled={busy} onClick={()=>{setTests(Boolean(i));setError('');history.replaceState(null,'',i?'?tests':'?documents')}}><Icon name={i?'test':'learn'}/>{label}</button>)}</nav>
    <div className="sidebar__section live-controls">
    <label>Upload a PDF or PPTX <input style={{width:'100%'}} type="file" accept=".pdf,.pptx" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) void run(async () => {
        const form = new FormData(); form.append('file',file)
        const d = await request<DocumentInfo>('/api/documents',{method:'POST',body:form})
        setDocs(list => [d,...list.filter(x => x.document_id !== d.document_id)]); select(d.document_id)
      })
    }}/></label>
    {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}
    {doc && <><p><select aria-label="Current lecture" value={id} disabled={busy} onChange={e=>select(e.target.value)}>
      {docs.map(d=><option key={d.document_id} value={d.document_id}>{d.name}</option>)}</select></p>
      </>}</div><a className="nav-item" href="?sample">Sample concept map</a></aside>
    <div className="study-area study-area--with-viewer" style={{'--split-share':share/100} as React.CSSProperties}>
    <Panel id="main" title={tests?'Practice test':'AI tutor'} subtitle={doc?.name} icon={tests?'test':'chat'} expanded={expanded} onExpand={()=>toggle('main')}>
    <div className="live-content">{!doc ? <p>Select or upload a lecture to begin.</p> : tests ? <><h2>Build a question set</h2><label>Enter up to five concepts, separated by commas.
        <textarea value={concepts} disabled={busy} onChange={e=>{setConcepts(e.target.value);setGroups([])}} placeholder="Memory bandwidth, arithmetic intensity"/></label>
        <nav>{[false,true].map(model=><button key={String(model)} disabled={busy||!topics.length||topics.length>5||topics.some(t=>t.length>120)} onClick={()=>void run(()=>generate(model))}>
          {model?'Generate set with TACC':'Find evidence'}</button>)}</nav>
        {groups.length>0 && <nav className="viewer-toolbar" aria-label="Question navigation">{groups.map((g,i)=><button key={g.concept} aria-pressed={current===i} onClick={()=>setCurrent(i)}>{i+1}</button>)}</nav>}
        {groups.slice(current,current+1).map(g=><article key={g.concept}><strong>{g.concept}</strong><p>{g.prompt}</p>{g.prompt && <label>Your draft answer<textarea value={responses[current]??''} onChange={e=>setResponses({...responses,[current]:e.target.value})}/></label>}
          {!g.citations.length && <p>No matching passage.</p>}{g.citations.map(h=><details key={h.chunk_id}><summary>Evidence · page {h.page}</summary><p>{h.text}</p><button onClick={()=>setPage(h.page)}>Open page {h.page}</button></details>)}</article>)}</> :
      <><h2>Ask the lecture</h2><form onSubmit={e=>{e.preventDefault();void run(()=>submit(true))}}>
        <input aria-label="Lecture question" placeholder="Ask a question in English" disabled={busy} value={query} onChange={e=>setQuery(e.target.value)}/>
        <button type="button" disabled={busy||!query.trim()} onClick={()=>void run(()=>submit(false))}>Search</button>
        <button disabled={busy||!query.trim()}>Ask</button></form>
      <small>{stats}</small><p>{answer}</p>{hits.map(hit=><p key={hit.chunk_id}><button onClick={()=>setPage(hit.page)}>Page {hit.page}</button> {hit.text}</p>)}</>}
    </div></Panel><SplitHandle axis="x" label="Resize lecture viewer" controls="panel-main" value={share} onChange={setShare}/>
    <Panel id="viewer" title="Lecture viewer" icon="file" expanded={expanded} onExpand={()=>toggle('viewer')}>{doc && <div className="live-content"><p>Page {page} of {doc.page_count} · <a href={doc.original_url}>Open original</a></p>
      {doc.pages_without_text.includes(page) && <p>This page has no searchable text.</p>}
      {doc.preview_mode === 'page_image' ? <img src={preview} alt={'Lecture page '+page} style={{width:'100%'}}/> :
        <iframe sandbox="" title="Slide content preview" src={preview} style={{width:'100%',height:380,border:0}}/>}
      <button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button> <button disabled={page===doc.page_count} onClick={()=>setPage(page+1)}>Next</button>
    </div>}</Panel></div></div>
}
