import Documents from './Documents'
import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import './style.css'

type Concept={id:string,name:string,chunk_id:string,page:number,text:string}
type Lecture={title:string,concepts:Concept[],relations:{source:string,target:string,label:string}[]}
type Line={text:string,page?:number}
async function api(path:string,body?:object){
  const r=await fetch('/api/'+path,body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})
  if(!r.ok)throw Error('请求失败，请检查后端后重试。')
  return r.json()
}
function Workspace({lecture}:{lecture:Lecture}){
  const [topic,select]=useState('bandwidth'),[page,open]=useState(1)
  const [q,write]=useState('解释这个概念'),[lines,log]=useState<Line[]>([])
  const [prompt,practice]=useState(''),[answer,edit]=useState(''),[busy,lock]=useState(false)
  const [session]=useState(()=>{const id=sessionStorage.studySession||crypto.randomUUID();sessionStorage.studySession=id;return id})
  const source=lecture.concepts.find(c=>c.page===page)!
  async function run(action:()=>Promise<void>){lock(true);try{await action()}catch(e){log(v=>[...v,{text:String(e)}])}finally{lock(false)}}
  return <><header>StudyGraph <small>学习工作台</small> <a style={{color:"white",fontSize:15}} href="?documents">我的讲义</a></header><main><section><h2>概念图</h2><nav>{lecture.concepts.map((c,i)=><React.Fragment key={c.id}>{i>0&&<small>{lecture.relations[0].label} → </small>}<button aria-pressed={topic===c.id} onClick={()=>select(c.id)}>{c.name}</button></React.Fragment>)}</nav>
  <h2>讲义问答</h2><form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await api('ask',{session_id:session,concept_id:topic,question:q});log(v=>[...v,{text:q},{text:r.answer,page:r.citations[0]?.page}])})}}><input aria-label="问题" value={q} onChange={e=>write(e.target.value)}/><button disabled={busy||!q.trim()}>提问</button></form>
  <div aria-live="polite">{lines.map((l,i)=><p key={i}>{l.text} {l.page&&<button onClick={()=>open(l.page!)}>查看第 {l.page} 页</button>}</p>)}</div>
  <h2>练习</h2>{!prompt?<button disabled={busy} onClick={()=>run(async()=>practice((await api('exercises/bw-01')).prompt))}>练习带宽上限</button>:<><p>{prompt}</p><form onSubmit={e=>{e.preventDefault();run(async()=>{const r=await api('exercises/bw-01/attempts',{session_id:session,answer});log(v=>[...v,{text:'第 '+r.attempt_number+' 次作答 · '+answer+'。'+r.feedback}]);edit('')})}}><input aria-label="作答" value={answer} onChange={e=>edit(e.target.value)}/><button disabled={busy||!answer.trim()}>提交答案</button></form></>}</section>
  <aside><small>样例讲义 · 第 {page} / 2 页</small><h2>{lecture.title}</h2><article><h3>{source.name}</h3><p>{source.text}</p></article><button onClick={()=>open(page===1?2:1)}>{page===1?'下一页':'上一页'}</button></aside></main></>
}
const root=createRoot(document.getElementById('root')!)
if (new URLSearchParams(location.search).has('documents')) root.render(<Documents/>)
else api('lecture').then(data=>root.render(<Workspace lecture={data}/>)).catch(()=>root.render(<p>无法读取讲义，请启动后端并刷新。</p>))
