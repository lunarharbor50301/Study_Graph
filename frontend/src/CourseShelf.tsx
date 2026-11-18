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
  onDelete: (id: string) => void
}

export function CourseShelf({ items, activeId, storageError, onOpen, onRename, onDelete }: CourseShelfProps) {
  const [collapsed, setCollapsed] = useState<Partial<Record<CourseProject, boolean>>>({})
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
          {entries.map(item => <li key={item.id} className="course-entry">
            <div className="course-entry__row" data-active={item.id === activeId}>
              {editingId === item.id ? <input className="course-entry__input"
                aria-label={`Rename ${item.title}`} defaultValue={item.title} autoFocus maxLength={120}
                onFocus={event => event.currentTarget.select()}
                onBlur={event => {
                  const title = event.currentTarget.value.trim()
                  if (title && title !== item.title) onRename(item.id, title)
                  setEditingId(null)
                }}
                onKeyDown={event => {
                  if (event.nativeEvent.isComposing) return
                  if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
                  if (event.key === 'Escape') { event.preventDefault(); setEditingId(null) }
                }}/>
                : <button className="sidebar__item course-entry__title" type="button"
                  title={`${item.title} — Click to rename`} aria-label={`Open and rename ${item.title}`}
                  aria-current={item.id === activeId ? 'page' : undefined}
                  onClick={() => { onOpen(item); setEditingId(item.id) }}>{item.title}</button>}
              <button className="course-entry__delete" type="button" title="Delete"
                aria-label={`Delete ${item.title}`}
                onClick={() => { setEditingId(null); onDelete(item.id) }}><Icon name="close" size={14}/></button>
            </div>
          </li>)}
        </ul>
      </div>
    })}
    {storageError && <p className="course-storage-status" role="status">Browser storage is unavailable. Changes are kept for this session.</p>}
  </nav>
}
