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
  const canvasRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<any>(null)

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:8001'
      : 'https://scriblleapp.onrender.com';

  useEffect(() => {
    const newSocket = io(backendUrl, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
    })

    newSocket.on('connect', () => {
      console.log('Connected to server')

      if (isHost) {
        newSocket.emit('create_room', {
          room_code: roomCode,
          username: username,
        })
      } else {
        newSocket.emit('join_room', {
          room_code: roomCode,
          username: username,
        })
      }
    })

    newSocket.on('room_created', (data) => {
      setPlayers(data.players)
      addSystemMessage(`Room ${roomCode} created!`)
    })

    newSocket.on('room_joined', (data) => {
      setPlayers(data.players)
      addSystemMessage(`Joined room ${roomCode}!`)
    })

    newSocket.on('player_joined', (data) => {
      setPlayers(data.players)
      addSystemMessage('A player joined the room')
    })

    newSocket.on('player_left', (data) => {
      setPlayers(data.players)
      addSystemMessage('A player left the room')
    })

    newSocket.on('game_started', () => {
      setGameStarted(true)
      addSystemMessage('Game started! Get ready to draw and guess!')
    })

    newSocket.on('new_round', (data) => {
      console.log('New round:', data)
      setCurrentRound(data.round)
      setCurrentWord(data.word)
      setIsDrawer(data.drawerSid === newSocket.id)
      setTimeLeft(60)

      if (canvasRef.current) {
        canvasRef.current.clear()
      }

      if (data.drawerSid === newSocket.id) {
        addSystemMessage(`Your turn! Draw: ${data.word}`)
      } else {
        addSystemMessage(`${data.drawer} is drawing...`)
      }

      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    })

    newSocket.on('stroke_drawn', (data) => {
      console.log('Received stroke from server:', data)
      if (canvasRef.current) {
        canvasRef.current.drawStroke(data)
      }
    })

    newSocket.on('canvas_cleared', () => {
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
    })

    newSocket.on('correct_guess', (data) => {
      addSystemMessage(`${data.player} guessed correctly! +${data.points} points`, 'correct')
    })

    newSocket.on('guess_result', (data) => {
      if (data.correct) {
        addSystemMessage(`Correct! You earned ${data.points} points!`, 'correct')
      }
    })

    newSocket.on('chat_message', (data) => {
      addMessage(data.username, data.message)
    })

    newSocket.on('round_end', (data) => {
      setPlayers(data.players)
      addSystemMessage(`Round ended! The word was: ${data.word}`, 'system')
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    })

    newSocket.on('game_end', (data) => {
      setPlayers(data.players)
      setGameStarted(false)
      const winner = data.players[0]
      addSystemMessage(`Game Over! Winner: ${winner.username} with ${winner.score} points!`, 'system')
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    })

    newSocket.on('error', (data) => {
      alert(data.message)
    })

    setSocket(newSocket)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      newSocket.disconnect()
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addSystemMessage = (message: string, type: 'system' | 'correct' = 'system') => {
    setMessages((prev) => [...prev, { username: 'System', message, type }])
  }

  const addMessage = (username: string, message: string) => {
    setMessages((prev) => [...prev, { username, message, type: 'guess' }])
  }

  const handleStartGame = () => {
    if (socket && isHost) {
      socket.emit('start_game', { room_code: roomCode })
    }
  }

  const handleSendGuess = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!guessInput.trim() || !socket) return

    socket.emit('send_guess', {
      room_code: roomCode,
      guess: guessInput.trim(),
    })

    setGuessInput('')
  }

  const handleLeaveRoom = () => {
    const confirmed = window.confirm('Are you sure you want to leave the room?')
    if (confirmed) {
      if (socket) {
        socket.disconnect()
      }
      navigate('/')
    }
  }

  const handleStrokeSent = (strokeData: any) => {
    if (socket && isDrawer) {
      socket.emit('draw_stroke', {
        room_code: roomCode,
        ...strokeData,
      })
    }
  }

  const handleClearCanvas = () => {
    if (socket && isDrawer) {
      socket.emit('clear_canvas', { room_code: roomCode })
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
    }
  }

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
              <div className="round-info">Round {currentRound} • {timeLeft}s</div>
            )}
          </div>
        </div>
        {!gameStarted && isHost && players.length >= 2 && (
          <button onClick={handleStartGame} className="start-button">
            Start Game
          </button>
        )}
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
          {gameStarted ? (
            <>
              {isDrawer && (
                <div className="word-display drawer">
                  ✏️ Draw: {currentWord}
                </div>
              )}
              {!isDrawer && currentWord && (
                <div className="word-display guesser">
                  🔍 Word: {currentWord.replace(/./g, '_ ')}
                </div>
              )}
              {isDrawer && (
                <div className="drawing-instructions">
                  👆 Click and drag to draw
                </div>
              )}
              <Canvas
                ref={canvasRef}
                canDraw={isDrawer}
                onStrokeSent={handleStrokeSent}
              />
              {isDrawer && (
                <button className="clear-button" onClick={handleClearCanvas}>
                  🗑️ Clear
                </button>
              )}
            </>
          ) : (
            <div className="waiting-container">
              <div className="waiting-icon">👥</div>
              <div className="waiting-text">Waiting for players...</div>
              <div className="waiting-subtext">{players.length} / 8 players</div>
              {isHost && (
                <div className="waiting-subtext">Need at least 2 players to start</div>
              )}
            </div>
          )}
        </div>

        {/* Chat Sidebar */}
        {gameStarted && (
          <div className="chat-sidebar">
            <div className="chat-header">
              <span className="chat-icon">💬</span>
              <span className="chat-title">Chat</span>
            </div>

            <div className="messages-list">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message-item ${msg.type === 'system' ? 'system' : ''} ${msg.type === 'correct' ? 'correct' : ''}`}
                >
                  {msg.type === 'system' || msg.type === 'correct' ? (
                    <span>{msg.message}</span>
                  ) : (
                    <span>
                      <strong>{msg.username}:</strong> {msg.message}
                    </span>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {!isDrawer && (
              <form className="input-form" onSubmit={handleSendGuess}>
                <input
                  className="guess-input"
                  type="text"
                  placeholder="Type your guess..."
                  value={guessInput}
                  onChange={(e) => setGuessInput(e.target.value)}
                />
                <button type="submit" className="send-button">
                  ➤
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
