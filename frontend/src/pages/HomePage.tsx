import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { io, Socket } from 'socket.io-client'
import '../styles/HomePage.css'

export default function HomePage() {
  const [username, setUsername] = useState('')
  const [roomCode, setRoomCode] = useState('')
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'nearby'>('menu')
  const [searchingNearby, setSearchingNearby] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)

  const socketRef = useRef<Socket | null>(null)
  const navigate = useNavigate()

  const backendUrl =
    window.location.hostname === 'localhost'
      ? 'http://localhost:8001'
      : 'https://scriblleapp.onrender.com'

  /* ======================
     INIT SOCKET (ONCE)
  ======================= */
  useEffect(() => {
    const socket = io(backendUrl, {
      transports: ['websocket'],
      upgrade: false,
    })

    socketRef.current = socket

    socket.on('connect', () => {
      console.log('✅ Nearby socket connected:', socket.id)
    })

    socket.on('connect_error', (err) => {
      console.error('❌ Socket connect error:', err.message)
    })

    socket.on('searching', () => {
      console.log('🔍 Searching nearby players...')
    })

    socket.on('match_found', (data) => {
      setSearchingNearby(false)

      const confirmed = window.confirm(
        `Match found with ${data.matchedWith} (${data.distance} km away). Join game?`
      )

      if (confirmed) {
        navigate(`/game?username=${username}&roomCode=${data.roomCode}&isHost=false`)
      }
    })

    socket.on('error', (err) => {
      alert(err.message)
      setSearchingNearby(false)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [backendUrl, navigate, username])

  /* ======================
     LOCATION
  ======================= */
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          setLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => console.log('Location permission denied')
      )
    }
  }, [])

  /* ======================
     NEARBY MATCH
  ======================= */
  const handleFindNearby = () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }

    if (!location) {
      alert('Location not available')
      return
    }

    setSearchingNearby(true)

    socketRef.current?.emit('find_nearby_match', {
      lat: location.lat,
      lng: location.lng,
      username,
    })
  }

  const handleCancelSearch = () => {
    socketRef.current?.emit('cancel_search')
    setSearchingNearby(false)
    setMode('menu')
  }

  /* ======================
     NORMAL ROOM FLOW
  ======================= */
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    return Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')
  }

  const handleCreateRoom = () => {
    if (!username.trim()) return alert('Enter username')
    const code = generateRoomCode()
    navigate(`/game?username=${username}&roomCode=${code}&isHost=true`)
  }

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) return alert('Fill all fields')
    navigate(`/game?username=${username}&roomCode=${roomCode}&isHost=false`)
  }

  /* ======================
     UI
  ======================= */
  if (searchingNearby) {
    return (
      <div className="home-container">
        <div className="content">
          <div className="searching-container">
            <div className="icon">📍</div>
            <div className="loader"></div>
            <h2>Finding Nearby Players...</h2>
            <button className="cancel-button" onClick={handleCancelSearch}>
              Cancel Search
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---- rest of UI unchanged ---- */
  return (
    <div className="home-container">
      {/* SAME UI YOU ALREADY HAVE */}
    </div>
  )
}
