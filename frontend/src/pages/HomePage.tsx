import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import './HomePage.css';

const HomePage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join' | 'nearby'>('menu');
  const [searching, setSearching] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [searchStatus, setSearchStatus] = useState('');
  const [locationError, setLocationError] = useState('');
  const navigate = useNavigate();

  const backendUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8001'
    : 'https://your-backend.onrender.com';

  useEffect(() => {
    // Check for saved username
    const savedUsername = localStorage.getItem('scribble_username');
    if (savedUsername) {
      setUsername(savedUsername);
    }

    // Get location permission
    if (navigator.geolocation && mode === 'nearby') {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setLocationError('');
        },
        (error) => {
          console.error('Location error:', error);
          setLocationError('Please enable location services for nearby matches');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [mode]);

  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (username.length < 2 || username.length > 20) {
      alert('Username must be 2-20 characters');
      return;
    }
    
    localStorage.setItem('scribble_username', username.trim());
    const code = generateRoomCode();
    navigate(`/game?username=${encodeURIComponent(username.trim())}&roomCode=${code}&isHost=true`);
  };

  const handleJoinRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (username.length < 2 || username.length > 20) {
      alert('Username must be 2-20 characters');
      return;
    }
    
    if (!roomCode.trim() || roomCode.length !== 6) {
      alert('Please enter a valid 6-character room code');
      return;
    }
    
    localStorage.setItem('scribble_username', username.trim());
    navigate(`/game?username=${encodeURIComponent(username.trim())}&roomCode=${roomCode.toUpperCase()}&isHost=false`);
  };

  const handleFindNearby = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    if (username.length < 2 || username.length > 20) {
      alert('Username must be 2-20 characters');
      return;
    }
    
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setSearching(true);
    setSearchStatus('Getting your location...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        
        setLocation(userLocation);
        setSearchStatus('Connecting to server...');
        
        localStorage.setItem('scribble_username', username.trim());
        
        const newSocket = io(backendUrl, {
          path: '/api/socket.io',
          transports: ['polling', 'websocket'],
          reconnection: false,
          timeout: 30000
        });

        newSocket.on('connect', () => {
          setSearchStatus('Searching for nearby players...');
          console.log('📍 Sending location:', userLocation);
          
          newSocket.emit('find_nearby_match', {
            lat: userLocation.lat,
            lng: userLocation.lng,
            username: username.trim()
          });
        });

        newSocket.on('searching', (data) => {
          setSearchStatus(data.message || 'Searching for nearby players...');
        });

        newSocket.on('match_found', (data) => {
          setSearching(false);
          newSocket.disconnect();
          
          const confirmed = window.confirm(
            `🎮 Match found with ${data.matchedWith} (${data.distance}km away)!\n\nJoin game in room ${data.roomCode}?`
          );
          
          if (confirmed) {
            navigate(`/game?username=${encodeURIComponent(username.trim())}&roomCode=${data.roomCode}&isHost=false`);
          } else {
            setMode('menu');
          }
        });

        newSocket.on('error', (data) => {
          setSearching(false);
          alert(data.message || 'An error occurred');
          newSocket.disconnect();
          setMode('menu');
        });

        newSocket.on('connect_error', (error) => {
          setSearching(false);
          alert('Failed to connect to server. Please try again.');
          newSocket.disconnect();
          setMode('menu');
        });

        setSocket(newSocket);
      },
      (error) => {
        setSearching(false);
        let errorMessage = 'Failed to get location';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out.';
            break;
        }
        alert(errorMessage);
        setMode('menu');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleCancelSearch = () => {
    if (socket) {
      socket.emit('cancel_search');
      socket.disconnect();
      setSocket(null);
    }
    setSearching(false);
    setMode('menu');
    setSearchStatus('');
  };

  if (searching) {
    return (
      <div className="home-container">
        <div className="content">
          <div className="searching-container">
            <div className="searching-icon">📍</div>
            <div className="spinner"></div>
            <h2 className="searching-title">Finding Nearby Players</h2>
            <p className="searching-status">{searchStatus}</p>
            <p className="searching-subtitle">Searching within 50km radius</p>
            
            {location && (
              <div className="location-info">
                <span className="location-icon">📍</span>
                <span className="location-coords">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              </div>
            )}
            
            <button onClick={handleCancelSearch} className="cancel-button">
              Cancel Search
            </button>
            
            <div className="searching-tip">
              💡 Make sure you're in a populated area for better matches
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'menu') {
    return (
      <div className="home-container">
        <div className="content">
          <div className="header">
            <div className="logo">🎨</div>
            <h1 className="title">Scribble Game</h1>
            <p className="subtitle">Draw, Guess & Have Fun with Friends!</p>
          </div>

          <div className="username-section">
            <div className="input-group">
              <label htmlFor="username" className="input-label">
                👤 Your Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                placeholder="Enter your display name"
                className="username-input"
                maxLength={20}
              />
              <div className="input-hint">2-20 characters</div>
            </div>
          </div>

          <div className="button-grid">
            <button 
              className="mode-button nearby-button"
              onClick={() => {
                if (!username.trim()) {
                  alert('Please enter a username first');
                  return;
                }
                setMode('nearby');
              }}
            >
              <div className="button-icon">📍</div>
              <div className="button-content">
                <div className="button-title">Find Nearby</div>
                <div className="button-subtitle">Play with people near you</div>
              </div>
            </button>

            <button 
              className="mode-button create-button"
              onClick={() => {
                if (!username.trim()) {
                  alert('Please enter a username first');
                  return;
                }
                setMode('create');
              }}
            >
              <div className="button-icon">➕</div>
              <div className="button-content">
                <div className="button-title">Create Room</div>
                <div className="button-subtitle">Start a private game</div>
              </div>
            </button>

            <button 
              className="mode-button join-button"
              onClick={() => {
                if (!username.trim()) {
                  alert('Please enter a username first');
                  return;
                }
                setMode('join');
              }}
            >
              <div className="button-icon">🚪</div>
              <div className="button-content">
                <div className="button-title">Join Room</div>
                <div className="button-subtitle">Enter a room code</div>
              </div>
            </button>
          </div>

          <div className="features">
            <div className="feature">
              <span className="feature-icon">🎨</span>
              <span className="feature-text">Real-time Drawing</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🌍</span>
              <span className="feature-text">Location-Based Match</span>
            </div>
            <div className="feature">
              <span className="feature-icon">👥</span>
              <span className="feature-text">Up to 8 Players</span>
            </div>
            <div className="feature">
              <span className="feature-icon">🏆</span>
              <span className="feature-text">Score System</span>
            </div>
          </div>

          <div className="footer">
            <p className="footer-text">Made with ❤️ by Scribble Team</p>
            <p className="footer-subtext">No account required • Free to play</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="content">
        <button className="back-button" onClick={() => setMode('menu')}>
          ← Back to Menu
        </button>

        <div className="form-container">
          <div className="form-header">
            <div className="form-icon">
              {mode === 'create' ? '➕' : mode === 'nearby' ? '📍' : '🚪'}
            </div>
            <h2 className="form-title">
              {mode === 'create' ? 'Create Private Room' : 
               mode === 'nearby' ? 'Find Nearby Players' : 'Join Existing Room'}
            </h2>
          </div>

          <div className="form-content">
            <div className="form-field">
              <label className="field-label">Username</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.slice(0, 20))}
                  placeholder="Your display name"
                  className="form-input"
                  maxLength={20}
                />
              </div>
            </div>

            {mode === 'join' && (
              <div className="form-field">
                <label className="field-label">Room Code</label>
                <div className="input-with-icon">
                  <span className="input-icon">🔑</span>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value.toUpperCase().slice(0, 6))}
                    placeholder="Enter 6-digit code"
                    className="form-input"
                    maxLength={6}
                  />
                </div>
                <div className="input-hint">Uppercase letters & numbers only</div>
              </div>
            )}

            {mode === 'nearby' && (
              <div className="info-box">
                <div className="info-icon">ℹ️</div>
                <div className="info-content">
                  <h4>How Nearby Matching Works</h4>
                  <ul className="info-list">
                    <li>• We'll find players within 50km of your location</li>
                    <li>• Both players need to be searching at the same time</li>
                    <li>• Game starts automatically when match is found</li>
                    <li>• Your location is only used for matching</li>
                  </ul>
                </div>
              </div>
            )}

            {mode === 'create' && (
              <div className="info-box">
                <div className="info-icon">💡</div>
                <div className="info-content">
                  <h4>Room Creation Tips</h4>
                  <ul className="info-list">
                    <li>• Room code will be generated automatically</li>
                    <li>• Share the code with friends to invite them</li>
                    <li>• You'll be the host and can start the game</li>
                    <li>• Rooms auto-delete when empty</li>
                  </ul>
                </div>
              </div>
            )}

            <button
              className="submit-button"
              onClick={
                mode === 'create'
                  ? handleCreateRoom
                  : mode === 'nearby'
                  ? handleFindNearby
                  : handleJoinRoom
              }
              disabled={!username.trim() || (mode === 'join' && !roomCode.trim())}
            >
              {mode === 'create' ? '🎮 Create Room' : 
               mode === 'nearby' ? '🔍 Find Match' : '🚪 Join Room'}
            </button>

            {mode === 'nearby' && locationError && (
              <div className="error-message">
                ⚠️ {locationError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;