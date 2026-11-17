import { useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { Icon } from './Layout'
import { getMapLayout, mapGeometry, type MapPoint } from './mapLayout'
import type { Concept, Lecture, LectureTopic } from './types'
import './mindMap.css'

export type MapTopic = LectureTopic & { concepts: Concept[] }
const center: MapPoint = [50, 50]
const maximumZoom = 2
const zoomStep = .15
type Zoom = 'auto' | 'fit' | number

export function getMapTopics(lecture: Lecture): MapTopic[] {
  const byId = new Map(lecture.concepts.map(concept => [concept.id, concept]))
  const topics = (lecture.outline?.topics ?? []).map(topic => ({
    ...topic,
    concepts: topic.conceptIds.flatMap(id => {
      const concept = byId.get(id)
      return concept ? [concept] : []
    }).sort((a, b) => a.page - b.page),
  })).filter(topic => topic.concepts.length).sort((a, b) => a.firstPage - b.firstPage)

  if (topics.length) return topics
  const concepts = [...lecture.concepts].sort((a, b) => a.page - b.page)
  if (!concepts.length) return []
  return [{
    id: 'lecture-concepts',
    title: 'Lecture Concepts',
    firstPage: concepts[0].page,
    lastPage: concepts[concepts.length - 1].page,
    conceptIds: concepts.map(concept => concept.id),
    concepts,
  }]
}

function coordinates([x, y]: MapPoint) {
  return { '--map-x': `${x}%`, '--map-y': `${y}%` } as CSSProperties
}

function pageLabel(first: number, last = first) {
  return first === last ? `p. ${first}` : `pp. ${first}–${last}`
}

export function MindMap({ title, subtitle, topics, activeTopic, visited, hidden, onOpenTopic, onOpenConcept, onBack }: {
  title: string
  subtitle?: string
  topics: MapTopic[]
  activeTopic?: MapTopic
  visited: ReadonlySet<string>
  hidden: boolean
  onOpenTopic: (topic: MapTopic) => void
  onOpenConcept: (concept: Concept) => void
  onBack: () => void
}) {
  const overview = getMapLayout(topics.length)
  const count = activeTopic?.concepts.length ?? topics.length
  const layout = activeTopic ? getMapLayout(count) : overview
  const viewportFrame = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState<Zoom>('auto')
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ pointer: number; x: number; y: number; scrollX: number; scrollY: number } | null>(null)
  const zoomAnchor = useRef<{ x: number; y: number } | null>(null)

  useLayoutEffect(() => {
    const frame = viewportFrame.current
    const element = viewport.current
    if (!frame || !element) return
    const measure = () => {
      // The vertical gutter keeps the available width constant. Use the outer
      // height so a horizontal scrollbar cannot change the fit calculation.
      const width = element.clientWidth
      const height = frame.clientHeight
      if (width && height) {
        setViewportSize(current => current.width === width && current.height === height ? current : { width, height })
      }
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const fit = viewportSize.width && viewportSize.height
    ? Math.min(maximumZoom, (viewportSize.width - 2) / layout.width, (viewportSize.height - 2) / layout.height)
    : 1
  const normalZoom = viewportSize.width < 460 && count <= 7 ? Math.min(1, fit) : Math.min(1, Math.max(.9, fit))
  const scale = zoom === 'auto' ? normalZoom : zoom === 'fit' ? fit : zoom
  const minZoom = Math.min(.5, fit)
  const surfaceWidth = Math.ceil(layout.width * scale)
  const surfaceHeight = Math.ceil(layout.height * scale)
  const canPan = surfaceWidth > viewportSize.width || surfaceHeight > viewportSize.height

  useLayoutEffect(() => {
    const element = viewport.current
    if (!element || hidden || !viewportSize.width) return
    const anchor = zoomAnchor.current ?? { x: .5, y: .5 }
    zoomAnchor.current = null
    element.scrollLeft = Math.max(0, surfaceWidth - element.clientWidth) / 2 + (anchor.x - .5) * surfaceWidth
    element.scrollTop = Math.max(0, surfaceHeight - element.clientHeight) / 2 + (anchor.y - .5) * surfaceHeight
  }, [activeTopic?.id, hidden, surfaceHeight, surfaceWidth, viewportSize])

  function changeZoom(direction: 1 | -1) {
    const element = viewport.current
    if (element) {
      zoomAnchor.current = {
        x: .5 + (element.scrollLeft - Math.max(0, surfaceWidth - element.clientWidth) / 2) / surfaceWidth,
        y: .5 + (element.scrollTop - Math.max(0, surfaceHeight - element.clientHeight) / 2) / surfaceHeight,
      }
    }
    setZoom(Math.min(maximumZoom, Math.max(minZoom, scale + direction * zoomStep)))
  }

  function startPan(event: PointerEvent<HTMLDivElement>) {
    if (!canPan || event.pointerType !== 'mouse' || event.button !== 0 ||
      (event.target instanceof Element && event.target.closest('button'))) return
    const element = event.currentTarget
    element.focus({ preventScroll: true })
    element.setPointerCapture(event.pointerId)
    drag.current = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY,
      scrollX: element.scrollLeft, scrollY: element.scrollTop,
    }
    setDragging(true)
    event.preventDefault()
  }

  function movePan(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current
    if (start?.pointer !== event.pointerId) return
    event.currentTarget.scrollLeft = start.scrollX - (event.clientX - start.x)
    event.currentTarget.scrollTop = start.scrollY - (event.clientY - start.y)
  }

  function stopPan() {
    drag.current = null
    setDragging(false)
  }

  return <div className="mind-map" hidden={hidden}>
    <div className="mind-map__toolbar">
      {activeTopic
        ? <button id="mind-map-back" type="button" className="mind-map__back" onClick={onBack}>
            <Icon name="previous" size={15}/>Back to overview
          </button>
        : <span className="mind-map__label">Lecture overview</span>}
      <div className="mind-map__tools">
        <div className="mind-map__zoom" role="group" aria-label="Map zoom">
          <button type="button" aria-label="Zoom out" title="Zoom out" disabled={scale <= minZoom + .005}
            onClick={() => changeZoom(-1)}><Icon name="minus" size={13}/></button>
          <output aria-label="Zoom level" aria-live="polite">{Math.round(scale * 100)}%</output>
          <button type="button" aria-label="Zoom in" title="Zoom in" disabled={scale >= maximumZoom - .005}
            onClick={() => changeZoom(1)}>+</button>
          <button type="button" aria-label="Fit diagram to window" title="Fit to window" onClick={() => setZoom('fit')}>Fit</button>
        </div>
      </div>
    </div>
    <div ref={viewportFrame} className="mind-map__viewport">
      <div ref={viewport} className={`mind-map__canvas${canPan ? ' can-pan' : ''}${dragging ? ' is-panning' : ''}`}
        aria-label={activeTopic ? `${activeTopic.title} concept map` : 'Lecture concept map'} role="group"
        aria-description={canPan ? 'Drag or scroll to pan.' : undefined}
        tabIndex={canPan ? 0 : undefined}
        onPointerDown={startPan} onPointerMove={movePan} onLostPointerCapture={stopPan}>
        <div className="mind-map__frame" style={{ width: surfaceWidth, height: surfaceHeight }}>
          <div className="mind-map__surface" style={{ width: surfaceWidth, height: surfaceHeight }}>
            <div className="mind-map__diagram" style={{
              width: layout.width, height: layout.height, transform: `scale(${scale})`,
              '--map-node-width': `${mapGeometry.nodeWidth}px`,
              '--map-node-height': `${mapGeometry.nodeHeight}px`,
              '--map-hub-size': `${mapGeometry.hubSize}px`,
              } as CSSProperties}>
              <svg key={activeTopic?.id ?? 'overview'} className="mind-map__links" viewBox="0 0 100 100"
                preserveAspectRatio="none" aria-hidden="true">
                {layout.points.map(([x, y], index) => <line key={index} x1="50" y1="50" x2={x} y2={y} vectorEffect="non-scaling-stroke"/>)}
              </svg>
              <div className={`mind-map__hub ${activeTopic ? 'is-hidden' : ''}`} aria-hidden={Boolean(activeTopic)}>
                <strong title={title}>{title}</strong>
                {subtitle && <small>{subtitle}</small>}
              </div>
              {topics.map((topic, index) => {
                const focused = activeTopic?.id === topic.id
                const hidden = Boolean(activeTopic && !focused)
                const seen = visited.has(topic.id)
                const number = String(index + 1).padStart(2, '0')
                return <button key={topic.id} id={`mind-map-topic-${topic.id}`} type="button"
                  className={`mind-map__node mind-map__topic${focused ? ' is-focused' : ''}${hidden ? ' is-hidden' : ''}${seen ? ' is-visited' : ''}`}
                  style={coordinates(focused ? center : overview.points[index])}
                  aria-label={`Topic ${index + 1}: ${topic.title}${seen ? ', visited' : ''}`}
                  aria-hidden={hidden}
                  disabled={hidden || focused}
                  onClick={() => onOpenTopic(topic)}>
                  <span className="mind-map__number">{number}</span>
                  <span className="mind-map__text">
                    <strong title={topic.title}>{topic.title}</strong>
                    <small>{pageLabel(topic.firstPage, topic.lastPage)}</small>
                  </span>
                  {seen && !focused && <span className="mind-map__visited" title="Visited"><Icon name="check" size={11}/></span>}
                </button>
              })}
              {activeTopic?.concepts.map((concept, index) => (
                <button key={concept.id} type="button" className="mind-map__node mind-map__leaf"
                  style={{ ...coordinates(layout.points[index]), animationDelay: `${90 + Math.min(index, 6) * 35}ms` }}
                  onClick={() => onOpenConcept(concept)}>
                  <span className="mind-map__text">
                    <strong title={concept.name}>{concept.name}</strong>
                    <small>{concept.sourcePages && concept.sourcePages.length > 1
                      ? `${concept.sourcePages.length} pages · p. ${concept.page}` : pageLabel(concept.page)}</small>
                  </span>
                  <Icon name="chevron" size={13}/>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
}
