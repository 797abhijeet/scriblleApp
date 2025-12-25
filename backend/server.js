const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { getDistance } = require("geolib");
const Room = require("./models/room");

require("dotenv").config();

const app = express();
const server = http.createServer(app);
// Create Socket.IO server with custom path
const io = new Server(server, {
  path: "/api/socket.io", // Use /api prefix for proper routing
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/scribble_game";
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Word bank
const WORD_BANK = [
  "cat",
  "dog",
  "house",
  "tree",
  "car",
  "sun",
  "moon",
  "star",
  "flower",
  "bird",
  "fish",
  "book",
  "phone",
  "computer",
  "guitar",
  "piano",
  "camera",
  "bicycle",
  "umbrella",
  "chair",
  "table",
  "cup",
  "bottle",
  "shoe",
  "hat",
  "clock",
  "butterfly",
  "rainbow",
  "mountain",
  "beach",
  "ocean",
  "river",
  "bridge",
  "castle",
  "rocket",
  "airplane",
  "boat",
  "train",
  "pizza",
  "burger",
  "ice cream",
  "cake",
  "apple",
  "banana",
  "carrot",
  "elephant",
  "giraffe",
  "lion",
  "tiger",
  "penguin",
  "dolphin",
  "whale",
  "octopus",
  "spider",
  "butterfly",
  "snowman",
  "campfire",
  "tent",
  "backpack",
  "glasses",
  "crown",
  "sword",
  "shield",
];

// In-memory storage
const gameRooms = new Map();
const playersSearching = new Map(); // Players searching for nearby match
const playerLocations = new Map(); // Socket ID -> {lat, lng, username, timestamp}

// Configuration
const NEARBY_RADIUS_KM = 50; // Match players within 50km
const LOCATION_UPDATE_INTERVAL = 30000; // Update location every 30 seconds

// Helper: Calculate distance between two coordinates (in meters)
function calculateDistance(lat1, lon1, lat2, lon2) {
  return getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );
}

// Helper: Generate room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Helper: Find nearby players
function findNearbyPlayer(currentPlayerId, lat, lng) {
  const nearbyPlayers = [];

  for (const [playerId, playerData] of playersSearching.entries()) {
    if (playerId === currentPlayerId) continue;

    const distance = calculateDistance(
      lat,
      lng,
      playerData.lat,
      playerData.lng
    );
    const distanceKm = distance / 1000;

    if (distanceKm <= NEARBY_RADIUS_KM) {
      nearbyPlayers.push({
        playerId,
        username: playerData.username,
        distance: distanceKm,
        ...playerData,
      });
    }
  }

  // Sort by distance
  nearbyPlayers.sort((a, b) => a.distance - b.distance);

  return nearbyPlayers[0]; // Return closest player
}

// Helper: Start new round
async function startNewRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const drawer = room.players[room.currentDrawerIndex];
  if (!drawer) return;

  room.currentDrawerSid = drawer.sid;
  room.currentWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.strokes = [];
  room.guessedPlayers = [];
  room.roundStartTime = Date.now();

  await room.save();

  io.to(drawer.sid).emit("new_round", {
    round: room.currentRound,
    drawer: drawer.username,
    drawerSid: drawer.sid,
    word: room.currentWord,
    wordLength: room.currentWord.length,
  });

  room.players.forEach((p) => {
    if (p.sid !== drawer.sid) {
      io.to(p.sid).emit("new_round", {
        round: room.currentRound,
        drawer: drawer.username,
        drawerSid: drawer.sid,
        word: "_".repeat(room.currentWord.length),
        wordLength: room.currentWord.length,
      });
    }
  });
}
socket.on("request_history", async ({ room_code }) => {
  const room = await Room.findOne({ roomCode: room_code });
  if (!room) return;
  socket.emit("draw_history", room.strokes);
});
socket.on("color_change", ({ room_code, color }) => {
  socket.to(room_code).emit("color_changed", color);
});

// Helper: End round
async function endRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  if (room.roundTimer) clearTimeout(room.roundTimer);

  // Reveal word once
  io.to(roomCode).emit("round_end", {
    word: room.currentWord,
    players: room.players,
  });

  // Move drawer
  room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;

  if (room.currentDrawerIndex === 0) {
    room.currentRound += 1;
  }

  if (room.currentRound > room.maxRounds) {
    endGame(roomCode);
    return;
  }

  await room.save();

  // 🔥 START NEXT ROUND IMMEDIATELY (NO DELAY)
  startNewRound(roomCode);
}

// Helper: End game
function endGame(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  io.to(roomCode).emit("game_end", {
    players: sortedPlayers,
  });

  // Reset game state
  room.gameStarted = false;
  room.currentRound = 0;
  room.currentDrawerIndex = 0;
  room.players.forEach((p) => (p.score = 0));
}

