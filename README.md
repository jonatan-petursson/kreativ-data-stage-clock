# Stage Clock

**[sc.jpp.fyi](https://sc.jpp.fyi)** — a countdown for the person on stage, controlled from anywhere.

- `sc.jpp.fyi/<room>` — the display. A full-screen seven-segment countdown with an
  optional message underneath. The cog (top right) fades out after a few seconds
  without interaction; tap or move the mouse to bring it back.
- `sc.jpp.fyi/<room>/<secret>` — the control panel. Set the time, start/pause/reset,
  nudge ±1 minute, and show or clear a message. Every display in the room updates instantly.

Room ids are short lowercase strings (`45sx`, `a34d`). The secret is an 8-character,
non-cryptographic hash of the room password. The first control panel to connect to a
room sets its password; tapping the cog on a display asks for it and takes you to the
control panel.

The clock turns amber in the last minute and red (counting up) once time is over.

Rooms are deleted after 8 hours with no changes and no connected clients. A display left
open keeps its room alive.

## Raspberry Pi kiosk

On Raspberry Pi OS with desktop, run this once in a terminal, as your normal user:

```sh
curl -fsSL https://sc.jpp.fyi/<room>/rpi.sh | bash
```

It installs Chromium if it's missing, turns on desktop autologin and turns off screen
blanking. It then adds `~/.local/bin/stage-clock-kiosk` to the desktop's autostart. The
launcher waits for the network, opens the room full screen and restarts the browser if it
exits. Run the command again with another room ID to switch rooms. The script is
`src/server/rpi.sh`, and the control panel shows the command for its room.

## How it works

TanStack Start app on Cloudflare Workers. Each room is a Durable Object (`src/server/room.ts`)
holding the timer state; displays and control panels connect to it over a WebSocket at
`/api/rooms/<room>/ws` (routed in `src/server.ts`). The timer is stored as an end time,
so clients tick locally and only hear from the server when something changes.

## Development

```sh
npm install
npm run dev        # http://localhost:3000
npx tsc --noEmit
```

## Deploying

Cloudflare Workers Builds is connected to this repo and deploys every push to `main`
(build command `npm run build`, deploy command `npx wrangler deploy`). To deploy by hand:
`npm run deploy`.

The 7-segment font is [DSEG](https://www.keshikan.net/fonts-e.html) by keshikan (SIL OFL 1.1).
