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
      transports: ['websocket'], // ✅ production safe
      reconnection: true,
    })

    newSocket.on('connect', () => {
      if (isHost) {
        newSocket.emit('create_room', { room_code: roomCode, username })
      } else {
        newSocket.emit('join_room', { room_code: roomCode, username })
      }

      // 🔄 redraw history on reconnect
      newSocket.emit('request_history', { room_code: roomCode })
    })

    /* ---------- ROOM EVENTS ---------- */
    newSocket.on('room_created', (d) => setPlayers(d.players))
    newSocket.on('room_joined', (d) => setPlayers(d.players))
    newSocket.on('player_joined', (d) => setPlayers(d.players))
    newSocket.on('player_left', (d) => setPlayers(d.players))

    newSocket.on('host_changed', (d) => {
      setMessages((p) => [
        ...p,
        { username: 'System', message: `${d.newHostUsername} is now the room host 👑`, type: 'system' },
      ])
    })

    /* ---------- GAME EVENTS ---------- */
    newSocket.on('game_started', () => {
      setGameStarted(true)
      setMessages((p) => [...p, { username: 'System', message: 'Game started!', type: 'system' }])
    })

    newSocket.on('new_round', (d) => {
      setCurrentRound(d.round)
      setCurrentWord(d.word)
      setIsDrawer(d.drawerSid === newSocket.id)
      setTimeLeft(60)
      canvasRef.current?.clear()

      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        setTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return t - 1
        })
      }, 1000)
    })

    newSocket.on('round_end', (d) => {
      setPlayers(d.players)
      setMessages((p) => [
        ...p,
        { username: 'System', message: `Round ended! The word was: ${d.word}`, type: 'system' },
      ])
      clearInterval(timerRef.current)
    })

    newSocket.on('game_end', (d) => {
      setPlayers(d.players)
      setGameStarted(false)
      setMessages((p) => [
        ...p,
        {
          username: 'System',
          message: `Game Over! Winner: ${d.players[0].username}`,
          type: 'system',
        },
      ])
      clearInterval(timerRef.current)
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
    newSocket.on('system_message', (d) => {
      setMessages((p) => [...p, { username: 'System', message: d.text, type: 'correct' }])
    })

    newSocket.on('chat_message', (d) => {
      setMessages((p) => [...p, { username: d.username, message: d.message, type: 'guess' }])
    })

    setSocket(newSocket)

    return () => {
      clearInterval(timerRef.current)
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* -------------------- ACTIONS -------------------- */
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

  /* -------------------- UI (UNCHANGED) -------------------- */
  return (
    <div className="game-container">
      {/* Header */}
      <div className="game-header">
        <div className="header-left">
          <button onClick={handleLeaveRoom} className="icon-button">
            ←
          </button>
          <div>
            <div className="room-code">Room: {roomCode}</div>
            {gameStarted && (
              <div className="round-info">
                Round {currentRound} • {timeLeft}s
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Players List */}
      <div className="players-container">
        <div className="players-list">
          {players.map((player) => (
            <div key={player.sid} className="player-card">
              <div className={`player-avatar ${isDrawer && player.sid === socket?.id ? 'drawer' : ''}`}>
                {player.username.charAt(0).toUpperCase()}
              </div>
              <div className="player-name">{player.username}</div>
              <div className="player-score">{player.score}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Canvas */}
        <div className="canvas-container">
          {gameStarted && (
            <>
              {isDrawer && (
                <div className="tools">
                  <button onClick={handleUndo}>↩️</button>
                  <button onClick={handleRedo}>↪️</button>
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => handleColorChange(e.target.value)}
                  />
                </div>
              )}

              <Canvas
                ref={canvasRef}
                canDraw={isDrawer}
                onStrokeSent={handleStrokeSent}
              />
            </>
          )}
        </div>

        {/* Chat */}
        {gameStarted && (
          <div className="chat-sidebar">
            <div className="messages-list">
              {messages.map((msg, i) => (
                <div key={i} className={`message-item ${msg.type}`}>
                  {msg.type === 'guess' ? (
                    <strong>{msg.username}: </strong>
                  ) : null}
                  {msg.message}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {!isDrawer && (
              <form className="input-form" onSubmit={handleSendGuess}>
                <input
                  className="guess-input"
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                  placeholder="Type your guess..."
                />
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
