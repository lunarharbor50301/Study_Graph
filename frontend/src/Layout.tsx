import React, { ReactNode, useRef } from 'react'
type IconName = 'book' | 'brain' | 'chat' | 'check' | 'chevron' | 'close' | 'expand' | 'file' | 'graph' | 'help' | 'home' | 'learn' | 'menu' | 'minus' | 'next' | 'plus' | 'previous' | 'sparkle' | 'test' | 'trash'

export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
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
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>, minus: <path d="M5 12h14"/>, next: <path d="m9 18 6-6-6-6"/>, plus: <path d="M12 5v14M5 12h14"/>, previous: <path d="m15 18-6-6 6-6"/>,
    sparkle: <><path d="m12 3 1.1 3.2L16 8l-2.9 1.8L12 13l-1.1-3.2L8 8l2.9-1.8z"/><path d="m19 14 .7 2.1L22 17.5l-2.3 1.4L19 21l-.7-2.1-2.3-1.4 2.3-1.4zM5 13l.7 2L8 16.2l-2.3 1.3L5 20l-.7-2.5L2 16.2 4.3 15z"/></>,
    test: <><path d="M9 3h6l1 3h3v16H5V6h3z"/><path d="M9 6h6M9 12h6M9 16h4"/></>,
    trash: <><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13"/><path d="M10 11v5M14 11v5"/></>,
  }
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

export function Panel({ id, title, subtitle, icon, canClose, hidden, expanded, onClose, onExpand, children, className = '' }: {
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

export function SplitHandle({ axis, label, controls, value, onChange }: {
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

