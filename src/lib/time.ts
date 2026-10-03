const pad = (n: number) => String(n).padStart(2, '0')

/** Formats remaining time for the 7-seg display. Negative values are overtime. */
export function formatClock(ms: number) {
  // Count down in whole seconds, showing 10:00 for the first second after start.
  const over = ms <= -1000
  const total = over ? Math.floor(-ms / 1000) : Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const body = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
  return over ? `-${body}` : body
}

/**
 * Parses "10" (minutes), "10:30" (m:ss), "1:10:30" (h:mm:ss), or "90s" / "1h" / "1h30m".
 * Returns milliseconds, or null if the input isn't understood.
 */
export function parseDuration(input: string): number | null {
  const v = input.trim().toLowerCase()
  if (!v) return null
  if (/^\d+(\.\d+)?$/.test(v)) return Math.round(parseFloat(v) * 60_000)
  if (/^\d+(:\d{1,2}){1,2}$/.test(v)) {
    const parts = v.split(':').map(Number)
    if (parts.slice(1).some((p) => p >= 60)) return null
    const [h, m, s] = parts.length === 3 ? parts : [0, ...parts]
    return ((h * 60 + m) * 60 + s) * 1000
  }
  const unit = /^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/.exec(v)
  if (unit && (unit[1] || unit[2] || unit[3])) {
    const [, h = '0', m = '0', s = '0'] = unit
    return ((+h * 60 + +m) * 60 + +s) * 1000
  }
  return null
}

/** Formats a duration for a text input, e.g. 630000 → "10:30". */
export function formatInput(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}
