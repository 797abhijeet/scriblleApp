const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const { getDistance } = require('geolib');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// CORS middleware
app.use(cors({
  origin: ['http://localhost:3000', 'https://your-frontend-domain.com'], // Update with your frontend URL
  credentials: true
}));

app.use(express.json());

// MongoDB connection
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/scribble_game';
mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://your-frontend-domain.com'],
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Word bank - improved with more words
const WORD_BANK = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'flower', 'bird',
  'fish', 'book', 'phone', 'computer', 'guitar', 'piano', 'camera', 'bicycle',
  'umbrella', 'chair', 'table', 'cup', 'bottle', 'shoe', 'hat', 'clock',
  'butterfly', 'rainbow', 'mountain', 'beach', 'ocean', 'river', 'bridge',
  'castle', 'rocket', 'airplane', 'boat', 'train', 'pizza', 'burger', 'ice cream',
  'cake', 'apple', 'banana', 'carrot', 'elephant', 'giraffe', 'lion', 'tiger',
  'penguin', 'dolphin', 'whale', 'octopus', 'spider', 'snowman', 'campfire',
  'tent', 'backpack', 'glasses', 'crown', 'sword', 'shield', 'key', 'lock',
  'heart', 'diamond', 'cloud', 'lightning', 'fire', 'water', 'earth', 'wind',
  'robot', 'alien', 'ghost', 'wizard', 'dragon', 'unicorn', 'mermaid', 'ninja',
  'pirate', 'knight', 'queen', 'king', 'princess', 'superhero', 'vampire', 'zombie',
  'fairy', 'elf', 'dwarf', 'giant', 'monster', 'angel', 'devil', 'santa',
  'reindeer', 'snowflake', 'candle', 'lamp', 'mirror', 'window', 'door', 'bed',
  'pillow', 'blanket', 'sofa', 'refrigerator', 'microwave', 'oven', 'stove',
  'sink', 'toilet', 'shower', 'bathtub', 'toothbrush', 'comb', 'brush', 'scissors'
];

// In-memory storage
const gameRooms = new Map();
const playersSearching = new Map();
const playerLocations = new Map();
const activePlayers = new Map(); // Track all active players

// Configuration
const NEARBY_RADIUS_KM = 50;
const LOCATION_UPDATE_INTERVAL = 30000;
const MAX_ROUNDS = 5;
const ROUND_TIME = 80; // seconds
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;

// Helper functions
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function findNearbyPlayer(currentPlayerId, lat, lng) {
  const nearbyPlayers = [];
  
  for (const [playerId, playerData] of playersSearching.entries()) {
    if (playerId === currentPlayerId || !playerData.lat || !playerData.lng) continue;
    
    try {
      const distance = getDistance(
        { latitude: lat, longitude: lng },
        { latitude: playerData.lat, longitude: playerData.lng }
      );
      const distanceKm = distance / 1000;
      
      if (distanceKm <= NEARBY_RADIUS_KM) {
        nearbyPlayers.push({
          playerId,
          username: playerData.username,
          distance: distanceKm,
          ...playerData
        });
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
    }
  }
  
  nearbyPlayers.sort((a, b) => a.distance - b.distance);
  return nearbyPlayers[0];
}

function validateRoom(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return false;
  
  // Clean up disconnected players
  room.players = room.players.filter(player => {
    const socketExists = io.sockets.sockets.get(player.sid);
    return socketExists;
  });
  
  if (room.players.length === 0) {
    cleanupRoom(roomCode);
    return false;
  }
  
  return true;
}

function cleanupRoom(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;
  
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
  }
  
  gameRooms.delete(roomCode);
  console.log(`🧹 Cleaned up room ${roomCode}`);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function startNewRound(roomCode) {
  if (!validateRoom(roomCode)) return;
  
  const room = gameRooms.get(roomCode);
  
  // Check if we need to reshuffle players
  if (room.currentRound === 1) {
    room.players = shuffleArray([...room.players]);
  }
  
  if (room.currentDrawerIndex >= room.players.length) {
    room.currentDrawerIndex = 0;
  }
  
  const drawer = room.players[room.currentDrawerIndex];
  if (!drawer) return;
  
  room.currentDrawerSid = drawer.sid;
  room.currentWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.strokes = [];
  room.guessedPlayers = [];
  room.roundStartTime = Date.now();
  
  // Notify drawer with the word
  io.to(drawer.sid).emit('new_round', {
    round: room.currentRound,
    drawer: drawer.username,
    drawerSid: drawer.sid,
    word: room.currentWord,
    wordLength: room.currentWord.length,
    roundTime: ROUND_TIME
  });
  
  // Notify other players with masked word
  room.players.forEach(player => {
    if (player.sid !== drawer.sid) {
      io.to(player.sid).emit('new_round', {
        round: room.currentRound,
        drawer: drawer.username,
        drawerSid: drawer.sid,
        word: '_'.repeat(room.currentWord.length),
        wordLength: room.currentWord.length,
        roundTime: ROUND_TIME
      });
    }
  });
  
  // Start round timer
  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => endRound(roomCode), ROUND_TIME * 1000);
  
  // Send round started event
  io.to(roomCode).emit('round_started', {
    round: room.currentRound,
    drawer: drawer.username
  });
}

