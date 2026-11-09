import { useEffect, useState } from 'react'

type DocumentInfo = {
  document_id: string; name: string; page_count: number
  original_url: string; preview_mode: 'page_image' | 'slide_content'; pages_without_text: number[]
}
type Hit = {chunk_id: string; page: number; text: string}
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(typeof error.detail === 'string' ? error.detail : '请求失败：' + response.status)
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
  }
  async function run(action: () => Promise<void>) {
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(String(e)) } finally { setBusy(false) }
  }
  async function submit(ask: boolean) {
    setAnswer(''); setHits([])
    const options = (body: object) => ({method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)})
    if (ask) {
      const result = await request<{answer:string;provider:string;citations:Hit[]}>('/api/ask',
        options({session_id:session, document_id:id, question:query}))
      setAnswer((result.provider === 'extractive' ? '原文摘录 · ' : '') + result.answer)
      setHits(result.citations)
    } else {
      const list = await request<Hit[]>('/api/documents/' + id + '/search', options({query}))
      setHits(list)
      if (!list.length) setAnswer('没有找到匹配的片段。')
    }
  }
  const preview = '/api/documents/' + id + '/pages/' + page + '/preview'
  return <><header>StudyGraph · 我的讲义</header><main><section>
    <p><a href="/">返回样例工作台</a></p>
    <label>导入 PDF 或 PPTX <input style={{width:'100%'}} type="file" accept=".pdf,.pptx" disabled={busy} onChange={e => {
      const file = e.target.files?.[0]
      e.target.value = ''
      if (file) void run(async () => {
        const form = new FormData(); form.append('file',file)
        const d = await request<DocumentInfo>('/api/documents',{method:'POST',body:form})
        setDocs(list => [d,...list.filter(x => x.document_id !== d.document_id)]); select(d.document_id)
      })
    }}/></label>
    {busy && <p role="status">正在处理…</p>}{error && <p role="alert">{error}</p>}
    {doc && <><p><select aria-label="当前讲义" value={id} disabled={busy} onChange={e=>select(e.target.value)}>
      {docs.map(d=><option key={d.document_id} value={d.document_id}>{d.name}</option>)}</select></p>
      <form onSubmit={e=>{e.preventDefault();void run(()=>submit(true))}}>
        <input aria-label="讲义问题" placeholder="输入问题或关键词" value={query} onChange={e=>setQuery(e.target.value)}/>
        <button type="button" disabled={busy||!query.trim()} onClick={()=>void run(()=>submit(false))}>检索</button>
        <button disabled={busy||!query.trim()}>提问</button></form>
      <p>{answer}</p>{hits.map(hit=><p key={hit.chunk_id}><button onClick={()=>setPage(hit.page)}>第 {hit.page} 页</button> {hit.text}</p>)}</>}
    </section>{doc && <aside><h2>{doc.name}</h2><p>第 {page} / {doc.page_count} 页 · <a href={doc.original_url}>打开原件</a></p>
      {doc.pages_without_text.includes(page) && <p>本页无可检索文本。</p>}
      {doc.preview_mode === 'page_image' ? <img src={preview} alt={'讲义第 '+page+' 页'} style={{width:'100%'}}/> :
        <iframe sandbox="" title="幻灯片内容预览" src={preview} style={{width:'100%',height:380,border:0}}/>}
      <button disabled={page===1} onClick={()=>setPage(page-1)}>上一页</button> <button disabled={page===doc.page_count} onClick={()=>setPage(page+1)}>下一页</button>
    </aside>}</main></>
}
