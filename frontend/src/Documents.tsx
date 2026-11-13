import { useEffect, useState } from 'react'

export type DocumentInfo = {
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

export default function Documents({tests, doc, onSelect, setPage}: {tests:boolean; doc:DocumentInfo|null; onSelect:(d:DocumentInfo)=>void; setPage:(p:number)=>void}) {
  const [docs, setDocs] = useState<DocumentInfo[]>([])
  const id = doc?.document_id ?? ''
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<Hit[]>([])
  const [answer, setAnswer] = useState('')
  const [concepts, setConcepts] = useState('')
  const [groups, setGroups] = useState<Group[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(true)

  useEffect(() => {
    request<DocumentInfo[]>('/api/documents').then(list => {
      setDocs(list)
      if (!doc && list.length) onSelect(list.find(d=>d.name==='ACS_Lecture_1_2026F.pdf') ?? list[0])
    }).catch(e => setError(String(e))).finally(() => setBusy(false))
  }, [])
  function select(value: string) {
    const next = docs.find(d=>d.document_id===value); if (next) onSelect(next); setHits([]); setAnswer(''); setError('')
    setQuery(''); setConcepts(''); setGroups([])
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function search() {
    setAnswer(''); setHits([])
    const list = await request<Hit[]>('/api/documents/'+id+'/search', {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({query})
    })
    setHits(list)
    if (!list.length) setAnswer('No matching passages.')
  }
  const topics = [...new Set(concepts.split(',').map(s => s.trim()).filter(Boolean))]
  async function generate(useModel: boolean) {
    setGroups([]); setCurrent(0); setResponses({})
    const url = '/api/documents/' + id + '/'
    const options = {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({concepts:topics})}
    if (useModel) setGroups((await request<{questions:Group[]}>(url+'question-set', options)).questions)
    else setGroups(await request<Group[]>(url+'concept-evidence', options))
  }
  const [current, setCurrent] = useState(0)
  const [responses, setResponses] = useState<Record<number,string>>({})
  return <div className="live-content"><div className="live-controls">
    <label>Upload a PDF or PPTX <input style={{width:'100%'}} type="file" accept=".pdf,.pptx" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) void run(async () => {
        const form = new FormData(); form.append('file',file)
        const d = await request<DocumentInfo>('/api/documents',{method:'POST',body:form})
        setDocs(list => [d,...list.filter(x => x.document_id !== d.document_id)]); onSelect(d); setHits([]); setGroups([]); setAnswer(''); setQuery(''); setConcepts('')
      })
    }}/></label>
    {busy && <p role="status">Working…</p>}{error && <p role="alert">{error}</p>}
    {doc && <><p><select aria-label="Current lecture" value={id} disabled={busy} onChange={e=>select(e.target.value)}>
      {docs.map(d=><option key={d.document_id} value={d.document_id}>{d.name}</option>)}</select></p>
      </>}</div>{!doc ? <p>Select or upload a lecture to begin.</p> : tests ? <><h2>Build a question set</h2><label>Enter up to five concepts, separated by commas.
        <textarea value={concepts} disabled={busy} onChange={e=>{setConcepts(e.target.value);setGroups([])}} placeholder="Memory bandwidth, arithmetic intensity"/></label>
        <nav>{[false,true].map(model=><button key={String(model)} disabled={busy||!topics.length||topics.length>5||topics.some(t=>t.length>120)} onClick={()=>void run(()=>generate(model))}>
          {model?'Generate set with TACC':'Find evidence'}</button>)}</nav>
        {groups.length>0 && <nav className="viewer-toolbar" aria-label="Question navigation">{groups.map((g,i)=><button key={g.concept} aria-pressed={current===i} onClick={()=>setCurrent(i)}>{i+1}</button>)}</nav>}
        {groups.slice(current,current+1).map(g=><article key={g.concept}><strong>{g.concept}</strong><p>{g.prompt}</p>{g.prompt && <label>Your draft answer<textarea value={responses[current]??''} onChange={e=>setResponses({...responses,[current]:e.target.value})}/></label>}
          {!g.citations.length && <p>No matching passage.</p>}{g.citations.map(h=><details key={h.chunk_id}><summary>Evidence · page {h.page}</summary><p>{h.text}</p><button onClick={()=>setPage(h.page)}>Open page {h.page}</button></details>)}</article>)}</> :
      <><h2>Search passages</h2><form onSubmit={e=>{e.preventDefault();void run(search)}}>
        <input aria-label="Search passages" placeholder="Enter a keyword or phrase" disabled={busy} value={query} onChange={e=>setQuery(e.target.value)}/>
        <button disabled={busy||!query.trim()}>Search</button></form>
      <p>{answer}</p>{hits.map(hit=><p key={hit.chunk_id}><button onClick={()=>setPage(hit.page)}>Page {hit.page}</button> {hit.text}</p>)}</>}
    </div>
}
