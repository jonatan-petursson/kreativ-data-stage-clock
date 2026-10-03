import { useLayoutEffect, useRef } from 'react'
import { formatClock } from '#/lib/time'

type Props = {
  ms: number
  running: boolean
  /**
   * Largest height of the digits: a share of the container height, or of the
   * viewport height when `viewport` is set (the container then sizes to the digits).
   */
  maxHeight?: number
  viewport?: boolean
}

/**
 * Seven-segment countdown. Unlit segments are drawn as a faint "8" underlay, like a
 * real LED display, and the digits scale to fill the container's width.
 */
export function Clock({ ms, running, maxHeight = 0.8, viewport = false }: Props) {
  const text = formatClock(ms)
  const ghost = text.replace(/[0-9-]/g, '8')
  const tone = ms <= -1000 ? 'over' : ms <= 60_000 ? 'warn' : 'ok'
  const boxRef = useRef<HTMLDivElement>(null)
  const digitsRef = useRef<HTMLDivElement>(null)

  // Only the ghost pattern (character layout) affects width, so refit when it changes.
  useLayoutEffect(() => {
    const box = boxRef.current
    const digits = digitsRef.current
    if (!box || !digits) return
    const fit = () => {
      digits.style.fontSize = '100px'
      const w = digits.offsetWidth
      const h = digits.offsetHeight
      if (!w || !h) return
      const maxH = (viewport ? window.innerHeight : box.clientHeight) * maxHeight
      const size = Math.min((box.clientWidth * 0.94 * 100) / w, (maxH * 100) / h)
      digits.style.fontSize = `${Math.max(12, size)}px`
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    if (viewport) window.addEventListener('resize', fit)
    document.fonts?.ready.then(fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [ghost, maxHeight, viewport])

  return (
    <div className={`clock-box${viewport ? ' clock-box-auto' : ''}`} ref={boxRef}>
      <div
        className={`clock clock-${tone}${running ? '' : ' clock-paused'}`}
        ref={digitsRef}
        role="timer"
        aria-label={text}
      >
        <span className="clock-ghost" aria-hidden="true">
          {ghost}
        </span>
        <span className="clock-lit" aria-hidden="true">
          {text}
        </span>
      </div>
    </div>
  )
}
