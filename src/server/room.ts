import { DurableObject } from 'cloudflare:workers'
import {
  MAX_MESSAGE,
  MAX_MS,
  SECRET_RE,
  type ClientMessage,
  type ServerMessage,
  type TimerState,
} from '../lib/protocol'

type Stored = Omit<TimerState, 'claimed'> & { secret: string | null }
type Attachment = { control: boolean }

/** Rooms are deleted after this long without a change or a new connection. */
const TTL_MS = 8 * 3600_000

const DEFAULT: Stored = {
  durationMs: 10 * 60_000,
  endsAt: null,
  pausedRemainingMs: 10 * 60_000,
  message: '',
  secret: null,
}

/**
 * One instance per room id. Holds the timer state and fans updates out to every
 * connected WebSocket (displays and control panels) using the hibernation API.
 */
export class Room extends DurableObject<Env> {
  private state: Stored = DEFAULT

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.state = { ...DEFAULT, ...((await ctx.storage.get<Stored>('state')) ?? {}) }
    })
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair('ping', 'pong'),
    )
  }

  async fetch(request: Request) {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected websocket', { status: 426 })
    }
    const secret = new URL(request.url).searchParams.get('secret')
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)

    let control = false
    if (secret) {
      if (SECRET_RE.test(secret) && this.state.secret == null) {
        // First control panel to connect claims the room.
        this.state.secret = secret
        await this.save()
        control = true
      } else if (this.state.secret === secret) {
        control = true
      } else {
        this.send(server, { type: 'error', error: 'bad-secret' })
      }
    }
    server.serializeAttachment({ control } satisfies Attachment)
    await this.touch()
    // Everyone gets the new client count (and `claimed`, if this connection claimed the room).
    this.broadcast()

    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    let msg: ClientMessage
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      return this.send(ws, { type: 'error', error: 'bad-request' })
    }
    const { control } = (ws.deserializeAttachment() ?? { control: false }) as Attachment
    if (!control) return this.send(ws, { type: 'error', error: 'not-authorized' })

    const s = this.state
    const now = Date.now()
    const clamp = (ms: number) => Math.max(-MAX_MS, Math.min(MAX_MS, Math.round(ms)))
    switch (msg.type) {
      case 'set': {
        if (!Number.isFinite(msg.ms)) return
        const ms = clamp(Math.max(0, msg.ms))
        s.durationMs = ms
        if (s.endsAt != null) s.endsAt = now + ms
        else s.pausedRemainingMs = ms
        break
      }
      case 'start':
        if (s.endsAt == null) s.endsAt = now + s.pausedRemainingMs
        break
      case 'pause':
        if (s.endsAt != null) {
          s.pausedRemainingMs = clamp(s.endsAt - now)
          s.endsAt = null
        }
        break
      case 'reset':
        s.endsAt = null
        s.pausedRemainingMs = s.durationMs
        break
      case 'adjust': {
        if (!Number.isFinite(msg.deltaMs)) return
        if (s.endsAt != null) s.endsAt = now + clamp(s.endsAt - now + msg.deltaMs)
        else s.pausedRemainingMs = clamp(s.pausedRemainingMs + msg.deltaMs)
        break
      }
      case 'message':
        s.message = String(msg.text ?? '').slice(0, MAX_MESSAGE)
        break
      default:
        return this.send(ws, { type: 'error', error: 'bad-request' })
    }
    await this.save()
    this.broadcast()
  }

  webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code === 1005 ? 1000 : code)
    } catch {}
    this.broadcast()
  }

  webSocketError() {
    this.broadcast()
  }

  /** Open sockets with their role. A socket that is closing is left out. */
  private clients() {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws.readyState === WebSocket.OPEN)
      .map((ws) => ({ ws, ...((ws.deserializeAttachment() ?? { control: false }) as Attachment) }))
  }

  private snapshot(control: boolean, clients = this.clients()): ServerMessage {
    const { secret, ...rest } = this.state
    const controls = clients.filter((c) => c.control).length
    return {
      type: 'state',
      state: { ...rest, claimed: secret != null },
      serverNow: Date.now(),
      control,
      clients: { displays: clients.length - controls, controls },
    }
  }

  private broadcast() {
    const clients = this.clients()
    for (const { ws, control } of clients) this.send(ws, this.snapshot(control, clients))
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg))
    } catch {}
  }

  private async save() {
    await this.ctx.storage.put('state', this.state)
    await this.touch()
  }

  /** Pushes the expiry back to TTL_MS from now. */
  private touch() {
    return this.ctx.storage.setAlarm(Date.now() + TTL_MS)
  }

  async alarm() {
    // A display that is still connected means the room is still in use.
    if (this.ctx.getWebSockets().length > 0) return this.touch()
    await this.ctx.storage.deleteAll()
    this.state = { ...DEFAULT }
  }
}
