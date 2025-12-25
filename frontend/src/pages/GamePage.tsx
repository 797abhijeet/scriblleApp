import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import Canvas, { CanvasRef } from '../components/Canvas';
import './GamePage.css';

interface Player {
  sid: string;
  username: string;
  score: number;
  isHost: boolean;
  avatar?: string | null;
}

interface Message {
  username: string;
  message: string;
  type: 'system' | 'guess' | 'chat' | 'correct';
  timestamp?: number;
}

interface GameState {
  round: number;
  drawer: string;
  drawerSid: string;
  word: string;
  wordLength: number;
  roundTime: number;
}

const GamePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const username = searchParams.get('username') || 'Player';
  const roomCode = searchParams.get('roomCode') || '';
  const isHost = searchParams.get('isHost') === 'true';
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(80);
  const [isDrawer, setIsDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [brushColor, setBrushColor] = useState('#000000');
  const [brushWidth, setBrushWidth] = useState(3);
  
  const canvasRef = useRef<CanvasRef>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const guessInputRef = useRef<HTMLInputElement>(null);

  const backendUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:8001'
    : 'https://your-backend.onrender.com';

  // Initialize socket connection
  useEffect(() => {
    if (!roomCode || !username) {
      navigate('/');
      return;
    }

    const newSocket = io(backendUrl, {
      path: '/api/socket.io',
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000
    });

    newSocket.on('connect', () => {
      console.log('✅ Connected to server');
      setLoading(false);
      
      if (isHost) {
        newSocket.emit('create_room', { room_code: roomCode, username });
      } else {
        newSocket.emit('join_room', { room_code: roomCode, username });
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setError('Failed to connect to server');
      setLoading(false);
    });

    newSocket.on('room_created', (data) => {
      setPlayers(data.players);
      addSystemMessage(`🎮 Room ${roomCode} created! Share code: ${roomCode}`);
    });

    newSocket.on('room_joined', (data) => {
      setPlayers(data.players);
      addSystemMessage(`✅ Joined room ${roomCode}!`);
    });

    newSocket.on('player_joined', (data) => {
      setPlayers(data.players);
      addSystemMessage(`👋 ${data.player.username} joined the room`);
    });

    newSocket.on('player_left', (data) => {
      setPlayers(data.players);
      addSystemMessage(`👋 ${data.player} left the room`);
    });

    newSocket.on('new_host', (data) => {
      addSystemMessage(`👑 ${data.host} is now the host`);
    });

    newSocket.on('game_started', (data) => {
      setGameStarted(true);
      addSystemMessage('🎯 Game started! Get ready!');
    });

    newSocket.on('new_round', (data) => {
      console.log('🔄 New round data:', data);
      setGameState(data);
      setIsDrawer(data.drawerSid === newSocket.id);
      setTimeLeft(data.roundTime || 80);
      
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
      
      if (data.drawerSid === newSocket.id) {
        addSystemMessage(`🎨 Your turn to draw: ${data.word}`);
      } else {
        addSystemMessage(`🎨 ${data.drawer} is drawing...`);
      }
      
      // Start timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    newSocket.on('stroke_drawn', (data) => {
      if (canvasRef.current && !isDrawer) {
        canvasRef.current.drawStroke(data);
      }
    });

    newSocket.on('canvas_cleared', () => {
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
    });

    newSocket.on('chat_message', (data) => {
      addMessage(data.username, data.message, data.type || 'chat');
    });

    newSocket.on('correct_guess', (data) => {
      addSystemMessage(`✅ ${data.player} guessed correctly! +${data.points} points`, 'correct');
    });

    newSocket.on('guess_result', (data) => {
      if (data.correct) {
        addSystemMessage(`🎉 You got it! The word was: ${data.word}`, 'correct');
      }
    });

    newSocket.on('guess_hint', (data) => {
      addSystemMessage(`💡 Hint: ${data.hint}`);
    });

    newSocket.on('round_end', (data) => {
      setPlayers(data.players);
      addSystemMessage(`📊 Round ended! The word was: ${data.word} (${data.guessedPlayers} guessed)`);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    newSocket.on('game_end', (data) => {
      setGameStarted(false);
      const winner = data.winner;
      addSystemMessage(`🏆 Game Over! Winner: ${winner.username} with ${winner.score} points!`);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    });

    newSocket.on('game_state_update', (data) => {
      if (data.gameStarted) {
        setGameStarted(true);
        setGameState({
          round: data.currentRound,
          drawer: data.drawer,
          drawerSid: data.drawerSid,
          word: data.word,
          wordLength: data.wordLength,
          roundTime: data.timeLeft
        });
        setIsDrawer(data.drawerSid === newSocket.id);
        setTimeLeft(data.timeLeft);
      }
    });

    newSocket.on('error', (data) => {
      setError(data.message);
      setTimeout(() => setError(null), 3000);
    });

    setSocket(newSocket);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      newSocket.disconnect();
    };
  }, [roomCode, username, isHost, navigate, backendUrl]);

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus on guess input when not drawer
  useEffect(() => {
    if (!isDrawer && guessInputRef.current) {
      guessInputRef.current.focus();
    }
  }, [isDrawer]);

  const addSystemMessage = (message: string, type: 'system' | 'correct' = 'system') => {
    const newMessage: Message = {
      username: 'System',
      message,
      type,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const addMessage = (username: string, message: string, type: 'guess' | 'chat' = 'chat') => {
    const newMessage: Message = {
      username,
      message,
      type,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, newMessage]);
  };

  const handleStartGame = () => {
    if (socket && isHost && players.length >= 2) {
      socket.emit('start_game', { room_code: roomCode });
    }
  };

  const handleSendGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guessInput.trim() || !socket || isDrawer) return;

    socket.emit('send_guess', {
      room_code: roomCode,
      guess: guessInput.trim()
    });

    setGuessInput('');
  };

  const handleSendChat = (message: string) => {
    if (!message.trim() || !socket) return;
    
    socket.emit('chat_message', {
      room_code: roomCode,
      message
    });
  };

  const handleStrokeSent = (stroke: any) => {
    if (socket && isDrawer) {
      socket.emit('draw_stroke', {
        room_code: roomCode,
        ...stroke
      });
    }
  };

  const handleClearCanvas = () => {
    if (socket && isDrawer) {
      socket.emit('clear_canvas', { room_code: roomCode });
      if (canvasRef.current) {
        canvasRef.current.clear();
      }
    }
  };

  const handleLeaveRoom = () => {
    const confirmed = window.confirm('Leave the room?');
    if (confirmed) {
      navigate('/');
    }
  };

  const handleCopyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    addSystemMessage('Room code copied to clipboard!');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loader"></div>
        <p>Connecting to game server...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-icon">❌</div>
        <h3>Connection Error</h3>
        <p>{error}</p>
        <button onClick={() => navigate('/')} className="back-button">
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="game-container">
      {/* Header */}
      <header className="game-header">
        <div className="header-left">
          <button onClick={handleLeaveRoom} className="icon-button back-button">
            ← Exit
          </button>
          <div className="room-info">
            <div className="room-code-display" onClick={handleCopyRoomCode} title="Click to copy">
              🎮 Room: <strong>{roomCode}</strong>
            </div>
            {gameStarted && gameState && (
              <div className="round-info">
                Round {gameState.round} • {formatTime(timeLeft)} • {players.length} players
              </div>
            )}
          </div>
        </div>
        
        <div className="header-right">
          {!gameStarted && isHost && players.length >= 2 && (
            <button onClick={handleStartGame} className="start-game-button">
              🎯 Start Game
            </button>
          )}
          {gameStarted && isDrawer && (
            <button onClick={handleClearCanvas} className="clear-button">
              🗑️ Clear Canvas
            </button>
          )}
        </div>
      </header>

      <div className="game-layout">
        {/* Left Sidebar - Players */}
        <aside className="players-sidebar">
          <h3 className="sidebar-title">👥 Players ({players.length})</h3>
          <div className="players-list">
            {players.map((player, index) => (
              <div 
                key={player.sid} 
                className={`player-card ${player.isHost ? 'host' : ''} ${isDrawer && player.sid === socket?.id ? 'drawer' : ''}`}
              >
                <div className="player-avatar">
                  {player.username.charAt(0).toUpperCase()}
                  {player.isHost && <span className="host-badge">👑</span>}
                  {isDrawer && player.sid === socket?.id && <span className="drawer-badge">🎨</span>}
                </div>
                <div className="player-info">
                  <div className="player-name">
                    {player.username}
                    {player.sid === socket?.id && <span className="you-badge"> (You)</span>}
                  </div>
                  <div className="player-score">🎯 {player.score} pts</div>
                </div>
                <div className="player-rank">#{index + 1}</div>
              </div>
            ))}
          </div>
          
          {!gameStarted && (
            <div className="waiting-info">
              <div className="waiting-icon">⏳</div>
              <p>Waiting for host to start...</p>
              {isHost && players.length < 2 && (
                <p className="warning">Need at least 2 players to start</p>
              )}
            </div>
          )}
        </aside>

        {/* Main Game Area */}
        <main className="game-main">
          <div className="canvas-wrapper">
            {gameStarted ? (
              <>
                {isDrawer && gameState && (
                  <div className="word-display drawer">
                    <div className="word-label">🎨 Your word to draw:</div>
                    <div className="word-text">{gameState.word}</div>
                    <div className="word-hint">{gameState.word.length} letters</div>
                  </div>
                )}
                
                {!isDrawer && gameState && (
                  <div className="word-display guesser">
                    <div className="word-label">🔍 Guess the word:</div>
                    <div className="word-blanks">
                      {gameState.word.split('').map((char, index) => (
                        <span key={index} className="blank-char">
                          {char === '_' ? ' _ ' : char}
                        </span>
                      ))}
                    </div>
                    <div className="word-hint">{gameState.wordLength} letters</div>
                  </div>
                )}
                
                <Canvas
                  ref={canvasRef}
                  canDraw={isDrawer}
                  onStrokeSent={handleStrokeSent}
                  brushColor={brushColor}
                  brushWidth={brushWidth}
                />
                
                {isDrawer && (
                  <div className="drawing-tools">
                    <div className="color-picker">
                      {['#000000', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'].map(color => (
                        <button
                          key={color}
                          className={`color-dot ${brushColor === color ? 'selected' : ''}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setBrushColor(color)}
                          title={color}
                        />
                      ))}
                    </div>
                    <div className="brush-sizes">
                      {[1, 3, 5, 8].map(size => (
                        <button
                          key={size}
                          className={`brush-size ${brushWidth === size ? 'selected' : ''}`}
                          onClick={() => setBrushWidth(size)}
                        >
                          ●
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="lobby-screen">
                <div className="lobby-content">
                  <div className="lobby-icon">🎨</div>
                  <h2>Welcome to Room {roomCode}</h2>
                  <p>Share this code with friends to join:</p>
                  <div className="share-code" onClick={handleCopyRoomCode}>
                    <code>{roomCode}</code>
                    <span className="copy-hint">Click to copy</span>
                  </div>
                  <div className="player-count">
                    👥 {players.length} player{players.length !== 1 ? 's' : ''} in room
                  </div>
                  {isHost && (
                    <button 
                      onClick={handleStartGame} 
                      className="start-button"
                      disabled={players.length < 2}
                    >
                      {players.length < 2 ? 'Need 2+ players' : 'Start Game'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar - Chat */}
        <aside className="chat-sidebar">
          <div className="chat-header">
            <span className="chat-icon">💬</span>
            <span className="chat-title">Game Chat</span>
          </div>
          
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="empty-chat">
                <div className="chat-icon">💬</div>
                <p>No messages yet</p>
                <p>Start chatting when the game begins!</p>
              </div>
            ) : (
              <>
                <div className="messages-list">
                  {messages.map((msg, index) => (
                    <div 
                      key={index} 
                      className={`message ${msg.type} ${msg.username === username ? 'own' : ''}`}
                    >
                      {msg.type === 'system' || msg.type === 'correct' ? (
                        <div className="system-message">
                          <span className="message-content">{msg.message}</span>
                        </div>
                      ) : (
                        <div className="user-message">
                          <span className="message-sender">{msg.username}:</span>
                          <span className="message-content">{msg.message}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </>
            )}
          </div>
          
          {gameStarted && !isDrawer && (
            <form onSubmit={handleSendGuess} className="guess-form">
              <input
                ref={guessInputRef}
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="Type your guess..."
                className="guess-input"
                autoComplete="off"
                maxLength={50}
              />
              <button type="submit" className="send-button">
                ➤
              </button>
            </form>
          )}
          
          {gameStarted && isDrawer && (
            <div className="drawer-chat-notice">
              🎨 You're drawing! Chat will be available next round.
            </div>
          )}
          
          {!gameStarted && (
            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const input = e.currentTarget.querySelector('input');
                if (input?.value) {
                  handleSendChat(input.value);
                  input.value = '';
                }
              }} 
              className="chat-form"
            >
              <input
                type="text"
                placeholder="Chat with players..."
                className="chat-input"
                maxLength={200}
              />
              <button type="submit" className="chat-send-button">
                Send
              </button>
            </form>
          )}
        </aside>
      </div>
      
      {error && (
        <div className="error-toast">
          ⚠️ {error}
        </div>
      )}
    </div>
  );
};

export default GamePage;