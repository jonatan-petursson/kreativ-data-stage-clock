import handler from '@tanstack/react-start/server-entry'
import { ROOM_ID_RE } from './lib/protocol'
import rpiScript from './server/rpi.sh?raw'

export { Room } from './server/room'

const WS_PATH = /^\/api\/rooms\/([^/]+)\/ws$/
const RPI_PATH = /^\/([^/]+)\/rpi\.sh$/

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    const ws = url.pathname.match(WS_PATH)
    if (ws) {
      const roomId = ws[1]
      if (!ROOM_ID_RE.test(roomId)) return new Response('Bad room id', { status: 400 })
      return env.ROOM.get(env.ROOM.idFromName(roomId)).fetch(request)
    }

    const rpi = url.pathname.match(RPI_PATH)
    if (rpi) {
      const roomId = rpi[1].toLowerCase()
      if (!ROOM_ID_RE.test(roomId)) return new Response('Bad room id\n', { status: 400 })
      const body = rpiScript.replaceAll('__ORIGIN__', url.origin).replaceAll('__ROOM__', roomId)
      return new Response(body, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    }

    return handler.fetch(request)
  },
} satisfies ExportedHandler<Env>
