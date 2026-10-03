import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ROOM_ID_RE } from '#/lib/protocol'
import { randomRoomId, rememberSecret, secretFor } from '#/lib/secret'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const navigate = useNavigate()
  const [room, setRoom] = useState('')
  const [creating, setCreating] = useState(false)
  const [password, setPassword] = useState('')
  const id = room.trim().toLowerCase()
  const valid = ROOM_ID_RE.test(id)

  function join(e: React.FormEvent) {
    e.preventDefault()
    if (valid) navigate({ to: '/$room', params: { room: id } })
  }

  function create(e: React.FormEvent) {
    e.preventDefault()
    if (!password) return
    const newId = randomRoomId()
    const secret = secretFor(newId, password)
    rememberSecret(newId, secret)
    navigate({ to: '/$room/$secret', params: { room: newId, secret } })
  }

  return (
    <main className="home">
      <h1 className="home-title">Stage Clock</h1>
      <form className="card" onSubmit={join}>
        <label htmlFor="room">Room ID</label>
        <div className="row">
          <input
            id="room"
            value={room}
            onChange={(e) => setRoom(e.target.value.replace(/[^a-z0-9]/gi, '').toLowerCase())}
            placeholder="e.g. 45sx"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={16}
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            Join
          </button>
        </div>
      </form>

      {creating ? (
        <form className="card" onSubmit={create}>
          <label htmlFor="pw">Password for the control panel</label>
          <div className="row">
            <input
              id="pw"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={!password}>
              Create
            </button>
          </div>
        </form>
      ) : (
        <button type="button" className="link" onClick={() => setCreating(true)}>
          or create a new room
        </button>
      )}
    </main>
  )
}