async function endRound(roomCode) {
  if (!validateRoom(roomCode)) return;
  
  const room = gameRooms.get(roomCode);
  
  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }
  
  // Calculate scores
  room.guessedPlayers.forEach(playerSid => {
    const player = room.players.find(p => p.sid === playerSid);
    if (player) {
      const timeElapsed = (Date.now() - room.roundStartTime) / 1000;
      const points = Math.max(100, 500 - Math.floor(timeElapsed * 5));
      player.score += points;
    }
  });
  
  // Award drawer if at least one player guessed
  if (room.guessedPlayers.length > 0) {
    const drawer = room.players.find(p => p.sid === room.currentDrawerSid);
    if (drawer) {
      drawer.score += room.guessedPlayers.length * 25;
    }
  }
  
  // Send round end event
  io.to(roomCode).emit('round_end', {
    word: room.currentWord,
    players: room.players,
    guessedPlayers: room.guessedPlayers.length
  });
  
  // Move to next round
  room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;
  
  if (room.currentDrawerIndex === 0) {
    room.currentRound++;
  }
  
  // Check if game should continue
  if (room.currentRound > room.maxRounds) {
    setTimeout(() => endGame(roomCode), 3000);
  } else {
    setTimeout(() => startNewRound(roomCode), 5000);
  }
}

function endGame(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;
  
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  
  io.to(roomCode).emit('game_end', {
    players: sortedPlayers,
    winner: sortedPlayers[0]
  });
  
  // Reset room for new game
  room.gameStarted = false;
  room.currentRound = 0;
  room.currentDrawerIndex = 0;
  room.strokes = [];
  room.guessedPlayers = [];
  
  // Reset scores if you want fresh game
  // room.players.forEach(p => p.score = 0);
}

