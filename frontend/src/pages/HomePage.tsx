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

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:8001'
      : 'https://scriblleapp.onrender.com';

  useEffect(() => {
    // Request location permission on mount
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
    navigate(`/game?username=${username}&roomCode=${roomCode.toUpperCase()}&isHost=false`)
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

        // Connect to Socket.IO
        const newSocket = io(backendUrl, {
          path: '/api/socket.io',
          transports: ['polling', 'websocket'],
          reconnection: true,
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="text-6xl mb-6">📍</div>
          
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-ping"></div>
            <div className="absolute inset-4 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"></div>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Finding Nearby Players...</h2>
          <p className="text-gray-600 mb-4">Searching within 50km radius</p>
          
          {location && (
            <p className="text-sm text-gray-500 mb-6">
              📍 Your location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>
          )}

          <button 
            onClick={handleCancelSearch}
            className="w-full py-3 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 font-semibold rounded-xl hover:opacity-90 transition-opacity"
          >
            Cancel Search
          </button>
        </div>
      </div>
    )
  }

  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎨</div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">Scribble</h1>
            <p className="text-gray-600">Draw, Guess & Have Fun!</p>
          </div>

          <div className="space-y-4">
            <button 
              onClick={() => setMode('nearby')}
              className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center space-x-2"
            >
              <span className="text-xl">📍</span>
              <span>Find Nearby Players</span>
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">OR</span>
              </div>
            </div>

            <button 
              onClick={() => setMode('create')}
              className="w-full py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center space-x-2"
            >
              <span className="text-xl">➕</span>
              <span>Create Room</span>
            </button>

            <button 
              onClick={() => setMode('join')}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg flex items-center justify-center space-x-2"
            >
              <span className="text-xl">🚪</span>
              <span>Join with Code</span>
            </button>
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-500">Made with ❤️ for Scribble lovers</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <button 
          onClick={() => setMode('menu')}
          className="mb-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          ←
        </button>

        <div className="text-center mb-8">
          <div className="text-5xl mb-4">
            {mode === 'create' ? '➕' : mode === 'nearby' ? '📍' : '🚪'}
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Nearby' : 'Join Room'}
          </h2>
        </div>

        <div className="space-y-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-xl">👤</span>
            </div>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
              className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {mode === 'join' && (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="text-gray-400 text-xl">🔢</span>
              </div>
              <input
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
              />
            </div>
          )}

          {mode === 'nearby' && (
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div className="flex items-start">
                <span className="text-blue-500 mr-2">ℹ️</span>
                <p className="text-sm text-blue-700">
                  We'll find players near you (within 50km) who are also looking for a game!
                </p>
              </div>
            </div>
          )}

          <button
            onClick={
              mode === 'create'
                ? handleCreateRoom
                : mode === 'nearby'
                  ? handleFindNearby
                  : handleJoinRoom
            }
            className={`w-full py-4 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg ${
              mode === 'create'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600'
                : mode === 'nearby'
                ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                : 'bg-gradient-to-r from-indigo-500 to-blue-600'
            }`}
          >
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Match' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}