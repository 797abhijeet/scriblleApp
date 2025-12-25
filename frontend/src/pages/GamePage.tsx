import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import Canvas from '../components/Canvas'

interface Player {
  sid: string
  username: string
  score: number
  isHost: boolean
  streak?: number
  correctGuesses?: number
  totalScore?: number
}

interface Message {
  username: string
  message: string
  type?: 'system' | 'guess' | 'correct' | 'info'
}

interface CorrectGuessData {
  player: string
  points: number
  word: string
  timeLeft: number
  guessOrder: number
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
  const [maxRounds, setMaxRounds] = useState(3)
  const [currentWord, setCurrentWord] = useState('')
  const [wordLength, setWordLength] = useState(0)
  const [difficulty, setDifficulty] = useState(3)
  const [isDrawer, setIsDrawer] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [guessInput, setGuessInput] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [roundDuration, setRoundDuration] = useState(60)
  const [correctGuessData, setCorrectGuessData] = useState<CorrectGuessData | null>(null)
  const [showCorrectGuess, setShowCorrectGuess] = useState(false)
  
  const canvasRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<any>(null)
  const guessInputRef = useRef<HTMLInputElement>(null)

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

    newSocket.on("room_created", (data) => {
      setPlayers(data.players);
      navigate(`/game?username=${username}&roomCode=${data.roomCode}&isHost=true`);
    });

    newSocket.on("room_joined", (data) => {
      setPlayers(data.players);
    });

    newSocket.on("system_message", (data) => {
      setMessages(prev => [...prev, {
        username: "System",
        message: data.text,
        type: "system"
      }]);
    });

    newSocket.on('player_joined', (data) => {
      setPlayers(data.players)
      addSystemMessage('A player joined the room')
    })

    newSocket.on('player_left', (data) => {
      setPlayers(data.players)
      addSystemMessage(`👋 ${data.leftPlayer} left the room${data.isHost ? ' (was room owner)' : ''}`)
      
      if (data.newHost) {
        addSystemMessage(`👑 ${data.newHost} is now the room owner`)
      }
    })

    newSocket.on('game_started', (data) => {
      setGameStarted(true)
      setMaxRounds(data.maxRounds)
      addSystemMessage(`Game started! ${data.maxRounds} rounds total`)
    })

