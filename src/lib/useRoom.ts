import { useCallback, useEffect, useRef, useState } from 'react'
import { remainingMs, type ClientMessage, type ServerMessage, type TimerState } from './protocol'

export type RoomConnection = {
  state: TimerState | null
  connected: boolean
  /** True once the server has accepted our secret. */
  control: boolean
  error: string | null
  send: (msg: ClientMessage) => void
  /** Remaining ms right now, corrected for the difference between our clock and the server's. */
  remaining: () => number
}

/** Keeps a WebSocket open to the room's durable object, reconnecting as needed. */
export function useRoom(roomId: string, secret?: string): RoomConnection {
  const [state, setState] = useState<TimerState | null>(null)
  const [connected, setConnected] = useState(false)
  const [control, setControl] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)
  const offset = useRef(0) // serverNow - Date.now()
  const stateRef = useRef<TimerState | null>(null)

  useEffect(() => {
    let closed = false
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    let pingTimer: ReturnType<typeof setInterval> | undefined

    function connect() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws'
      const qs = secret ? `?secret=${encodeURIComponent(secret)}` : ''
      const sock = new WebSocket(`${proto}://${location.host}/api/rooms/${roomId}/ws${qs}`)
      ws.current = sock

      sock.onopen = () => {
        retry = 0
        setConnected(true)
        // Handled by the durable object's auto-response, so it doesn't wake it up.
        pingTimer = setInterval(() => sock.readyState === 1 && sock.send('ping'), 30_000)
      }
      sock.onmessage = (ev) => {
        if (ev.data === 'pong') return
        const msg = JSON.parse(ev.data) as ServerMessage
        if (msg.type === 'state') {
          offset.current = msg.serverNow - Date.now()
          stateRef.current = msg.state
          setState(msg.state)
          setControl(msg.control)
        } else if (msg.type === 'error') {
          setError(msg.error)
        }
      }
      sock.onclose = () => {
        clearInterval(pingTimer)
        setConnected(false)
        if (closed) return
        retryTimer = setTimeout(connect, Math.min(10_000, 500 * 2 ** retry++))
      }
    }

    setError(null)
    connect()
    // Phones suspend sockets in the background; reconnect promptly on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && ws.current?.readyState === WebSocket.CLOSED) {
        clearTimeout(retryTimer)
        retry = 0
        connect()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      closed = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      document.removeEventListener('visibilitychange', onVisible)
      ws.current?.close()
    }
  }, [roomId, secret])

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg))
  }, [])

  const remaining = useCallback(() => {
    const s = stateRef.current
    return s ? remainingMs(s, Date.now() + offset.current) : 0
  }, [])

  return { state, connected, control, error, send, remaining }
}

/** Re-renders a few times per second so the clock can tick. */
export function useTick(ms = 100) {
  const [, setN] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setN((n) => n + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}
