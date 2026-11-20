import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

type PinchEvent = MouseEvent & { scale: number }

export function usePinchZoom(
  viewport: RefObject<HTMLDivElement | null>,
  scale: number,
  zoomTo: (scale: number, clientX?: number, clientY?: number) => void,
  enabled = true,
) {
  const current = useRef({ scale, zoomTo })
  useLayoutEffect(() => {
    current.current = { scale, zoomTo }
  }, [scale, zoomTo])

  useEffect(() => {
    const element = viewport.current
    if (!element || !enabled) return
    let touchPinch: { distance: number; scale: number } | null = null
    let gestureScale: number | null = null

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey) return
      event.preventDefault()
      if (gestureScale !== null) return
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1)
      current.current.zoomTo(current.current.scale * Math.exp(-delta * .01), event.clientX, event.clientY)
    }
    function onTouch(event: TouchEvent) {
      if (event.touches.length !== 2) {
        touchPinch = null
        return
      }
      event.preventDefault()
      const first = event.touches[0]
      const second = event.touches[1]
      const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY)
      if (distance < 1) return
      const start = touchPinch ?? { distance, scale: current.current.scale }
      touchPinch = start
      current.current.zoomTo(start.scale * distance / start.distance,
        (first.clientX + second.clientX) / 2, (first.clientY + second.clientY) / 2)
    }
    function resetTouch() {
      touchPinch = null
    }
    function onGestureStart(event: Event) {
      event.preventDefault()
      gestureScale = current.current.scale
    }
    function onGestureChange(event: Event) {
      event.preventDefault()
      const gesture = event as PinchEvent
      if (gestureScale !== null && touchPinch === null) {
        current.current.zoomTo(gestureScale * gesture.scale, gesture.clientX, gesture.clientY)
      }
    }
    function onGestureEnd() {
      gestureScale = null
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    element.addEventListener('touchstart', onTouch, { passive: false })
    element.addEventListener('touchmove', onTouch, { passive: false })
    element.addEventListener('touchend', resetTouch)
    element.addEventListener('touchcancel', resetTouch)
    element.addEventListener('gesturestart', onGestureStart)
    element.addEventListener('gesturechange', onGestureChange)
    element.addEventListener('gestureend', onGestureEnd)
    return () => {
      element.removeEventListener('wheel', onWheel)
      element.removeEventListener('touchstart', onTouch)
      element.removeEventListener('touchmove', onTouch)
      element.removeEventListener('touchend', resetTouch)
      element.removeEventListener('touchcancel', resetTouch)
      element.removeEventListener('gesturestart', onGestureStart)
      element.removeEventListener('gesturechange', onGestureChange)
      element.removeEventListener('gestureend', onGestureEnd)
    }
  }, [enabled, viewport])
}