    newSocket.on('new_round', (data) => {
      console.log('New round:', data)
      setCurrentRound(data.round)
      setCurrentWord(data.word)
      setWordLength(data.wordLength)
      setDifficulty(data.difficulty)
      setIsDrawer(data.drawerSid === newSocket.id)
      setTimeLeft(data.roundDuration)
      setRoundDuration(data.roundDuration)
      setCorrectGuessData(null)
      setShowCorrectGuess(false)

      if (canvasRef.current) {
        canvasRef.current.clear()
      }

      if (data.drawerSid === newSocket.id) {
        addSystemMessage(`🎨 Your turn to draw: ${data.word} (Difficulty: ${'★'.repeat(data.difficulty)})`)
      } else {
        addSystemMessage(`${data.drawer} is drawing... Word has ${data.wordLength} letters`)
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

    newSocket.on('correct_guess', (data) => {
      setCorrectGuessData(data)
      setShowCorrectGuess(true)
      
      addSystemMessage(`🎉 ${data.player} guessed correctly! +${data.points} points (${data.timeLeft}s left, #${data.guessOrder})`, 'correct')
      
      // Auto-hide after 3 seconds
      setTimeout(() => {
        setShowCorrectGuess(false)
      }, 3000)
    })

    newSocket.on('drawer_bonus', (data) => {
      addSystemMessage(`🎨 You earned ${data.bonus} bonus points because ${data.player} guessed correctly!`, 'info')
    })

    newSocket.on('drawing_liked', (data) => {
      addSystemMessage(`❤️ Your drawing received a like! Total: ${data.likes}`, 'info')
    })

    newSocket.on('stroke_drawn', (data) => {
      if (canvasRef.current) {
        canvasRef.current.drawStroke(data)
      }
    })

    newSocket.on('canvas_cleared', () => {
      if (canvasRef.current) {
        canvasRef.current.clear()
      }
    })

    newSocket.on('guess_feedback', (data) => {
      if (!data.correct) {
        addSystemMessage(`💡 Hint: ${data.hint}`, 'info')
      }
    })

    newSocket.on('already_guessed', (data) => {
      addSystemMessage(data.message, 'info')
    })

    newSocket.on('chat_message', (data) => {
      addMessage(data.username, data.message)
    })

    newSocket.on('round_end', (data) => {
      setPlayers(data.players)
      addSystemMessage(`🏁 Round ${currentRound} ended! The word was: ${data.word}`, 'system')
      addSystemMessage(`✅ ${data.correctCount} player(s) guessed correctly`, 'system')
      
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    })

    newSocket.on('game_end', (data) => {
      setPlayers(data.players)
      setGameStarted(false)
      const winner = data.players[0]
      addSystemMessage(`🏆 Game Over! Winner: ${winner.username} with ${winner.score} points!`, 'system')
      
      // Show final scores
      data.players.forEach((player: Player, index: number) => {
        addSystemMessage(`#${index + 1}: ${player.username} - ${player.score} points (Streak: ${player.streak || 0}, Correct: ${player.correctGuesses || 0})`, 'info')
      })
      
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

  useEffect(() => {
    if (guessInputRef.current && !isDrawer && gameStarted) {
      guessInputRef.current.focus()
    }
  }, [isDrawer, gameStarted])

  const addSystemMessage = (message: string, type: 'system' | 'correct' | 'info' = 'system') => {
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

  const handleLikeDrawing = () => {
    if (socket && !isDrawer && gameStarted) {
      socket.emit('like_drawing', { room_code: roomCode })
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      {/* Correct Guess Popup */}
      {showCorrectGuess && correctGuessData && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 animate-bounce">
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white p-4 rounded-xl shadow-2xl">
            <div className="text-center">
              <div className="text-2xl font-bold mb-2">🎉 Correct Guess!</div>
              <div className="text-lg">{correctGuessData.player} +{correctGuessData.points} points</div>
              <div className="text-sm opacity-90">#{correctGuessData.guessOrder} • {correctGuessData.timeLeft}s remaining</div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6 p-4 bg-white rounded-xl shadow-lg">
          <div className="flex items-center space-x-4">
            <button 
              onClick={handleLeaveRoom}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              ←
            </button>
            <div>
              <div className="text-xl font-bold text-gray-800">
                Room: <span className="text-blue-600">{roomCode}</span>
              </div>
              {gameStarted && (
                <div className="text-sm text-gray-600">
                  Round {currentRound}/{maxRounds} • {timeLeft}s • Difficulty: {'★'.repeat(difficulty)}
                </div>
              )}
            </div>
          </div>
          
          {!gameStarted && isHost && players.length >= 2 && (
            <button 
              onClick={handleStartGame}
              className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg"
            >
              Start Game
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Players List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-lg p-4">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                <span className="mr-2">👥</span> Players ({players.length}/8)
              </h2>
              <div className="space-y-3">
                {players.map((player) => (
                  <div key={player.sid} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        isDrawer && player.sid === socket?.id 
                          ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' 
                          : player.sid === socket?.id
                          ? 'bg-gradient-to-r from-blue-400 to-purple-500 text-white'
                          : 'bg-gradient-to-r from-gray-400 to-gray-600 text-white'
                      }`}>
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800 flex items-center">
                          {player.username}
                          {player.isHost && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">👑 Host</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          Streak: {player.streak || 0} • Correct: {player.correctGuesses || 0}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-gray-800 text-lg">
                        {player.score}
                      </div>
                      {player.streak && player.streak > 2 && (
                        <div className="text-xs text-green-600">🔥 {player.streak} streak</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl shadow-lg p-4 h-full">
                {gameStarted ? (
                  <>
                    <div className="mb-4">
                      {isDrawer && (
                        <div className="text-center p-4 bg-gradient-to-r from-green-100 to-emerald-200 rounded-lg mb-4">
                          <div className="text-lg font-bold text-emerald-800">
                            Draw: <span className="text-2xl">{currentWord}</span>
                          </div>
                          <div className="text-sm text-emerald-600 mt-1 flex justify-center items-center">
                            <span className="mr-2">Difficulty: {'★'.repeat(difficulty)}</span>
                            <span>•</span>
                            <span className="ml-2">You earn 30% of each correct guess!</span>
                          </div>
                        </div>
                      )}
                      {!isDrawer && currentWord && (
                        <div className="text-center p-4 bg-gradient-to-r from-blue-100 to-indigo-200 rounded-lg mb-4">
                          <div className="text-lg font-bold text-indigo-800">
                            Word: <span className="text-2xl tracking-widest">{'_ '.repeat(wordLength)}</span>
                          </div>
                          <div className="text-sm text-indigo-600 mt-1">
                            {wordLength} letters • Faster guesses = more points!
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="relative h-[500px] bg-gray-50 rounded-xl overflow-hidden border-2 border-gray-200">
                      <Canvas
                        ref={canvasRef}
                        canDraw={isDrawer}
                        onStrokeSent={handleStrokeSent}
                      />
                      
                      {!isDrawer && (
                        <button 
                          onClick={handleLikeDrawing}
                          className="absolute bottom-4 right-4 p-3 bg-gradient-to-r from-pink-500 to-rose-600 text-white rounded-full shadow-lg hover:opacity-90 transition-opacity"
                          title="Like this drawing"
                        >
                          ❤️
                        </button>
                      )}
                    </div>
                    
                    {isDrawer && (
                      <div className="mt-4 flex justify-center space-x-4">
                        <button 
                          onClick={handleClearCanvas}
                          className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg flex items-center"
                        >
                          🗑️ Clear Canvas
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-[500px] flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 rounded-xl">
                    <div className="text-6xl mb-4">👥</div>
                    <h3 className="text-2xl font-bold text-gray-700 mb-2">Waiting for players...</h3>
                    <p className="text-gray-600 mb-1">{players.length} / 8 players joined</p>
                    {isHost && (
                      <p className="text-gray-500 text-sm">Need at least 2 players to start</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Chat Sidebar */}
            {gameStarted && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-xl shadow-lg h-full flex flex-col">
                  {/* Chat Header */}
                  <div className="p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <span className="text-xl mr-2">💬</span>
                        <span className="font-bold text-gray-800">Chat</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Score faster = more points!
                      </div>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          msg.type === 'system' 
                            ? 'bg-blue-50 text-blue-800 border-l-4 border-blue-500' 
                            : msg.type === 'correct'
                            ? 'bg-gradient-to-r from-green-50 to-emerald-100 text-emerald-800 border-l-4 border-emerald-500'
                            : msg.type === 'info'
                            ? 'bg-gray-50 text-gray-700 border-l-4 border-gray-400'
                            : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        {msg.type === 'system' || msg.type === 'correct' || msg.type === 'info' ? (
                          <span>{msg.message}</span>
                        ) : (
                          <span>
                            <strong className="text-purple-600">{msg.username}:</strong> {msg.message}
                          </span>
                        )}
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Guess Input */}
                  {!isDrawer && (
                    <div className="p-4 border-t">
                      <form onSubmit={handleSendGuess} className="flex space-x-2">
                        <input
                          ref={guessInputRef}
                          type="text"
                          placeholder="Type your guess..."
                          value={guessInput}
                          onChange={(e) => setGuessInput(e.target.value)}
                          className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                          type="submit"
                          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity"
                        >
                          ➤
                        </button>
                      </form>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        First guess bonus: 50% • Second: 25% • Streak bonus: +10 per guess
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}