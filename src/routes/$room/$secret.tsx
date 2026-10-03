import { Link, createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Clock } from '#/components/Clock'
import { BackIcon } from '#/components/icons'
import { MAX_MESSAGE, ROOM_ID_RE, SECRET_RE } from '#/lib/protocol'
import { forgetSecret, rememberSecret } from '#/lib/secret'
import { formatInput, parseDuration } from '#/lib/time'
import { useRoom, useTick } from '#/lib/useRoom'

export const Route = createFileRoute('/$room/$secret')({
  beforeLoad: ({ params }) => {
    if (!ROOM_ID_RE.test(params.room) || !SECRET_RE.test(params.secret)) {
      throw redirect({ to: '/' })
    }
  },
  head: ({ params }) => ({
    meta: [
      { title: `${params.room} settings · Stage Clock` },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: Control,
})

const PRESETS = [5, 10, 15, 20, 30, 45, 60]

function Control() {
  const { room, secret } = Route.useParams()
  const navigate = useNavigate()
  const { state, connected, control, error, send, remaining } = useRoom(room, secret)
  const [time, setTime] = useState('')
  const [message, setMessage] = useState('')
  const [loaded, setLoaded] = useState(false)
  useTick()

  useEffect(() => {
    if (control) rememberSecret(room, secret)
  }, [control, room, secret])

  // Prefill the form from the room once.
  useEffect(() => {
    if (state && !loaded) {
      setTime(formatInput(state.durationMs))
      setMessage(state.message)
      setLoaded(true)
    }
  }, [state, loaded])

  if (error === 'bad-secret') {
    return (
      <main className="settings settings-center">
        <div className="card">
          <h2>Wrong password</h2>
          <p className="muted">This room already has a different password.</p>
          <div className="row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                forgetSecret(room)
                navigate({ to: '/$room', params: { room } })
              }}
            >
              Back to the clock
            </button>
          </div>
        </div>
      </main>
    )
  }

  const parsed = parseDuration(time)
  const running = state?.endsAt != null
  const disabled = !connected || !control

  function save(e: React.FormEvent) {
    e.preventDefault()
    if (parsed != null) send({ type: 'set', ms: parsed })
  }

  return (
    <main className="settings">
      <header className="settings-bar">
        <Link to="/$room" params={{ room }} className="btn btn-icon" aria-label="Back to clock">
          <BackIcon />
        </Link>
        <div>
          <div className="settings-room">{room}</div>
          <div className="muted small">
            <span className={`dot${connected ? ' on' : ''}`} />
            {connected ? (control ? 'Connected' : 'Connecting…') : 'Reconnecting…'}
          </div>
        </div>
      </header>

      <section className="preview" aria-label="Preview">
        {state ? <Clock ms={remaining()} running={running} /> : <div className="clock-box" />}
        {state?.message ? <p className="message message-preview">{state.message}</p> : null}
      </section>

      <form className="card" onSubmit={save}>
        <label htmlFor="time">Time</label>
        <div className="row">
          <input
            id="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            inputMode="text"
            placeholder="mm:ss"
            autoComplete="off"
            aria-invalid={time !== '' && parsed == null}
          />
          <button type="submit" className="btn btn-primary" disabled={disabled || parsed == null}>
            Save
          </button>
        </div>
        <p className="muted small">Minutes, m:ss or h:mm:ss. Saving keeps the clock running if it is.</p>
        <div className="chips">
          {PRESETS.map((m) => (
            <button
              key={m}
              type="button"
              className="chip"
              disabled={disabled}
              onClick={() => {
                setTime(`${m}:00`)
                send({ type: 'set', ms: m * 60_000 })
              }}
            >
              {m}m
            </button>
          ))}
        </div>
      </form>

      <div className="card">
        <div className="row wrap">
          {running ? (
            <button type="button" className="btn btn-big" disabled={disabled} onClick={() => send({ type: 'pause' })}>
              Pause
            </button>
          ) : (
            <button type="button" className="btn btn-big btn-go" disabled={disabled} onClick={() => send({ type: 'start' })}>
              Start
            </button>
          )}
          <button type="button" className="btn" disabled={disabled} onClick={() => send({ type: 'reset' })}>
            Reset
          </button>
          <button type="button" className="btn" disabled={disabled} onClick={() => send({ type: 'adjust', deltaMs: -60_000 })}>
            −1m
          </button>
          <button type="button" className="btn" disabled={disabled} onClick={() => send({ type: 'adjust', deltaMs: 60_000 })}>
            +1m
          </button>
        </div>
      </div>

      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault()
          send({ type: 'message', text: message.trim() })
        }}
      >
        <label htmlFor="message">Message</label>
        <textarea
          id="message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.form?.requestSubmit()
            }
          }}
          maxLength={MAX_MESSAGE}
          rows={2}
          placeholder="Shown under the clock"
        />
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={disabled || !message.trim()}>
            Show message
          </button>
          <button
            type="button"
            className="btn"
            disabled={disabled || !state?.message}
            onClick={() => send({ type: 'message', text: '' })}
          >
            Clear
          </button>
        </div>
      </form>

      <RpiHint room={room} />
    </main>
  )
}

function RpiHint({ room }: { room: string }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(location.origin), [])
  if (!origin) return null
  const cmd = `curl -fsSL ${origin}/${room}/rpi.sh | bash`
  return (
    <details className="card">
      <summary className="muted small">Run the display on a Raspberry Pi</summary>
      <p className="muted small">
        On Raspberry Pi OS (with desktop), run this once in a terminal. The Pi will then open this clock
        full screen every time it boots.
      </p>
      <code className="cmd" onClick={() => navigator.clipboard?.writeText(cmd)} title="Click to copy">
        {cmd}
      </code>
    </details>
  )
}
