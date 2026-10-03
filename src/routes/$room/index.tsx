import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import qrcode from 'qrcode-generator'
import { useEffect, useMemo, useState } from 'react'
import { Clock } from '#/components/Clock'
import { CogIcon, FullscreenIcon, QrIcon } from '#/components/icons'
import { ROOM_ID_RE } from '#/lib/protocol'
import { recallSecret, rememberSecret, secretFor } from '#/lib/secret'
import { useRoom, useTick } from '#/lib/useRoom'

export const Route = createFileRoute('/$room/')({
  beforeLoad: ({ params }) => {
    const room = params.room.toLowerCase()
    if (!ROOM_ID_RE.test(room)) throw redirect({ to: '/' })
    if (room !== params.room) throw redirect({ to: '/$room', params: { room } })
  },
  head: ({ params }) => ({ meta: [{ title: `${params.room} · Stage Clock` }] }),
  component: Display,
})

function Display() {
  const { room } = Route.useParams()
  const navigate = useNavigate()
  const { state, connected, remaining } = useRoom(room)
  const active = useActivity(3000)
  const [asking, setAsking] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [rotated, toggleRotated] = useRotation()
  const canFullscreen = useCanFullscreen()
  useTick()
  useWakeLock()

  function openSettings() {
    const secret = recallSecret(room)
    if (secret) navigate({ to: '/$room/$secret', params: { room, secret } })
    else setAsking(true)
  }

  return (
    <main className={`display${active || asking || showQr ? '' : ' idle'}`}>
      <div className={`stage${rotated ? ' rotated' : ''}`} onClick={toggleRotated}>
        {state ? (
          <Clock
            ms={remaining()}
            running={state.endsAt != null}
            maxHeight={state.message ? 0.55 : 0.7}
            viewport
            rotated={rotated}
          />
        ) : null}
        {state?.message ? <p className="message">{state.message}</p> : null}
      </div>

      <div className="tools">
        {!connected && state ? <span className="offline" title="Reconnecting…" /> : null}
        <span className="room-tag">{room}</span>
        <button type="button" className="tool" aria-label="Show QR code" onClick={() => setShowQr(true)}>
          <QrIcon />
        </button>
        {canFullscreen ? (
          <button type="button" className="tool" aria-label="Full screen" onClick={toggleFullscreen}>
            <FullscreenIcon />
          </button>
        ) : null}
        <button type="button" className="tool" aria-label="Settings" onClick={openSettings}>
          <CogIcon />
        </button>
      </div>

      {showQr ? <QrDialog onClose={() => setShowQr(false)} /> : null}

      {asking ? (
        <PasswordDialog
          claimed={state?.claimed ?? true}
          onCancel={() => setAsking(false)}
          onSubmit={(password) => {
            const secret = secretFor(room, password)
            rememberSecret(room, secret)
            navigate({ to: '/$room/$secret', params: { room, secret } })
          }}
        />
      ) : null}
    </main>
  )
}

function PasswordDialog(props: {
  claimed: boolean
  onCancel: () => void
  onSubmit: (password: string) => void
}) {
  const [pw, setPw] = useState('')
  return (
    <div className="scrim" onClick={props.onCancel}>
      <form
        className="card dialog"
        onClick={(e) => e.stopPropagation()}
        onSubmit={(e) => {
          e.preventDefault()
          if (pw) props.onSubmit(pw)
        }}
      >
        <label htmlFor="pw">{props.claimed ? 'Room password' : 'Choose a password for this room'}</label>
        <input
          id="pw"
          type="password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && props.onCancel()}
          autoFocus
        />
        <div className="row end">
          <button type="button" className="btn" onClick={props.onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={!pw}>
            Open settings
          </button>
        </div>
      </form>
    </div>
  )
}

/** QR code linking to this display, styled like the one in kreativ-data-phase. */
function QrDialog({ onClose }: { onClose: () => void }) {
  const url = location.origin + location.pathname
  const svg = useMemo(() => buildQr(url), [url])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="qr-modal" role="dialog" aria-modal="true" aria-label="QR code for this room" onClick={onClose}>
      <div className="qr-card">
        <div className="qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        <div className="qr-url">{url}</div>
      </div>
    </div>
  )
}

/** Black-on-white QR as an SVG with a 4-module quiet zone. */
function buildQr(text: string) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  const q = 4
  const d = n + 2 * q
  const out = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${d} ${d}" shape-rendering="crispEdges"><rect width="${d}" height="${d}" fill="#fff"/>`,
  ]
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++)
      if (qr.isDark(r, c)) out.push(`<rect x="${c + q}" y="${r + q}" width="1" height="1" fill="#000"/>`)
  out.push('</svg>')
  return out.join('')
}

const ROTATION_KEY = 'stage-clock:rotated'

/** Whether the clock is turned 90°, remembered per device (e.g. a portrait-mounted screen). */
function useRotation() {
  const [rotated, setRotated] = useState(false)
  useEffect(() => {
    try {
      setRotated(localStorage.getItem(ROTATION_KEY) === '1')
    } catch {}
  }, [])
  const toggle = () =>
    setRotated((r) => {
      try {
        localStorage.setItem(ROTATION_KEY, r ? '0' : '1')
      } catch {}
      return !r
    })
  return [rotated, toggle] as const
}

/** True while the pointer/keyboard/touch has been used within the last `ms`. */
function useActivity(ms: number) {
  const [active, setActive] = useState(true)
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>
    const poke = () => {
      setActive(true)
      clearTimeout(t)
      t = setTimeout(() => setActive(false), ms)
    }
    const events = ['pointermove', 'pointerdown', 'keydown', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, poke, { passive: true }))
    poke()
    return () => {
      clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, poke))
    }
  }, [ms])
  return active
}

/** Keeps the screen from sleeping while the display is visible. */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      if (document.visibilityState !== 'visible') return
      try {
        lock = await navigator.wakeLock?.request('screen')
      } catch {}
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [])
}

/** iPhone Safari has no fullscreen API, so the button would do nothing there. */
function useCanFullscreen() {
  const [can, setCan] = useState(false)
  useEffect(() => setCan(document.fullscreenEnabled === true), [])
  return can
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  else document.documentElement.requestFullscreen?.().catch(() => {})
}
