import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/GamePage.css'

interface Player {
  sid: string
  username: string
  score: number
}

export default function GamePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const username = params.get('username') || ''
  const roomCode = params.get('roomCode') || ''

  const [socket, setSocket] = useState<Socket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [messages, setMessages] = useState<string[]>([])

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:10000'
      : 'https://scriblleapp.onrender.com'

  /* ======================
     SOCKET
  ======================= */
  useEffect(() => {
    const s = io(backendUrl, {
      transports: ['websocket'],
      upgrade: false,
    })

    setSocket(s)

    s.on('connect', () => {
      console.log('🎮 Game socket connected')

      // ✅ ALWAYS JOIN ROOM
      s.emit('join_room', {
        room_code: roomCode,
        username,
      })
    })

    s.on('room_created', (data) => {
      setPlayers(data.players)
      setMessages((m) => [...m, 'Room created'])
    })

    s.on('room_joined', (data) => {
      setPlayers(data.players)
      setMessages((m) => [...m, 'Joined room'])
    })

    s.on('player_joined', (data) => {
      setPlayers(data.players)
      setMessages((m) => [...m, 'Player joined'])
    })

    s.on('player_left', (data) => {
      setPlayers(data.players)
      setMessages((m) => [...m, 'Player left'])
    })

    s.on('error', (err) => {
      alert(err.message)
      navigate('/')
    })

    return () => {
      s.disconnect()
    }
  }, [backendUrl, roomCode, username, navigate])

  return (
    <div className="game-container">
      <h2>Room: {roomCode}</h2>

      <h3>Players</h3>
      {players.map((p) => (
        <div key={p.sid}>
          {p.username} — {p.score}
        </div>
      ))}

      <h3>Logs</h3>
      {messages.map((m, i) => (
        <div key={i}>{m}</div>
      ))}

      <button onClick={() => navigate('/')}>Leave</button>
    </div>
  )
}
