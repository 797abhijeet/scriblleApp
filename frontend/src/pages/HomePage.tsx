import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/HomePage.css'

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
      : 'https://scriblleapp.onrender.com'

  /* -------------------- LOCATION -------------------- */
  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        })
      },
      () => {
        console.log('Location permission denied')
      }
    )
  }, [])

  /* -------------------- HELPERS -------------------- */
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)]
    }
    return code
  }

  /* -------------------- ACTIONS -------------------- */
  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }
    const code = generateRoomCode()
    navigate(`/game?username=${username}&roomCode=${code}&isHost=true`)
  }

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) {
      alert('Username and room code required')
      return
    }
    navigate(
      `/game?username=${username}&roomCode=${roomCode.toUpperCase()}&isHost=false`
    )
  }

  const handleFindNearby = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }

    if (!navigator.geolocation) {
      alert('Geolocation not supported')
      return
    }

    setSearchingNearby(true)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }

        setLocation(userLocation)

        const newSocket = io(backendUrl, {
          path: '/api/socket.io',
          transports: ['websocket'], // 🔥 IMPORTANT
          reconnection: true,
        })

        newSocket.on('connect', () => {
          newSocket.emit('find_nearby_match', {
            lat: userLocation.lat,
            lng: userLocation.lng,
            username,
          })
        })

        newSocket.on('searching', () => {
          console.log('Searching nearby players...')
        })

        newSocket.on('match_found', (data) => {
          setSearchingNearby(false)

          const confirmJoin = window.confirm(
            `Match found with ${data.matchedWith} (${data.distance} km away). Join game?`
          )

          if (confirmJoin) {
            newSocket.disconnect()
            navigate(
              `/game?username=${username}&roomCode=${data.roomCode}&isHost=false&matchType=nearby`
            )
          } else {
            newSocket.emit('cancel_search')
          }
        })

        newSocket.on('error', (err) => {
          alert(err.message)
          setSearchingNearby(false)
          newSocket.disconnect()
        })

        setSocket(newSocket)
      },
      () => {
        alert('Please allow location access')
        setSearchingNearby(false)
      }
    )
  }

  const handleCancelSearch = () => {
    socket?.emit('cancel_search')
    socket?.disconnect()
    setSocket(null)
    setSearchingNearby(false)
    setMode('menu')
  }

  /* -------------------- UI -------------------- */
  if (searchingNearby) {
    return (
      <div className="home-container">
        <div className="content">
          <div className="searching-container">
            <div className="icon">📍</div>
            <div className="loader"></div>
            <h2>Finding Nearby Players...</h2>
            <p>Searching within 50km radius</p>

            {location && (
              <p className="location-text">
                📍 {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </p>
            )}

            <button className="cancel-button" onClick={handleCancelSearch}>
              Cancel Search
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'menu') {
    return (
      <div className="home-container">
        <div className="content">
          <div className="header">
            <div className="icon">🎨</div>
            <h1>Scribble</h1>
            <p>Draw, Guess & Have Fun!</p>
          </div>

          <div className="button-container">
            <button className="primary-button" onClick={() => setMode('nearby')}>
              📍 Find Nearby Players
            </button>

            <div className="divider">OR</div>

            <button className="secondary-button" onClick={() => setMode('create')}>
              ➕ Create Room
            </button>

            <button className="secondary-button" onClick={() => setMode('join')}>
              🚪 Join with Code
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="content">
        <button className="back-button" onClick={() => setMode('menu')}>
          ←
        </button>

        <h2>
          {mode === 'create'
            ? 'Create Room'
            : mode === 'nearby'
            ? 'Find Nearby Players'
            : 'Join Room'}
        </h2>

        <div className="form">
          <input
            type="text"
            placeholder="Enter username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={20}
          />

          {mode === 'join' && (
            <input
              type="text"
              placeholder="Room Code"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
            />
          )}

          {mode === 'nearby' && (
            <p className="info-text">
              We’ll match you with players within 50km
            </p>
          )}

          <button
            className="primary-button"
            onClick={
              mode === 'create'
                ? handleCreateRoom
                : mode === 'nearby'
                ? handleFindNearby
                : handleJoinRoom
            }
          >
            {mode === 'create'
              ? 'Create Room'
              : mode === 'nearby'
              ? 'Find Match'
              : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
