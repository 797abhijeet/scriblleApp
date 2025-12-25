import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import Canvas from '../components/Canvas'
import '../styles/GamePage.css'

interface Player {
  sid: string
  username: string
  score: number
  isHost: boolean
}

interface Message {
  username: string
  message: string
  type?: 'system' | 'guess' | 'correct'
}

export default function GamePage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const username = searchParams.get('username') || ''
  const roomCode = searchParams.get('roomCode') || ''
  const isHost = searchParams.get('isHost') === 'true'

  const [socket, setSocket] = useState<Socket | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [gameStarted, setGameStarted] = useState(false)
  const [currentRound, setCurrentRound] = useState(0)
  const [currentWord, setCurrentWord] = useState('')
  const [isDrawer, setIsDrawer] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [guessInput, setGuessInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [color, setColor] = useState('#000')

  const canvasRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<any>(null)

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:8001'
      : 'https://scriblleapp.onrender.com'

  /* -------------------- SOCKET SETUP -------------------- */
  useEffect(() => {
    const newSocket = io(backendUrl, {
      path: '/api/socket.io',
      transports: ['websocket'], // 🔥 production safe
      reconnection: true,
    })

    newSocket.on('connect', () => {
      if (isHost) {
        newSocket.emit('create_room', { room_code: roomCode, username })
      } else {
        newSocket.emit('join_room', { room_code: roomCode, username })
      }

      // 🔄 request draw history on reconnect
      newSocket.emit('request_history', { room_code: roomCode })
    })

    /* ---------- ROOM EVENTS ---------- */
    newSocket.on('room_created', (d) => setPlayers(d.players))
    newSocket.on('room_joined', (d) => setPlayers(d.players))
    newSocket.on('player_joined', (d) => setPlayers(d.players))
    newSocket.on('player_left', (d) => setPlayers(d.players))

    newSocket.on('host_changed', (d) =>
      addSystemMessage(`${d.newHostUsername} is now host 👑`)
    )

    /* ---------- GAME EVENTS ---------- */
    newSocket.on('game_started', () => {
      setGameStarted(true)
      addSystemMessage('Game started!')
    })

    newSocket.on('new_round', (d) => {
      setCurrentRound(d.round)
      setCurrentWord(d.word)
      setIsDrawer(d.drawerSid === newSocket.id)
      setTimeLeft(60)
      canvasRef.current?.clear()

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => (t <= 1 ? 0 : t - 1))
      }, 1000)
    })

    newSocket.on('round_end', (d) => {
      setPlayers(d.players)
      addSystemMessage(`Word was: ${d.word}`)
      clearInterval(timerRef.current)
    })

    newSocket.on('game_end', (d) => {
      setPlayers(d.players)
      addSystemMessage(`Winner: ${d.players[0].username}`)
      setGameStarted(false)
    })

    /* ---------- DRAW EVENTS ---------- */
    newSocket.on('draw_history', (strokes) => {
      canvasRef.current?.clear()
      strokes.forEach((s: any) => canvasRef.current?.drawStroke(s))
    })

    newSocket.on('stroke_drawn', (stroke) => {
      canvasRef.current?.drawStroke(stroke)
    })

    newSocket.on('color_changed', (c) => setColor(c))

    /* ---------- CHAT ---------- */
    newSocket.on('system_message', (d) =>
      setMessages((p) => [...p, { username: 'System', message: d.text, type: 'correct' }])
    )

    newSocket.on('chat_message', (d) =>
      setMessages((p) => [...p, { username: d.username, message: d.message, type: 'guess' }])
    )

    setSocket(newSocket)

    return () => {
      clearInterval(timerRef.current)
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* -------------------- HELPERS -------------------- */
  const addSystemMessage = (message: string) => {
    setMessages((p) => [...p, { username: 'System', message, type: 'system' }])
  }

  const handleStrokeSent = (stroke: any) => {
    if (socket && isDrawer) {
      socket.emit('draw_stroke', {
        room_code: roomCode,
        ...stroke,
        color,
        width: 3,
      })
    }
  }

  const handleUndo = () => socket?.emit('undo', { room_code: roomCode })
  const handleRedo = () => socket?.emit('redo', { room_code: roomCode })

  const handleColorChange = (c: string) => {
    setColor(c)
    socket?.emit('color_change', { room_code: roomCode, color: c })
  }

  const handleSendGuess = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!guessInput.trim()) return
    socket?.emit('send_guess', { room_code: roomCode, guess: guessInput })
    setGuessInput('')
  }

  const handleLeaveRoom = () => {
    socket?.disconnect()
    navigate('/')
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="game-container">
      <div className="game-header">
        <button onClick={handleLeaveRoom}>←</button>
        <div>Room: {roomCode}</div>
        {gameStarted && <div>Round {currentRound} • {timeLeft}s</div>}
      </div>

      <div className="players-list">
        {players.map(p => (
          <div key={p.sid}>{p.username} — {p.score}</div>
        ))}
      </div>

      <div className="main-content">
        <div className="canvas-container">
          {isDrawer && (
            <div className="tools">
              <button onClick={handleUndo}>↩️</button>
              <button onClick={handleRedo}>↪️</button>
              <input type="color" value={color} onChange={e => handleColorChange(e.target.value)} />
            </div>
          )}

          <Canvas
            ref={canvasRef}
            canDraw={isDrawer}
            onStrokeSent={handleStrokeSent}
          />
        </div>

        {gameStarted && !isDrawer && (
          <form onSubmit={handleSendGuess}>
            <input
              value={guessInput}
              onChange={e => setGuessInput(e.target.value)}
              placeholder="Type guess..."
            />
          </form>
        )}

        <div className="messages">
          {messages.map((m, i) => (
            <div key={i}>{m.username}: {m.message}</div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
    </div>
  )
}
