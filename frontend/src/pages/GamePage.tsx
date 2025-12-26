import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import Canvas from '../components/Canvas'


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

  // ... Continue from where we left off in GamePage.tsx

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white">
      {/* Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-black/30 backdrop-blur-lg border-b-2 border-white/10">
        <div className="flex items-center gap-5">
          <button
            onClick={handleLeaveRoom}
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg cursor-pointer border border-white/20 transition-all duration-300"
          >
            ← Leave
          </button>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <span className="opacity-80">Room:</span>
              <span
                className="text-lg font-bold bg-white/10 px-3 py-1 rounded cursor-pointer transition-all duration-300 hover:bg-white/20 hover:scale-105"
                onClick={handleCopyRoomCode}
                title="Click to copy"
              >
                {roomCode}
              </span>
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 shadow-[0_0_10px_#4CAF50]' : connectionStatus === 'connecting' ? 'bg-yellow-500 shadow-[0_0_10px_#FFC107] animate-pulse' : 'bg-red-500 shadow-[0_0_10px_#f44336]'}`}></div>
                <span className="text-sm">{connectionStatus}</span>
              </div>
            </div>
            {gameStarted && (
              <div className="flex items-center gap-3">
                <span className="text-sm opacity-80">Round {currentRound}</span>
                <span className="text-base font-bold bg-white/15 px-2.5 py-0.5 rounded">{formatTime(timeLeft)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          {!gameStarted && isHost && players.length >= 2 && (
            <button
              onClick={handleStartGame}
              className="bg-gradient-to-br from-green-500 to-green-700 hover:shadow-[0_5px_15px_rgba(76,175,80,0.4)] text-white px-5 py-2.5 rounded-lg font-bold cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
            >
              🎮 Start Game
            </button>
          )}
          {gameStarted && isDrawer && (
            <button
              onClick={handleClearCanvas}
              className="bg-gradient-to-br from-red-500 to-red-700 hover:shadow-[0_5px_15px_rgba(244,67,54,0.4)] text-white px-5 py-2.5 rounded-lg font-bold cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
            >
              🗑️ Clear Canvas
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 p-5 gap-5 overflow-hidden">
        {/* Left Panel - Players */}
        <div className="w-72 bg-black/30 backdrop-blur-lg rounded-2xl p-5 flex flex-col">
          <div className="mb-5 pb-4 border-b border-white/10">
            <h3 className="text-xl m-0">👥 Players ({players.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto flex flex-col gap-2.5">
            {sortedPlayers.map((player) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-3 py-3 bg-white/10 rounded-xl transition-all duration-300 hover:bg-white/15 hover:translate-x-1.5 ${player.isHost ? 'border-l-4 border-yellow-500' : ''} ${gameStarted && player.username === drawerName ? 'border-l-4 border-green-500' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center font-bold text-lg">
                  {player.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1 font-bold">
                    {player.username}
                    {player.isHost && <span className="text-sm">👑</span>}
                    {gameStarted && player.username === drawerName && <span className="text-sm">🎨</span>}
                  </div>
                  <div className="text-sm opacity-80">{player.score} pts</div>
                </div>
              </div>
            ))}
          </div>
          {!gameStarted && (
            <div className="mt-auto text-center px-5 py-5 bg-white/5 rounded-xl">
              <div className="text-3xl mb-2.5">⏳</div>
              <div className="mb-2.5 opacity-90">
                {isHost ? 'You are the host' : 'Waiting for host to start...'}
              </div>
              {isHost && players.length < 2 && (
                <div className="text-sm text-yellow-400">
                  Need {2 - players.length} more player(s) to start
                </div>
              )}
            </div>
          )}
        </div>

        {/* Center Panel - Canvas */}
        <div className="flex-1 bg-black/30 backdrop-blur-lg rounded-2xl p-5 flex flex-col">
          {gameStarted ? (
            <>
              <div className="mb-5 text-center">
                {isDrawer ? (
                  <div className="bg-gradient-to-br from-green-500/20 to-green-700/20 border-2 border-green-500 rounded-xl p-4 mb-2.5">
                    <span className="block mb-1 text-sm opacity-80">🎨 Your word to draw:</span>
                    <span className="text-2xl font-bold tracking-wider">{currentWord.toUpperCase()}</span>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-blue-500/20 to-blue-700/20 border-2 border-blue-500 rounded-xl p-4 mb-2.5">
                    <span className="block mb-1 text-sm opacity-80">🔍 Guess the word:</span>
                    <span className="text-2xl font-bold tracking-wider">
                      {wordMask.split('').map((char) => (
                        char === '_' ? '_ ' : char + ' '
                      ))}
                    </span>
                    <span className="text-sm opacity-70 ml-2.5">({currentWord.length} letters)</span>
                  </div>
                )}
                <div className="text-lg opacity-90">
                  🎨 Drawing: <strong>{drawerName}</strong>
                </div>
              </div>

              <div className="flex-1 relative bg-white rounded-xl overflow-hidden">
                <Canvas
                  ref={canvasRef}
                  canDraw={isDrawer && gameStarted}
                  onStrokeSent={handleStrokeSent}
                />
                {isDrawer && (
                  <div className="absolute bottom-2.5 left-0 right-0 text-center text-gray-600 text-sm">
                    👆 Click and drag to draw • 🗑️ Clear button above
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="text-7xl mb-5">🎨</div>
              <div className="text-4xl font-bold mb-2.5">Scribble Game</div>
              <div className="text-xl opacity-80 mb-7.5">Waiting in Lobby</div>
              <div className="bg-white/10 p-5 rounded-2xl mb-7.5 min-w-80">
                <div className="mb-2.5 opacity-80">Room Code:</div>
                <div
                  className="text-5xl font-bold tracking-wider mb-3.75 cursor-pointer transition-all duration-300 hover:scale-105"
                  onClick={handleCopyRoomCode}
                >
                  {roomCode}
                </div>
                <button
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg cursor-pointer transition-all duration-300"
                  onClick={handleCopyRoomCode}
                >
                  📋 Copy
                </button>
              </div>
              <div className="mb-5">
                <div className="text-lg mb-2.5">{players.length} / 8 players</div>
                <div className="opacity-80 max-w-100 break-words">
                  {players.map(player => player.username).join(', ')}
                </div>
              </div>
              {isHost && (
                <div className="bg-white/5 p-3.75 rounded-xl max-w-100">
                  <p className="my-1.25 opacity-90">As host, you can start the game when ready!</p>
                  <p className="my-1.25 opacity-90">Share the room code with friends to join.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Chat */}
        <div className="w-72 bg-black/30 backdrop-blur-lg rounded-2xl p-5 flex flex-col">
          <div className="mb-5 pb-4 border-b border-white/10">
            <h3 className="text-xl m-0">💬 Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto mb-5">
            {messages.length === 0 ? (
              <div className="text-center px-5 py-10 opacity-50">
                <div className="text-5xl mb-2.5">💭</div>
                <p>No messages yet</p>
                <p>Start chatting!</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-2.5 rounded-xl ${msg.type === 'system' ? 'bg-blue-500/10 border-l-4 border-blue-500' : msg.type === 'correct' ? 'bg-green-500/10 border-l-4 border-green-500' : msg.username === username ? 'bg-purple-500/10 border-l-4 border-purple-600' : 'bg-white/5'}`}
                  >
                    {msg.type === 'system' || msg.type === 'correct' ? (
                      <div className="text-center">
                        <span className={`opacity-90 ${msg.type === 'correct' ? 'text-green-500 font-bold' : ''}`}>
                          {msg.type === 'correct' ? '🎉 ' : '📢 '}{msg.message}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-bold opacity-90">
                          {msg.username}
                          {msg.username === username && ' (You)'}:
                        </span>
                        <span className="opacity-90">{msg.message}</span>
                        {msg.type === 'guess' && <span className="text-sm opacity-70">🎯</span>}
                      </div>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="mt-auto">
            <form onSubmit={gameStarted && !isDrawer ? handleSendGuess : handleSendMessage}>
              <input
                ref={guessInputRef}
                type="text"
                className="w-full px-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white mb-1.25 placeholder:text-white/50 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="w-full px-3 py-3 bg-gradient-to-br from-[#667eea] to-[#764ba2] text-white rounded-lg font-bold cursor-pointer transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!guessInput.trim() || (gameStarted && isDrawer)}
              >
                {gameStarted && !isDrawer ? '🎯 Guess' : '📤 Send'}
              </button>
            </form>
            <div className="text-center text-sm opacity-60 mt-1.25">
              {gameStarted && !isDrawer
                ? 'Press Enter to submit guess'
                : 'Press Enter to send message'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-black/30 backdrop-blur-lg border-t-2 border-white/10 flex justify-between items-center">
        <div className="opacity-90">
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
        <div className="flex gap-2.5">
          <span className="bg-white/10 px-3 py-1 rounded-full text-sm">{username}</span>
          {isHost && <span className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-gray-800 px-3 py-1 rounded-full text-sm font-bold">Host</span>}
        </div>
      </div>
    </div>
  )
}