// Socket.IO event handlers
io.on('connection', (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);
  activePlayers.set(socket.id, { connectedAt: Date.now() });
  
  socket.emit('connected', { sid: socket.id });
  
  // Update location
  socket.on('update_location', (data) => {
    try {
      const { lat, lng, username } = data;
      if (lat && lng && username) {
        playerLocations.set(socket.id, {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          username,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('Error updating location:', error);
    }
  });
  
  // Find nearby match
  socket.on('find_nearby_match', (data) => {
    try {
      const { lat, lng, username } = data;
      
      if (!lat || !lng || !username) {
        socket.emit('error', { message: 'Invalid location data' });
        return;
      }
      
      console.log(`🔍 ${username} searching for nearby match at ${lat}, ${lng}`);
      
      const nearbyPlayer = findNearbyPlayer(socket.id, parseFloat(lat), parseFloat(lng));
      
      if (nearbyPlayer) {
        const roomCode = generateRoomCode();
        
        playersSearching.delete(socket.id);
        playersSearching.delete(nearbyPlayer.playerId);
        
        const roomData = {
          roomCode,
          players: [
            { sid: socket.id, username, score: 0, isHost: true, avatar: null },
            { sid: nearbyPlayer.playerId, username: nearbyPlayer.username, score: 0, isHost: false, avatar: null }
          ],
          maxPlayers: MAX_PLAYERS,
          gameStarted: false,
          currentRound: 0,
          maxRounds: MAX_ROUNDS,
          currentDrawerIndex: 0,
          currentDrawerSid: null,
          currentWord: null,
          strokes: [],
          guessedPlayers: [],
          roundStartTime: null,
          roundTimer: null
        };
        
        gameRooms.set(roomCode, roomData);
        
        socket.join(roomCode);
        const nearbySocket = io.sockets.sockets.get(nearbyPlayer.playerId);
        if (nearbySocket) nearbySocket.join(roomCode);
        
        const matchData = {
          roomCode,
          matchedWith: nearbyPlayer.username,
          distance: nearbyPlayer.distance.toFixed(2),
          players: roomData.players
        };
        
        socket.emit('match_found', matchData);
        io.to(nearbyPlayer.playerId).emit('match_found', matchData);
        
        console.log(`✅ Match created: ${username} <-> ${nearbyPlayer.username} in room ${roomCode}`);
      } else {
        playersSearching.set(socket.id, {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          username,
          timestamp: Date.now()
        });
        
        socket.emit('searching', { 
          message: 'Searching for nearby players...',
          count: playersSearching.size 
        });
        
        console.log(`⏳ ${username} added to search queue`);
      }
    } catch (error) {
      console.error('Error finding nearby match:', error);
      socket.emit('error', { message: 'Error finding match' });
    }
  });
  
  // Cancel search
  socket.on('cancel_search', () => {
    playersSearching.delete(socket.id);
    socket.emit('search_cancelled', { message: 'Search cancelled' });
    console.log(`❌ Search cancelled for ${socket.id}`);
  });
  
  // Create room
  socket.on('create_room', (data) => {
    try {
      const { room_code, username } = data;
      if (!room_code || !username) {
        socket.emit('error', { message: 'Room code and username required' });
        return;
      }
      
      const roomCode = room_code.toUpperCase().trim();
      
      if (gameRooms.has(roomCode)) {
        socket.emit('error', { message: 'Room already exists' });
        return;
      }
      
      const roomData = {
        roomCode,
        players: [{ sid: socket.id, username, score: 0, isHost: true, avatar: null }],
        maxPlayers: MAX_PLAYERS,
        gameStarted: false,
        currentRound: 0,
        maxRounds: MAX_ROUNDS,
        currentDrawerIndex: 0,
        currentDrawerSid: null,
        currentWord: null,
        strokes: [],
        guessedPlayers: [],
        roundStartTime: null,
        roundTimer: null
      };
      
      gameRooms.set(roomCode, roomData);
      socket.join(roomCode);
      
      socket.emit('room_created', {
        room_code: roomCode,
        players: roomData.players
      });
      
      console.log(`🎮 Room created: ${roomCode} by ${username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Error creating room' });
    }
  });
  
  // Join room
  socket.on('join_room', (data) => {
    try {
      const { room_code, username } = data;
      if (!room_code || !username) {
        socket.emit('error', { message: 'Room code and username required' });
        return;
      }
      
      const roomCode = room_code.toUpperCase().trim();
      
      if (!gameRooms.has(roomCode)) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      const room = gameRooms.get(roomCode);
      
      if (room.players.length >= room.maxPlayers) {
        socket.emit('error', { message: 'Room is full' });
        return;
      }
      
      // Check if username already exists in room
      if (room.players.some(p => p.username === username)) {
        socket.emit('error', { message: 'Username already taken in this room' });
        return;
      }
      
      const playerData = { sid: socket.id, username, score: 0, isHost: false, avatar: null };
      room.players.push(playerData);
      socket.join(roomCode);
      
      socket.emit('room_joined', {
        room_code: roomCode,
        players: room.players,
        isHost: false
      });
      
      socket.to(roomCode).emit('player_joined', {
        player: playerData,
        players: room.players
      });
      
      console.log(`👤 ${username} joined room ${roomCode}`);
      
      // Send game state if game in progress
      if (room.gameStarted) {
        const drawer = room.players.find(p => p.sid === room.currentDrawerSid);
        if (drawer) {
          const wordDisplay = socket.id === room.currentDrawerSid 
            ? room.currentWord 
            : '_'.repeat(room.currentWord ? room.currentWord.length : 0);
          
          socket.emit('game_state_update', {
            gameStarted: true,
            currentRound: room.currentRound,
            drawer: drawer.username,
            drawerSid: room.currentDrawerSid,
            word: wordDisplay,
            wordLength: room.currentWord ? room.currentWord.length : 0,
            timeLeft: ROUND_TIME - Math.floor((Date.now() - room.roundStartTime) / 1000)
          });
          
          // Send existing strokes
          room.strokes.forEach(stroke => {
            socket.emit('stroke_drawn', stroke);
          });
        }
      }
    } catch (error) {
      console.error('Error joining room:', error);
      socket.emit('error', { message: 'Error joining room' });
    }
  });
  
  // Start game
  socket.on('start_game', (data) => {
    try {
      const { room_code } = data;
      const roomCode = room_code.toUpperCase();
      
      if (!gameRooms.has(roomCode)) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      
      const room = gameRooms.get(roomCode);
      const player = room.players.find(p => p.sid === socket.id);
      
      if (!player || !player.isHost) {
        socket.emit('error', { message: 'Only host can start game' });
        return;
      }
      
      if (room.players.length < MIN_PLAYERS) {
        socket.emit('error', { message: `Need at least ${MIN_PLAYERS} players to start` });
        return;
      }
      
      room.gameStarted = true;
      room.currentRound = 1;
      room.currentDrawerIndex = Math.floor(Math.random() * room.players.length);
      
      io.to(roomCode).emit('game_started', {
        message: 'Game started!',
        players: room.players
      });
      
      setTimeout(() => startNewRound(roomCode), 2000);
      
      console.log(`🎯 Game started in room ${roomCode}`);
    } catch (error) {
      console.error('Error starting game:', error);
      socket.emit('error', { message: 'Error starting game' });
    }
  });
  
  // Draw stroke
  socket.on('draw_stroke', (data) => {
    try {
      const { room_code, points, color, width } = data;
      const roomCode = room_code.toUpperCase();
      
      if (!gameRooms.has(roomCode)) return;
      
      const room = gameRooms.get(roomCode);
      if (room.currentDrawerSid !== socket.id) return;
      
      const strokeData = { 
        points, 
        color: color || '#000000', 
        width: width || 3 
      };
      room.strokes.push(strokeData);
      
      socket.to(roomCode).emit('stroke_drawn', strokeData);
    } catch (error) {
      console.error('Error drawing stroke:', error);
    }
  });
  
  // Clear canvas
  socket.on('clear_canvas', (data) => {
    const { room_code } = data;
    const roomCode = room_code.toUpperCase();
    
    if (!gameRooms.has(roomCode)) return;
    
    const room = gameRooms.get(roomCode);
    if (room.currentDrawerSid !== socket.id) return;
    
    room.strokes = [];
    io.to(roomCode).emit('canvas_cleared', {});
  });
  
  // Send guess
  socket.on('send_guess', (data) => {
    try {
      const { room_code, guess } = data;
      const roomCode = room_code.toUpperCase();
      
      if (!gameRooms.has(roomCode)) return;
      
      const room = gameRooms.get(roomCode);
      
      if (room.currentDrawerSid === socket.id) return;
      if (room.guessedPlayers.includes(socket.id)) return;
      
      const player = room.players.find(p => p.sid === socket.id);
      if (!player) return;
      
      const guessLower = guess.toLowerCase().trim();
      const wordLower = room.currentWord.toLowerCase();
      
      // Send chat message to all
      io.to(roomCode).emit('chat_message', {
        username: player.username,
        message: guess,
        type: 'guess'
      });
      
      if (guessLower === wordLower) {
        room.guessedPlayers.push(socket.id);
        
        const timeElapsed = (Date.now() - room.roundStartTime) / 1000;
        const points = Math.max(100, 500 - Math.floor(timeElapsed * 5));
        player.score += points;
        
        io.to(roomCode).emit('correct_guess', {
          player: player.username,
          points,
          totalGuessed: room.guessedPlayers.length
        });
        
        socket.emit('guess_result', { 
          correct: true, 
          points,
          word: room.currentWord
        });
        
        if (room.guessedPlayers.length === room.players.length - 1) {
          endRound(roomCode);
        }
      } else {
        // Send partial matches hint
        if (guessLower.length === wordLower.length) {
          let hint = '';
          for (let i = 0; i < wordLower.length; i++) {
            if (guessLower[i] === wordLower[i]) {
              hint += guessLower[i];
            } else {
              hint += '_';
            }
          }
          
          if (hint.includes(guessLower[i])) {
            socket.emit('guess_hint', { hint });
          }
        }
        
        socket.emit('guess_result', { 
          correct: false,
          message: 'Try again!' 
        });
      }
    } catch (error) {
      console.error('Error processing guess:', error);
    }
  });
  
  // Send chat message
  socket.on('chat_message', (data) => {
    const { room_code, message } = data;
    const roomCode = room_code.toUpperCase();
    
    if (!gameRooms.has(roomCode)) return;
    
    const room = gameRooms.get(roomCode);
    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;
    
    io.to(roomCode).emit('chat_message', {
      username: player.username,
      message,
      type: 'chat'
    });
  });
  
  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
    
    playersSearching.delete(socket.id);
    playerLocations.delete(socket.id);
    activePlayers.delete(socket.id);
    
    // Handle room cleanup
    for (const [roomCode, room] of gameRooms.entries()) {
      const playerIndex = room.players.findIndex(p => p.sid === socket.id);
      
      if (playerIndex !== -1) {
        const player = room.players[playerIndex];
        room.players.splice(playerIndex, 1);
        
        if (room.players.length === 0) {
          cleanupRoom(roomCode);
        } else {
          // Notify remaining players
          socket.to(roomCode).emit('player_left', {
            player: player.username,
            players: room.players
          });
          
          // Assign new host if needed
          if (player.isHost && room.players.length > 0) {
            room.players[0].isHost = true;
            io.to(roomCode).emit('new_host', {
              host: room.players[0].username
            });
          }
          
          // Handle drawer disconnection during game
          if (room.gameStarted && room.currentDrawerSid === socket.id) {
            startNewRound(roomCode);
          }
        }
        break;
      }
    }
  });
});

// REST API Routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Scribble Game API',
    version: '1.0.0',
    endpoints: ['/api/rooms', '/api/health', '/api/stats']
  });
});

app.get('/api/rooms', (req, res) => {
  const rooms = [];
  for (const [code, room] of gameRooms.entries()) {
    rooms.push({
      room_code: code,
      players: room.players.length,
      max_players: room.maxPlayers,
      game_started: room.gameStarted,
      current_round: room.currentRound
    });
  }
  res.json({ rooms, total: rooms.length });
});

app.get('/api/stats', (req, res) => {
  res.json({
    activeRooms: gameRooms.size,
    playersSearching: playersSearching.size,
    activePlayers: activePlayers.size,
    totalWords: WORD_BANK.length
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    activeRooms: gameRooms.size,
    playersSearching: playersSearching.size,
    uptime: process.uptime()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 8001;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 Scribble Game Server running on port ${PORT}
📡 Socket.IO ready for connections
🌍 Location-based matching enabled (${NEARBY_RADIUS_KM}km radius)
📊 Max players per room: ${MAX_PLAYERS}
⏱️ Round time: ${ROUND_TIME} seconds
🎮 Game rounds: ${MAX_ROUNDS}
  `);
});

// Periodic cleanup
setInterval(() => {
  const now = Date.now();
  
  // Clean up old search entries
  for (const [socketId, player] of playersSearching.entries()) {
    if (now - player.timestamp > 300000) { // 5 minutes
      playersSearching.delete(socketId);
    }
  }
  
  // Clean up empty rooms
  for (const [roomCode, room] of gameRooms.entries()) {
    if (room.players.length === 0) {
      cleanupRoom(roomCode);
    }
  }
}, 60000); // Run every minute