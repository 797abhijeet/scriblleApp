import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'

export default function HomePage() {
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'nearby'>('menu')
  const [searchingNearby, setSearchingNearby] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [socket, setSocket] = useState<Socket | null>(null)
  const navigate = useNavigate()

  const backendUrl = window.location.hostname === "localhost"
    ? "http://localhost:8001"
    : "https://scriblleapp.onrender.com"

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          console.log('Location permission denied:', error)
        }
      )
    }
  }, [])

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }
    const code = generateRoomCode()
    navigate(`/game?username=${username}&roomCode=${code}&isHost=true`)
  }

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }
    if (!roomCode.trim()) {
      alert('Please enter a room code')
      return
    }

    console.log(`Attempting to join room: ${roomCode.toUpperCase()} as ${username}`)
    const newSocket = io(backendUrl, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
    })

    newSocket.on('connect', () => {
      console.log('Connected to server for joining room')
      newSocket.emit('join_room', {
        room_code: roomCode.toUpperCase(),
        username: username
      })
    })

    newSocket.on('room_joined', (data) => {
      console.log('Room joined successfully:', data)
      newSocket.disconnect()
      navigate(`/game?username=${username}&roomCode=${roomCode.toUpperCase()}&isHost=false`)
    })

    newSocket.on('room_players_update', (data) => {
      console.log('Room players updated:', data)
    })

    newSocket.on('error', (data) => {
      console.error('Error joining room:', data)
      alert(data.message)
      newSocket.disconnect()
      setSocket(null)
    })

    setSocket(newSocket)
  }

  const handleFindNearby = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }

    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser')
      return
    }

    setSearchingNearby(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setLocation(userLocation)

        const newSocket = io(backendUrl, {
          withCredentials: true,
          transports: ['websocket', 'polling']
        })

        newSocket.on('connect', () => {
          console.log('Connected to server for nearby search')
          newSocket.emit('find_nearby_match', {
            lat: userLocation.lat,
            lng: userLocation.lng,
            username: username
          })
        })

        newSocket.on('searching', (data) => {
          console.log('Searching for nearby players:', data.message)
        })

        newSocket.on('match_found', (data) => {
          console.log('Match found!', data)
          setSearchingNearby(false)
          const confirmed = window.confirm(
            `Match found with ${data.matchedWith} (${data.distance}km away). Join game?`
          )
          if (confirmed) {
            newSocket.disconnect()
            navigate(`/game?username=${username}&roomCode=${data.roomCode}&isHost=false&matchType=nearby`)
          }
        })

        newSocket.on('error', (data) => {
          setSearchingNearby(false)
          alert(data.message)
          newSocket.disconnect()
        })

        setSocket(newSocket)
      },
      () => {
        setSearchingNearby(false)
        alert('Please enable location access to find nearby players')
      }
    )
  }

  const handleCancelSearch = () => {
    if (socket) {
      socket.emit('cancel_search')
      socket.disconnect()
      setSocket(null)
    }
    setSearchingNearby(false)
    setMode('menu')
  }

  if (searchingNearby) {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[600px] h-[600px] bg-white rounded-full opacity-10 top-[-200px] right-[-200px] animate-float"></div>
        <div className="absolute w-[400px] h-[400px] bg-white rounded-full opacity-10 bottom-[-100px] left-[-100px] animate-float animation-delay-5000"></div>
        
        <div className="max-w-[480px] w-full relative z-10 animate-slideUp">
          <div className="text-center px-5 py-16">
            <div className="text-6xl mb-5">📍</div>
            <div className="w-16 h-16 border-6 border-white/30 border-t-white rounded-full animate-spin mx-auto my-8 shadow-lg"></div>
            <h2 className="text-3xl font-bold text-white mb-3 text-shadow-lg">Finding Nearby Players...</h2>
            <p className="text-lg text-white/90 mb-5 font-medium">Searching within 50km radius</p>
            {location && (
              <p className="text-sm text-white/80 mb-10 font-medium">
                📍 Your location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            )}
            <button 
              className="bg-red-500/95 hover:bg-red-600 text-white px-9 py-4 rounded-2xl text-lg font-semibold cursor-pointer transition-all duration-300 shadow-xl backdrop-blur-sm hover:-translate-y-1"
              onClick={handleCancelSearch}
            >
              Cancel Search
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'menu') {
    return (
      <div className="w-full min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-5 relative overflow-hidden">
        <div className="absolute w-[600px] h-[600px] bg-white rounded-full opacity-10 top-[-200px] right-[-200px] animate-float"></div>
        <div className="absolute w-[400px] h-[400px] bg-white rounded-full opacity-10 bottom-[-100px] left-[-100px] animate-float animation-delay-5000"></div>
        
        <div className="max-w-[480px] w-full relative z-10 animate-slideUp">
          <div className="text-center mb-12 animate-fadeIn animation-delay-200">
            <div className="text-8xl mb-5 inline-block animate-bounce drop-shadow-xl">🎨</div>
            <h1 className="text-6xl font-black bg-gradient-to-br from-white to-blue-50 bg-clip-text text-transparent mb-4 tracking-tight text-shadow-lg">Scribble</h1>
            <p className="text-xl text-white/90 mt-3 font-medium">Draw, Guess & Have Fun!</p>
          </div>

          <div className="flex flex-col gap-4 animate-slideUp animation-delay-400">
            {/* <button 
              className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              onClick={() => setMode('nearby')}
            >
              <span className="text-2xl drop-shadow">📍</span>
              Find Nearby Players
            </button> */}

            {/* <div className="flex items-center my-2 opacity-70">
              <div className="flex-1 h-px bg-white/30"></div>
              <span className="mx-4 text-white/80 text-sm font-semibold tracking-wider">OR</span>
              <div className="flex-1 h-px bg-white/30"></div>
            </div> */}

            <button 
              className="bg-white/95 hover:bg-white text-indigo-500 px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer flex items-center justify-center gap-3 backdrop-blur-sm border-2 border-white/30 shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMode('create')}
            >
              <span className="text-2xl drop-shadow">➕</span>
              Create Room
            </button>

            <button 
              className="bg-white/95 hover:bg-white text-indigo-500 px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer flex items-center justify-center gap-3 backdrop-blur-sm border-2 border-white/30 shadow-lg hover:-translate-y-1 transition-all duration-300"
              onClick={() => setMode('join')}
            >
              <span className="text-2xl drop-shadow">🚪</span>
              Join with Code
            </button>
          </div>

          <div className="text-center mt-12 animate-fadeIn animation-delay-600">
            <p className="text-white/80 text-sm font-medium">Made with ❤️ for Scribble lovers</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-purple-600 to-blue-500 flex items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute w-[600px] h-[600px] bg-white rounded-full opacity-10 top-[-200px] right-[-200px] animate-float"></div>
      <div className="absolute w-[400px] h-[400px] bg-white rounded-full opacity-10 bottom-[-100px] left-[-100px] animate-float animation-delay-5000"></div>
      
      <div className="max-w-[480px] w-full relative z-10 animate-slideUp">
        <button 
          className="absolute top-4 left-4 w-12 h-12 rounded-full bg-white/95 border-none cursor-pointer backdrop-blur-sm shadow-lg text-2xl font-bold text-indigo-500 hover:scale-110 transition-all duration-300"
          onClick={() => setMode('menu')}
        >
          ←
        </button>

        <div className="text-center mb-10 animate-fadeIn animation-delay-200">
          <div className="text-8xl mb-5">
            {mode === 'create' ? '➕' : mode === 'nearby' ? '📍' : '🚪'}
          </div>
          <h2 className="text-5xl font-black bg-gradient-to-br from-white to-blue-50 bg-clip-text text-transparent mb-5 tracking-tight">
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Nearby' : 'Join Room'}
          </h2>
        </div>

        <div className="flex flex-col gap-5 animate-slideUp animation-delay-400">
          <div className="flex items-center bg-white/95 rounded-2xl px-5 py-2 border-2 border-white/30 gap-3 backdrop-blur-sm shadow-lg transition-all duration-300 focus-within:border-indigo-500/50 focus-within:bg-white focus-within:shadow-xl focus-within:-translate-y-1">
            <span className="text-2xl opacity-60">👤</span>
            <input
              className="flex-1 text-lg py-4 border-none outline-none bg-transparent text-gray-800 font-medium placeholder:text-slate-400"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div className="flex items-center bg-white/95 rounded-2xl px-5 py-2 border-2 border-white/30 gap-3 backdrop-blur-sm shadow-lg transition-all duration-300 focus-within:border-indigo-500/50 focus-within:bg-white focus-within:shadow-xl focus-within:-translate-y-1">
              <span className="text-2xl opacity-60">🔑</span>
              <input
                className="flex-1 text-lg py-4 border-none outline-none bg-transparent text-gray-800 font-medium placeholder:text-slate-400 uppercase"
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
          )}

          {mode === 'nearby' && (
            <div className="bg-blue-50/95 p-5 rounded-2xl flex gap-4 items-start backdrop-blur-sm border-2 border-blue-300/30 shadow-lg">
              <span className="text-2xl">ℹ️</span>
              <p className="flex-1 text-blue-900 text-sm leading-relaxed font-medium">
                We'll find players near you (within 50km) who are also looking for a game!
              </p>
            </div>
          )}

          <button
            className="bg-gradient-to-br from-indigo-500 to-purple-500 text-white px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer flex items-center justify-center gap-3 shadow-xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
            onClick={
              mode === 'create'
                ? handleCreateRoom
                : mode === 'nearby'
                  ? handleFindNearby
                  : handleJoinRoom
            }
          >
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Match' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}