// Socket.IO event handlers
io.on("connection", (socket) => {
  console.log(`✅ Client connected: ${socket.id}`);

  socket.emit("connected", { sid: socket.id });

  // Update player location
  socket.on("update_location", (data) => {
    const { lat, lng, username } = data;
    playerLocations.set(socket.id, {
      lat,
      lng,
      username,
      timestamp: Date.now(),
    });
    console.log(`📍 Location updated for ${username}: ${lat}, ${lng}`);
  });

  // Find nearby match
  socket.on("find_nearby_match", (data) => {
    const { lat, lng, username } = data;

    console.log(`🔍 ${username} searching for nearby match at ${lat}, ${lng}`);

    // Check if there's a nearby player already searching
    const nearbyPlayer = findNearbyPlayer(socket.id, lat, lng);

    if (nearbyPlayer) {
      // Match found! Create room with both players
      const roomCode = generateRoomCode();

      // Remove both from search queue
      playersSearching.delete(socket.id);
      playersSearching.delete(nearbyPlayer.playerId);

      // Create room
      gameRooms.set(roomCode, {
        roomCode,
        players: [
          { sid: socket.id, username, score: 0, isHost: true },
          {
            sid: nearbyPlayer.playerId,
            username: nearbyPlayer.username,
            score: 0,
            isHost: false,
          },
        ],
        maxPlayers: 8,
        gameStarted: false,
        currentRound: 0,
        maxRounds: 3,
        currentDrawerIndex: 0,
        currentDrawerSid: null,
        currentWord: null,
        strokes: [],
        guessedPlayers: [],
        roundStartTime: null,
        roundTimer: null,
      });

      // Join both players to room
      socket.join(roomCode);
      io.sockets.sockets.get(nearbyPlayer.playerId)?.join(roomCode);

      // Notify both players
      socket.emit("match_found", {
        roomCode,
        matchedWith: nearbyPlayer.username,
        distance: nearbyPlayer.distance.toFixed(2),
        players: gameRooms.get(roomCode).players,
      });

      io.to(nearbyPlayer.playerId).emit("match_found", {
        roomCode,
        matchedWith: username,
        distance: nearbyPlayer.distance.toFixed(2),
        players: gameRooms.get(roomCode).players,
      });

      console.log(
        `✅ Match created: ${username} <-> ${nearbyPlayer.username} in room ${roomCode}`
      );
    } else {
      // No match found, add to search queue
      playersSearching.set(socket.id, {
        lat,
        lng,
        username,
        timestamp: Date.now(),
      });

      socket.emit("searching", { message: "Searching for nearby players..." });
      console.log(`⏳ ${username} added to search queue`);
    }
  });

  // Cancel nearby search
  socket.on("cancel_search", () => {
    playersSearching.delete(socket.id);
    console.log(`❌ Search cancelled for ${socket.id}`);
  });

  // Create room (code-based)
  socket.on("create_room", async ({ room_code, username }) => {
    const roomCode = room_code.toUpperCase();

    const existing = await Room.findOne({ roomCode });
    if (existing) {
      socket.emit("error", { message: "Room already exists" });
      return;
    }

    const room = await Room.create({
      roomCode,
      players: [
        {
          sid: socket.id,
          username,
          score: 0,
          isHost: true,
        },
      ],
    });

    socket.join(roomCode);
    socket.emit("room_created", {
      room_code: roomCode,
      players: room.players,
    });

    console.log(`🎮 Room created: ${roomCode}`);
  });

  // Join room (code-based)
  socket.on("join_room", async ({ room_code, username }) => {
    const roomCode = room_code.toUpperCase();

    const room = await Room.findOne({ roomCode });
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      socket.emit("error", { message: "Room is full" });
      return;
    }

    room.players.push({
      sid: socket.id,
      username,
      score: 0,
      isHost: false,
    });

    await room.save();

    socket.join(roomCode);

    socket.emit("room_joined", {
      room_code: roomCode,
      players: room.players,
    });

    io.to(roomCode).emit("player_joined", {
      players: room.players,
    });

    console.log(`👤 ${username} joined room ${roomCode}`);
  });

  // Start game
  socket.on("start_game", async ({ room_code }) => {
    const roomCode = room_code.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) return;

    const host = room.players.find((p) => p.sid === socket.id && p.isHost);

    if (!host) {
      socket.emit("error", { message: "Only host can start game" });
      return;
    }

    if (room.players.length < 2) {
      socket.emit("error", { message: "Need at least 2 players" });
      return;
    }

    room.gameStarted = true;
    room.currentRound = 1;
    await room.save();

    io.to(roomCode).emit("game_started");
    startNewRound(roomCode);
  });

  // Draw stroke
  socket.on("draw_stroke", async ({ room_code, points, color, width }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || room.currentDrawerSid !== socket.id) return;

    const stroke = { points, color, width };
    room.strokes.push(stroke);
    room.undoneStrokes = [];
    await room.save();

    socket.to(room_code).emit("stroke_drawn", stroke);
  });
  socket.on("undo", async ({ room_code }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || room.currentDrawerSid !== socket.id) return;

    const s = room.strokes.pop();
    if (s) room.undoneStrokes.push(s);

    await room.save();
    io.to(room_code).emit("draw_history", room.strokes);
  });

  socket.on("redo", async ({ room_code }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || room.currentDrawerSid !== socket.id) return;

    const s = room.undoneStrokes.pop();
    if (s) room.strokes.push(s);

    await room.save();
    io.to(room_code).emit("draw_history", room.strokes);
  });

  // Clear canvas
  socket.on("clear_canvas", (data) => {
    const { room_code } = data;
    const roomCode = room_code.toUpperCase();

    if (!gameRooms.has(roomCode)) return;

    const room = gameRooms.get(roomCode);

    if (room.currentDrawerSid !== socket.id) return;

    room.strokes = [];
    io.to(roomCode).emit("canvas_cleared", {});
  });

  // Send guess
  socket.on("send_guess", async ({ room_code, guess }) => {
    const roomCode = room_code.toUpperCase();
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    // Drawer cannot guess
    if (room.currentDrawerSid === socket.id) return;

    // Already guessed
    if (room.guessedPlayers.includes(socket.id)) return;

    const player = room.players.find((p) => p.sid === socket.id);
    if (!player) return;

    const normalizedGuess = guess.trim().toLowerCase();
    const correctWord = room.currentWord.toLowerCase();

    // ✅ CORRECT GUESS
    if (normalizedGuess === correctWord) {
      room.guessedPlayers.push(socket.id);

      // Score logic
      player.score += 100;

      await room.save();

      // 🔔 SYSTEM MESSAGE (NOT NORMAL CHAT)
      io.to(roomCode).emit("system_message", {
        text: `${player.username} guessed the word correctly! 🎉`,
      });

      // 🔥 END ROUND IMMEDIATELY
      endRound(roomCode);
      return;
    }

    // ❌ WRONG GUESS → normal chat
    io.to(roomCode).emit("chat_message", {
      username: player.username,
      message: guess,
    });
  });

  socket.on("disconnect", async () => {
    console.log(`❌ Client disconnected: ${socket.id}`);

    const room = await Room.findOne({ "players.sid": socket.id });
    if (!room) return;

    const leavingPlayer = room.players.find((p) => p.sid === socket.id);
    const wasHost = leavingPlayer?.isHost;

    // Remove player
    room.players = room.players.filter((p) => p.sid !== socket.id);

    // If room empty → delete
    if (room.players.length === 0) {
      await Room.deleteOne({ roomCode: room.roomCode });
      console.log(`🗑️ Room ${room.roomCode} deleted`);
      return;
    }

    // 🔑 HOST HANDOVER LOGIC
    if (wasHost) {
      // Make first remaining player the new host
      room.players.forEach((p) => (p.isHost = false));
      room.players[0].isHost = true;

      io.to(room.roomCode).emit("host_changed", {
        newHostSid: room.players[0].sid,
        newHostUsername: room.players[0].username,
      });

      console.log(`👑 New host: ${room.players[0].username}`);
    }

    await room.save();

    io.to(room.roomCode).emit("player_left", {
      players: room.players,
    });
  });
});

// REST API Routes
app.get("/api", (req, res) => {
  res.json({ message: "Scribble Game API - Node.js" });
});

app.get("/api/rooms", (req, res) => {
  const rooms = [];
  for (const [code, room] of gameRooms.entries()) {
    rooms.push({
      room_code: code,
      players: room.players.length,
      max_players: room.maxPlayers,
      game_started: room.gameStarted,
    });
  }
  res.json({ rooms });
});

app.get("/api/location/searching", (req, res) => {
  const searching = [];
  for (const [socketId, player] of playersSearching.entries()) {
    searching.push({
      username: player.username,
      timestamp: player.timestamp,
    });
  }
  res.json({ searching, count: searching.length });
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    activeRooms: gameRooms.size,
    playersSearching: playersSearching.size,
  });
});

const PORT = process.env.PORT || 8001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Scribble Game Server running on port ${PORT}`);
  console.log(`📡 Socket.IO ready for connections`);
  console.log(
    `🌍 Location-based matching enabled (${NEARBY_RADIUS_KM}km radius)`
  );
});
