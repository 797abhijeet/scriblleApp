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

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8001'

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
      (error) => {
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
      <div className="home-container">
        <div className="content">
          <div className="searching-container">
            <div className="icon">📍</div>
            <div className="loader"></div>
            <h2 className="searching-text">Finding Nearby Players...</h2>
            <p className="searching-subtext">Searching within 50km radius</p>
            {location && (
              <p className="location-text">
                📍 Your location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
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
            <h1 className="title">Scribble</h1>
            <p className="subtitle">Draw, Guess & Have Fun!</p>
          </div>

          <div className="button-container">
            <button className="primary-button" onClick={() => setMode('nearby')}>
              <span className="button-icon">📍</span>
              Find Nearby Players
            </button>

            <div className="divider">
              <div className="divider-line"></div>
              <span className="divider-text">OR</span>
              <div className="divider-line"></div>
            </div>

            <button className="secondary-button" onClick={() => setMode('create')}>
              <span className="button-icon">➕</span>
              Create Room
            </button>

            <button className="secondary-button" onClick={() => setMode('join')}>
              <span className="button-icon">🚪</span>
              Join with Code
            </button>
          </div>

          <div className="footer">
            <p className="footer-text">Made with ❤️ for Scribble lovers</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="home-container">
      <div className="content">
        <button className="back-button" onClick={() => setMode('menu')}>
          ← Back
        </button>

        <div className="form-header">
          <div className="icon">
            {mode === 'create' ? '➕' : mode === 'nearby' ? '📍' : '🚪'}
          </div>
          <h2 className="form-title">
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Nearby' : 'Join Room'}
          </h2>
        </div>

        <div className="form">
          <div className="input-container">
            <span className="input-icon">👤</span>
            <input
              className="input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              maxLength={20}
            />
          </div>

          {mode === 'join' && (
            <div className="input-container">
              <span className="input-icon">🔑</span>
              <input
                className="input"
                type="text"
                placeholder="Enter room code"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
              />
            </div>
          )}

          {mode === 'nearby' && (
            <div className="info-box">
              <span className="info-icon">ℹ️</span>
              <p className="info-text">
                We'll find players near you (within 50km) who are also looking for a game!
              </p>
            </div>
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
            {mode === 'create' ? 'Create Room' : mode === 'nearby' ? 'Find Match' : 'Join Room'}
          </button>
        </div>
      </div>
    </div>
  )
}
