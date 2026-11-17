import { useEffect, useState } from 'react'
import { Icon } from './Layout'
import type { CourseItem, CourseProject } from './courseStore'

const projects = [
  { id: 'map', name: 'Concept Maps', icon: 'graph' },
  { id: 'test', name: 'Tests', icon: 'test' },
] as const

type CourseShelfProps = {
  items: CourseItem[]
  activeId?: string
  storageError: boolean
  onOpen: (item: CourseItem) => void
  onRename: (id: string, title: string) => void
}

export function CourseShelf({ items, activeId, storageError, onOpen, onRename }: CourseShelfProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<CourseProject, boolean>>>({})
  const [menuId, setMenuId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const activeProject = items.find(item => item.id === activeId)?.kind

  useEffect(() => {
    if (activeProject) setCollapsed(value => value[activeProject] ? { ...value, [activeProject]: false } : value)
  }, [activeProject, activeId])

  return <nav className="sidebar__section course-shelf" aria-labelledby="sidebar-course-label">
    <span className="sidebar__label" id="sidebar-course-label">My Course</span>
    {projects.map(project => {
      const expanded = !collapsed[project.id]
      const entries = items.filter(item => item.kind === project.id)
      return <div className="course-project" key={project.id}>
        <button type="button" className="sidebar__item course-project__toggle" aria-expanded={expanded}
          aria-controls={`course-project-${project.id}`}
          onClick={() => setCollapsed(value => ({ ...value, [project.id]: expanded }))}>
          <Icon name={project.icon} size={16}/>{project.name}<Icon name="chevron" size={13}/>
        </button>
        <ul className="course-project__entries" id={`course-project-${project.id}`} hidden={!expanded}>
          {entries.length === 0 && <li className="course-empty">No saved items yet</li>}
          {entries.map(item => <li key={item.id}
            className="course-entry" onContextMenu={event => {
              if (editingId === item.id) return
              event.preventDefault()
              setEditingId(null)
              setMenuId(item.id)
            }}
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget) && menuId === item.id) setMenuId(null)
            }}
            onKeyDown={event => { if (event.key === 'Escape') setMenuId(null) }}>
            {editingId === item.id ? <form className="course-rename" onSubmit={event => {
              event.preventDefault()
              const title = String(new FormData(event.currentTarget).get('title') ?? '').trim()
              if (title) { onRename(item.id, title); setEditingId(null) }
            }} onKeyDown={event => { if (event.key === 'Escape') setEditingId(null) }}>
              <input name="title" aria-label="Course item name" defaultValue={item.title} autoFocus required maxLength={120}
                onFocus={event => event.currentTarget.select()}/>
              <button type="submit" aria-label="Save name"><Icon name="check" size={15}/></button>
              <button type="button" aria-label="Cancel rename" onClick={() => setEditingId(null)}><Icon name="close" size={15}/></button>
            </form> : <div className="course-entry__row" data-active={item.id === activeId}>
              <button className="sidebar__item course-entry__title" type="button" title={item.title}
                aria-current={item.id === activeId ? 'page' : undefined}
                onClick={() => { setMenuId(null); setEditingId(null); onOpen(item) }}>{item.title}</button>
              <button className="course-entry__actions" type="button" aria-label={`Actions for ${item.title}`}
                aria-expanded={menuId === item.id} onClick={() => setMenuId(menuId === item.id ? null : item.id)}>⋯</button>
            </div>}
            {menuId === item.id && <button type="button" className="course-entry__rename" autoFocus
              onClick={() => { setMenuId(null); setEditingId(item.id) }}>Rename</button>}
          </li>)}
        </ul>
      </div>
    })}
    {storageError && <p className="course-storage-status" role="status">Browser storage is unavailable. Changes are kept for this session.</p>}
  </nav>
}
