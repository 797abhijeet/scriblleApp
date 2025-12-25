import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/HomePage.css'

export default function HomePage() {
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [searchingNearby, setSearchingNearby] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const navigate = useNavigate()

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:10000'
      : 'https://scriblleapp.onrender.com'

  /* ======================
     SOCKET INIT (ONCE)
  ======================= */
  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ['websocket'],
      upgrade: false,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('✅ Connected:', socket.id)
    })

    socket.on('searching', () => {
      console.log('🔍 Searching nearby...')
    })

    socket.on('match_found', (data) => {
      setSearchingNearby(false)

      const confirmed = window.confirm(
        `Matched with ${data.matchedWith}. Join game?`
      )

      if (confirmed) {
        navigate(`/game?username=${username}&roomCode=${data.roomCode}`)
      }
    })

    socket.on('error', (err) => {
      alert(err.message)
      setSearchingNearby(false)
    })

    return () => {
      socket.disconnect()
    }
  }, [backendUrl, navigate, username])

  /* ======================
     LOCATION
  ======================= */
  useEffect(() => {
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => alert('Location permission denied')
    )
  }, [])

  /* ======================
     NEARBY MATCH
  ======================= */
  const handleFindNearby = () => {
    if (!username.trim()) return alert('Enter username')
    if (!location) return alert('Location not available')

    setSearchingNearby(true)

    socketRef.current?.emit('find_nearby_match', {
      lat: location.lat,
      lng: location.lng,
      username,
    })
  }

  const cancelSearch = () => {
    socketRef.current?.emit('cancel_search')
    setSearchingNearby(false)
  }

  /* ======================
     NORMAL ROOMS
  ======================= */
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  }

  const createRoom = () => {
    if (!username.trim()) return alert('Enter username')
    const code = generateRoomCode()
    navigate(`/game?username=${username}&roomCode=${code}`)
  }

  const joinRoom = () => {
    if (!username.trim() || !roomCode.trim())
      return alert('Fill all fields')
    navigate(`/game?username=${username}&roomCode=${roomCode}`)
  }

  /* ======================
     UI
  ======================= */
  if (searchingNearby) {
    return (
      <div className="home-container">
        <h2>📍 Finding Nearby Players...</h2>
        <button onClick={cancelSearch}>Cancel</button>
      </div>
    )
  }

  return (
    <div className="home-container">
      <h1>Scribble Game</h1>

      <input
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <button onClick={createRoom}>Create Room</button>

      <input
        placeholder="Room Code"
        value={roomCode}
        onChange={(e) => setRoomCode(e.target.value)}
      />

      <button onClick={joinRoom}>Join Room</button>

      <hr />

      <button onClick={handleFindNearby}>Find Nearby Player</button>
    </div>
  )
}
