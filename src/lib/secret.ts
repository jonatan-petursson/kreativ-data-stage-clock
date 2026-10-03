// The control URL carries a short, non-cryptographic hash of the room password.
// It only needs to keep the control panel out of casual reach.

function cyrb53(str: string, seed = 0) {
  let h1 = 0xdeadbeef ^ seed
  let h2 = 0x41c6ce57 ^ seed
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 4294967296 * (2097151 & h2) + (h1 >>> 0)
}

export function secretFor(roomId: string, password: string) {
  return cyrb53(`stage-clock:${roomId}:${password}`).toString(16).padStart(14, '0').slice(-8)
}

const ROOM_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789' // no 0/o, 1/l

export function randomRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(4))
  return Array.from(bytes, (b) => ROOM_CHARS[b % ROOM_CHARS.length]).join('')
}

const key = (roomId: string) => `stage-clock:secret:${roomId}`

export function rememberSecret(roomId: string, secret: string) {
  try {
    localStorage.setItem(key(roomId), secret)
  } catch {}
}

export function recallSecret(roomId: string) {
  try {
    return localStorage.getItem(key(roomId))
  } catch {
    return null
  }
}

export function forgetSecret(roomId: string) {
  try {
    localStorage.removeItem(key(roomId))
  } catch {}
}
