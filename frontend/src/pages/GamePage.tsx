import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import Canvas from '../components/Canvas'

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
        type: "correct"
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
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
                  Round {currentRound} • {timeLeft}s
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
                          : 'bg-gradient-to-r from-blue-400 to-purple-500 text-white'
                      }`}>
                        {player.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-800">
                          {player.username}
                          {player.isHost && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">👑 Host</span>}
                        </div>
                        <div className="text-sm text-gray-500">
                          {player.sid === socket?.id ? 'You' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="font-bold text-gray-800">
                      {player.score}
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
                          <div className="text-sm text-emerald-600 mt-1">
                            👆 Click and drag to draw
                          </div>
                        </div>
                      )}
                      {!isDrawer && currentWord && (
                        <div className="text-center p-4 bg-gradient-to-r from-blue-100 to-indigo-200 rounded-lg mb-4">
                          <div className="text-lg font-bold text-indigo-800">
                            Word: <span className="text-2xl tracking-widest">{currentWord.replace(/./g, '_ ')}</span>
                          </div>
                          <div className="text-sm text-indigo-600 mt-1">
                            Type your guess in the chat!
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
                    </div>
                    
                    {isDrawer && (
                      <div className="mt-4 flex justify-center">
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
                    <div className="flex items-center">
                      <span className="text-xl mr-2">💬</span>
                      <span className="font-bold text-gray-800">Chat</span>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]">
                    {messages.map((msg, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg ${
                          msg.type === 'system' 
                            ? 'bg-blue-50 text-blue-800' 
                            : msg.type === 'correct'
                            ? 'bg-gradient-to-r from-green-50 to-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-gray-50 text-gray-800'
                        }`}
                      >
                        {msg.type === 'system' || msg.type === 'correct' ? (
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