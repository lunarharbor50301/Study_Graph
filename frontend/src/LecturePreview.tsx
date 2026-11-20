import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { usePinchZoom } from './usePinchZoom'

type SlidePart = { type: 'text' | 'image'; value: string }
type Preview =
  | { url: string; kind: 'image' | 'error' }
  | { url: string; kind: 'content'; parts: SlidePart[] }

const minZoom = .5
const maxZoom = 3

function readSlideContent(html: string): SlidePart[] {
  const template = document.createElement('template')
  template.innerHTML = html
  const parts: SlidePart[] = []
  // Older PPTX previews contain only paragraphs and embedded raster images.
  for (const element of template.content.children) {
    if (element.tagName === 'P') {
      parts.push({ type: 'text', value: element.textContent ?? '' })
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') ?? ''
      if (/^data:image\/(?:png|jpeg|gif);base64,[A-Za-z0-9+/]+=*$/.test(src)) {
        parts.push({ type: 'image', value: src })
      }
    }
  }
  return parts
}

export function LecturePreview({ url, page, fallback }: { url: string; page: number; fallback: boolean }) {
  const viewport = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const anchor = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null)
  const [scale, setScale] = useState(1)
  const [preview, setPreview] = useState<Preview>()

  useEffect(() => {
    if (!fallback) return
    const controller = new AbortController()
    void fetch(url, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error('Preview unavailable')
        const parts = response.headers.get('content-type')?.startsWith('text/html')
          ? readSlideContent(await response.text())
          : null
        if (!controller.signal.aborted) setPreview(parts ? { url, kind: 'content', parts } : { url, kind: 'image' })
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview({ url, kind: 'error' })
      })
    return () => controller.abort()
  }, [fallback, url])

  useLayoutEffect(() => {
    if (viewport.current) viewport.current.scrollTop = 0
  }, [url])

  useLayoutEffect(() => {
    const target = anchor.current
    const stage = viewport.current
    const box = surface.current?.getBoundingClientRect()
    anchor.current = null
    if (!stage || !box || !target) return
    stage.scrollLeft += box.left + box.width * target.x - target.clientX
    stage.scrollTop += box.top + box.height * target.y - target.clientY
  }, [scale])

  function zoomTo(next: number, clientX?: number, clientY?: number) {
    const stage = viewport.current?.getBoundingClientRect()
    const box = surface.current?.getBoundingClientRect()
    const zoom = Math.max(minZoom, Math.min(maxZoom, next))
    if (!stage || !box?.width || !box.height || !Number.isFinite(zoom) || zoom === scale) return
    const x = clientX ?? stage.left + stage.width / 2
    const y = clientY ?? stage.top + stage.height / 2
    anchor.current = {
      x: Math.max(0, Math.min(1, (x - box.left) / box.width)),
      y: Math.max(0, Math.min(1, (y - box.top) / box.height)),
      clientX: x,
      clientY: y,
    }
    setScale(zoom)
  }

  usePinchZoom(viewport, scale, zoomTo)

  const content = preview?.url === url ? preview : undefined
  let pagePreview
  if (!fallback || content?.kind === 'image') {
    pagePreview = <img key={url} className="lecture-preview__page" src={url} alt={`Lecture page ${page}`} draggable={false}/>
  } else if (content?.kind === 'content') {
    pagePreview = <div className="lecture-preview__content">{content.parts.map((part, index) => part.type === 'text'
      ? <p key={index}>{part.value}</p>
      : <img key={index} src={part.value} alt="" draggable={false}
        onLoad={event => {
          const image = event.currentTarget
          image.style.setProperty('--slide-image-width', `${image.naturalWidth}px`)
        }}/>)}</div>
  } else {
    pagePreview = <p role="status">{content?.kind === 'error' ? 'Page preview unavailable.' : 'Loading preview…'}</p>
  }

  return <div ref={viewport} className="slide-stage slide-stage--zoomable" tabIndex={0}
    role="region" aria-label="Lecture page preview"
    aria-description="Pinch or press plus and minus to zoom. Press zero to reset."
    onKeyDown={event => {
      let next: number
      if (event.key === '+' || event.key === '=') next = scale * 1.2
      else if (event.key === '-') next = scale / 1.2
      else if (event.key === '0') next = 1
      else return
      event.preventDefault()
      zoomTo(next)
    }}>
    <div ref={surface} className="lecture-preview"
      style={{ width: `${scale * 100}%`, '--lecture-zoom': scale } as CSSProperties}>
      {pagePreview}
    </div>
  </div>
}
