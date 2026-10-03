// Shared between the Room durable object and the browser clients.

export const ROOM_ID_RE = /^[a-z0-9]{2,16}$/
export const SECRET_RE = /^[a-f0-9]{8}$/

export type TimerState = {
  /** The time the clock was last set to, used by "reset". */
  durationMs: number
  /** Epoch ms (server clock) when the countdown hits zero, or null while paused. */
  endsAt: number | null
  /** Remaining time while paused. */
  pausedRemainingMs: number
  message: string
  /** Whether a control password has been set for the room. */
  claimed: boolean
}

export type ServerMessage =
  | {
      type: 'state'
      state: TimerState
      serverNow: number
      control: boolean
      /** Open connections in the room, including the receiver. */
      clients: { displays: number; controls: number }
    }
  | { type: 'error'; error: 'bad-secret' | 'not-authorized' | 'bad-request' }

export type ClientMessage =
  | { type: 'set'; ms: number }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'adjust'; deltaMs: number }
  | { type: 'message'; text: string }

export const MAX_MS = 100 * 3600_000 - 1000
export const MAX_MESSAGE = 280

export function remainingMs(s: TimerState, serverNow: number) {
  return s.endsAt == null ? s.pausedRemainingMs : s.endsAt - serverNow
}
