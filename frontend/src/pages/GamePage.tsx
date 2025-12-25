import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import Canvas from '../components/Canvas'
import '../styles/GamePage.css'

interface Player {
  id: string
  username: string
  score: number
  isHost: boolean
  avatar: string | null
}

interface Message {
  username: string
  message: string
  type: 'system' | 'guess' | 'chat' | 'correct'
}

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
}

interface GameState {
  round: number
  drawer: string
  drawerSid: string
  word: string
  wordLength: number
  roundTime: number
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
  const [drawerName, setDrawerName] = useState('')
  const [wordMask, setWordMask] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  
  const canvasRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const guessInputRef = useRef<HTMLInputElement>(null)

  // Use Render URL for production, localhost for development
  const backendUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:8001' 
    : 'https://scriblleapp.onrender.com'

  useEffect(() => {
    if (!username || !roomCode) {
      alert('Missing username or room code')
      navigate('/')
      return
    }

    console.log(`🎮 Initializing game - Room: ${roomCode}, Username: ${username}, Host: ${isHost}`)

    const newSocket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ Connected to server with ID:', newSocket.id)
      setConnectionStatus('connected')
      addSystemMessage('Connected to game server')
      
      if (isHost) {
        console.log('🎯 Creating room as host...')
        newSocket.emit('create_room', {
          username: username,
          room_code: roomCode
        })
      } else {
        console.log('🚪 Joining room as guest...')
        newSocket.emit('join_room', {
          room_code: roomCode,
          username: username
        })
      }
    })

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error)
      setConnectionStatus('disconnected')
      addSystemMessage('Connection failed. Trying to reconnect...')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('📴 Disconnected:', reason)
      setConnectionStatus('disconnected')
      if (reason !== 'io client disconnect') {
        addSystemMessage('Disconnected from server. Reconnecting...')
      }
    })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔁 Reconnected after', attemptNumber, 'attempts')
      setConnectionStatus('connected')
      addSystemMessage('Reconnected to server')
      
      // Re-join room after reconnection
      if (gameStarted) {
        newSocket.emit('join_room', {
          room_code: roomCode,
          username: username
        })
      }
    })

    // Room events
    newSocket.on('room_created', (data) => {
      console.log('🏠 Room created:', data)
      setPlayers(data.players)
      addSystemMessage(`Room ${roomCode} created! Share code: ${roomCode}`)
    })

    newSocket.on('room_joined', (data) => {
      console.log('👤 Room joined:', data)
      setPlayers(data.players)
      addSystemMessage(`Successfully joined room ${roomCode}`)
    })

    newSocket.on('room_players_update', (data) => {
      console.log('👥 Players updated:', data)
      setPlayers(data.players)
      if (data.message) {
        addSystemMessage(data.message)
      }
    })

    newSocket.on('player_joined', (data) => {
      console.log('🆕 Player joined:', data)
      setPlayers(data.players)
      if (data.player.username !== username) {
        addSystemMessage(`${data.player.username} joined the game!`)
      }
    })

    newSocket.on('player_left', (data) => {
      console.log('👋 Player left:', data)
      setPlayers(data.players)
      addSystemMessage(`${data.player} left the game`)
    })

    newSocket.on('new_host', (data) => {
      console.log('👑 New host:', data)
      addSystemMessage(`${data.host} is now the host`)
    })

    // Game events
    newSocket.on('game_started', (data) => {
      console.log('🎯 Game started:', data)
      setGameStarted(true)
      setCurrentRound(data.currentRound || 1)
      setPlayers(data.players)
      addSystemMessage('Game started! Get ready to draw and guess!')
    })

    newSocket.on('new_round', (data: GameState) => {
      console.log('🔄 New round:', data)
      setCurrentRound(data.round)
      setDrawerName(data.drawer)
      setIsDrawer(data.drawerSid === newSocket.id)
      setCurrentWord(data.word)
      setWordMask(data.word)
      setTimeLeft(data.roundTime || 60)
      
      // Clear canvas
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
      
      // Clear timer
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      
      // Start countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) {
              clearInterval(timerRef.current)
            }
            return 0
          }
          return prev - 1
        })
      }, 1000)
      
      if (data.drawerSid === newSocket.id) {
        addSystemMessage(`🎨 Your turn to draw: "${data.word}"`)
      } else {
        addSystemMessage(`🎨 ${data.drawer} is drawing...`)
      }
    })

    newSocket.on('round_started', (data) => {
      console.log('⏱️ Round started:', data)
      setTimeLeft(data.timeLeft || 60)
      addSystemMessage(`Round ${data.round} started! ${data.drawer} is drawing.`)
    })

    newSocket.on('stroke_drawn', (data: Stroke) => {
      console.log('✏️ Stroke received:', data)
      if (canvasRef.current && !isDrawer) {
        canvasRef.current.drawStroke(data)
      }
    })

    newSocket.on('canvas_cleared', () => {
      console.log('🗑️ Canvas cleared')
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
    })

    newSocket.on('correct_guess', (data) => {
      console.log('🎉 Correct guess:', data)
      addSystemMessage(`🎉 ${data.player} guessed correctly! +${data.points} points`, 'correct')
      // Update scores
      setPlayers(prev => prev.map(player => 
        player.username === data.player 
          ? { ...player, score: player.score + data.points }
          : player
      ))
    })

    newSocket.on('guess_result', (data) => {
      console.log('📝 Guess result:', data)
      if (data.correct) {
        addSystemMessage(`✅ Correct! The word was "${data.word}". You earned ${data.points} points!`, 'correct')
      }
    })

    newSocket.on('chat_message', (data) => {
      console.log('💬 Chat message:', data)
      addMessage(data.username, data.message, data.type as any)
    })

    newSocket.on('round_end', (data) => {
      console.log('🏁 Round ended:', data)
      addSystemMessage(`Round ended! The word was: "${data.word}"`)
      addSystemMessage(`Scoreboard: ${data.players.map((p: any) => `${p.username}: ${p.score}`).join(', ')}`)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    })

    newSocket.on('game_end', (data) => {
      console.log('🏆 Game ended:', data)
      setGameStarted(false)
      const winner = data.winner || data.players[0]
      addSystemMessage(`🏆 Game Over! Winner: ${winner.username} with ${winner.score} points!`)
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    })

    newSocket.on('error', (data) => {
      console.error('❌ Error:', data)
      alert(`Error: ${data.message}`)
      if (data.message.includes('Room not found') || data.message.includes('Room already exists')) {
        navigate('/')
      }
    })

    // Handle game state update for rejoining players
    newSocket.on('game_state_update', (data) => {
      console.log('🔄 Game state update:', data)
      if (data.gameStarted) {
        setGameStarted(true)
        setCurrentRound(data.currentRound)
        setDrawerName(data.drawer)
        setIsDrawer(data.drawerSid === newSocket.id)
        setCurrentWord(data.word)
        setWordMask(data.word)
        setTimeLeft(data.timeLeft)
      }
    })

    setSocket(newSocket)

    // Cleanup on unmount
    return () => {
      console.log('🧹 Cleaning up socket connection')
      if (newSocket) {
        newSocket.disconnect()
      }
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [roomCode, username, isHost, navigate])

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Focus guess input when game starts and not drawer
  useEffect(() => {
    if (gameStarted && !isDrawer && guessInputRef.current) {
      guessInputRef.current.focus()
    }
  }, [gameStarted, isDrawer])

  const addSystemMessage = (message: string, type: 'system' | 'correct' = 'system') => {
    setMessages((prev) => [...prev, { username: 'System', message, type }])
  }

  const addMessage = (username: string, message: string, type: 'system' | 'guess' | 'chat' | 'correct' = 'chat') => {
    setMessages((prev) => [...prev, { username, message, type }])
  }

  const handleStartGame = () => {
    if (socket && isHost) {
      if (players.length < 2) {
        alert('Need at least 2 players to start the game')
        return
      }
      socket.emit('start_game', { room_code: roomCode })
      addSystemMessage('Starting game...')
    }
  }

  const handleSendGuess = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!guessInput.trim() || !socket || isDrawer) return

    console.log('📤 Sending guess:', guessInput)
    socket.emit('send_guess', {
      room_code: roomCode,
      guess: guessInput.trim()
    })

    addMessage(username, guessInput, 'guess')
    setGuessInput('')
    
    // Refocus input
    if (guessInputRef.current) {
      guessInputRef.current.focus()
    }
  }

  const handleSendMessage = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!guessInput.trim() || !socket) return

    socket.emit('chat_message', {
      room_code: roomCode,
      message: guessInput.trim()
    })

    setGuessInput('')
  }

  const handleStrokeSent = (strokeData: Stroke) => {
    if (socket && isDrawer) {
      console.log('🎨 Sending stroke:', strokeData)
      socket.emit('draw_stroke', {
        room_code: roomCode,
        ...strokeData
      })
    }
  }

  const handleClearCanvas = () => {
    if (socket && isDrawer) {
      socket.emit('clear_canvas', { room_code: roomCode })
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
      addSystemMessage('Canvas cleared')
    }
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

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode)
    addSystemMessage('Room code copied to clipboard!')
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && guessInput.trim()) {
      if (gameStarted && !isDrawer) {
        handleSendGuess(e)
      } else {
        handleSendMessage(e)
      }
    }
  }

  // Format time display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get player list sorted by score
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="game-container">
      {/* Header */}
      <div className="game-header">
        <div className="header-left">
          <button onClick={handleLeaveRoom} className="icon-button back-button">
            ← Leave
          </button>
          <div className="header-info">
            <div className="room-code-display">
              <span className="room-label">Room:</span>
              <span className="room-code" onClick={handleCopyRoomCode} title="Click to copy">
                {roomCode}
              </span>
              <div className="connection-status">
                <div className={`status-dot ${connectionStatus}`}></div>
                <span>{connectionStatus}</span>
              </div>
            </div>
            {gameStarted && (
              <div className="round-timer">
                <span className="round-label">Round {currentRound}</span>
                <span className="timer">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="header-right">
          {!gameStarted && isHost && players.length >= 2 && (
            <button onClick={handleStartGame} className="start-game-button">
              🎮 Start Game
            </button>
          )}
          {gameStarted && isDrawer && (
            <button onClick={handleClearCanvas} className="clear-canvas-button">
              🗑️ Clear Canvas
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel - Players */}
        <div className="players-panel">
          <div className="panel-header">
            <h3>👥 Players ({players.length})</h3>
          </div>
          <div className="players-list">
            {sortedPlayers.map((player) => (
              <div 
                key={player.id} 
                className={`player-card ${player.isHost ? 'host' : ''} ${gameStarted && player.username === drawerName ? 'drawer' : ''}`}
              >
                <div className="player-avatar">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div className="player-info">
                  <div className="player-name">
                    {player.username}
                    {player.isHost && <span className="host-badge">👑</span>}
                    {gameStarted && player.username === drawerName && <span className="drawer-badge">🎨</span>}
                  </div>
                  <div className="player-score">{player.score} pts</div>
                </div>
              </div>
            ))}
          </div>
          {!gameStarted && (
            <div className="waiting-section">
              <div className="waiting-icon">⏳</div>
              <div className="waiting-text">
                {isHost ? 'You are the host' : 'Waiting for host to start...'}
              </div>
              {isHost && players.length < 2 && (
                <div className="min-players-warning">
                  Need {2 - players.length} more player(s) to start
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Panel - Canvas */}
        <div className="canvas-panel">
          {gameStarted ? (
            <>
              <div className="canvas-header">
                {isDrawer ? (
                  <div className="word-display drawer">
                    <span className="label">🎨 Your word to draw:</span>
                    <span className="word">{currentWord.toUpperCase()}</span>
                  </div>
                ) : (
                  <div className="word-display guesser">
                    <span className="label">🔍 Guess the word:</span>
                    <span className="word">
                      {wordMask.split('').map((char, index) => (
                        char === '_' ? '_ ' : char + ' '
                      ))}
                    </span>
                    <span className="hint">({currentWord.length} letters)</span>
                  </div>
                )}
                <div className="drawer-info">
                  🎨 Drawing: <strong>{drawerName}</strong>
                </div>
              </div>
              
              <div className="canvas-wrapper">
                <Canvas
                  ref={canvasRef}
                  canDraw={isDrawer && gameStarted}
                  onStrokeSent={handleStrokeSent}
                />
                {isDrawer && (
                  <div className="drawing-instructions">
                    👆 Click and drag to draw • 🗑️ Clear button above
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="waiting-lobby">
              <div className="lobby-icon">🎨</div>
              <div className="lobby-title">Scribble Game</div>
              <div className="lobby-subtitle">Waiting in Lobby</div>
              <div className="lobby-room-code">
                <div className="room-code-label">Room Code:</div>
                <div className="room-code-large" onClick={handleCopyRoomCode}>
                  {roomCode}
                </div>
                <button className="copy-button" onClick={handleCopyRoomCode}>
                  📋 Copy
                </button>
              </div>
              <div className="lobby-players">
                <div className="players-count">{players.length} / 8 players</div>
                <div className="players-list-small">
                  {players.map(player => player.username).join(', ')}
                </div>
              </div>
              {isHost && (
                <div className="host-instructions">
                  <p>As host, you can start the game when ready!</p>
                  <p>Share the room code with friends to join.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="chat-panel">
          <div className="panel-header">
            <h3>💬 Chat</h3>
          </div>
          
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <div className="chat-icon">💭</div>
                <p>No messages yet</p>
                <p>Start chatting!</p>
              </div>
            ) : (
              <div className="messages-list">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message-item ${msg.type} ${msg.username === username ? 'own' : ''}`}
                  >
                    {msg.type === 'system' || msg.type === 'correct' ? (
                      <div className="system-message">
                        <span className={`message-content ${msg.type}`}>
                          {msg.type === 'correct' ? '🎉 ' : '📢 '}{msg.message}
                        </span>
                      </div>
                    ) : (
                      <div className="user-message">
                        <span className="message-username">
                          {msg.username}
                          {msg.username === username && ' (You)'}:
                        </span>
                        <span className="message-content">{msg.message}</span>
                        {msg.type === 'guess' && <span className="guess-badge">🎯</span>}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          
          <div className="chat-input-container">
            <form onSubmit={gameStarted && !isDrawer ? handleSendGuess : handleSendMessage}>
              <input
                ref={guessInputRef}
                type="text"
                className="chat-input"
                placeholder={
                  gameStarted 
                    ? (isDrawer ? "You're drawing (chat disabled)" : "Type your guess...") 
                    : "Type a message..."
                }
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={gameStarted && isDrawer}
                maxLength={50}
              />
              <button 
                type="submit" 
                className="send-button"
                disabled={!guessInput.trim() || (gameStarted && isDrawer)}
              >
                {gameStarted && !isDrawer ? '🎯 Guess' : '📤 Send'}
              </button>
            </form>
            <div className="input-hint">
              {gameStarted && !isDrawer 
                ? 'Press Enter to submit guess' 
                : 'Press Enter to send message'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Status */}
      <div className="game-footer">
        <div className="status-info">
          {gameStarted ? (
            <>
              <span>🎮 Game in progress • </span>
              <span>Round {currentRound} of 5 • </span>
              <span>{isDrawer ? '🎨 You are drawing' : '🔍 You are guessing'}</span>
            </>
          ) : (
            <span>⏳ Waiting in lobby • {players.length} player(s) connected</span>
          )}
        </div>
        <div className="user-info">
          <span className="user-badge">{username}</span>
          {isHost && <span className="host-badge">Host</span>}
        </div>
      </div>
    </div>
  )
}