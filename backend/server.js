require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { getDistance } = require("geolib");

const app = express();
const server = http.createServer(app);

// IMPORTANT: Keep-alive for Render
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// Socket.IO (NO custom path, WebSocket only)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

// Middleware
app.use(cors());
app.use(express.json());

/* =======================
   MongoDB Connection
======================= */
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://127.0.0.1:27017/scribble_game";

mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

/* =======================
   Game Constants
======================= */
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
  "cake",
  "apple",
  "banana",
  "elephant",
  "giraffe",
  "lion",
  "tiger",
  "penguin",
];

const NEARBY_RADIUS_KM = 50;

/* =======================
   In-memory Stores
======================= */
const gameRooms = new Map();
const playersSearching = new Map();

/* =======================
   Helpers
======================= */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateDistance(lat1, lng1, lat2, lng2) {
  return (
    getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    ) / 1000
  );
}

function findNearbyPlayer(myId, lat, lng) {
  let closest = null;

  for (const [sid, data] of playersSearching.entries()) {
    if (sid === myId) continue;

    const dist = calculateDistance(lat, lng, data.lat, data.lng);
    if (dist <= NEARBY_RADIUS_KM) {
      closest = { sid, ...data, distance: dist };
      break;
    }
  }
  return closest;
}

/* =======================
   Game Logic
======================= */
function startNewRound(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room || room.players.length === 0) return;

  const drawer = room.players[room.currentDrawerIndex];
  room.currentDrawerSid = drawer.sid;
  room.currentWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.strokes = [];
  room.guessedPlayers = [];
  room.roundStartTime = Date.now();

  // Send word to drawer
  io.to(drawer.sid).emit("new_round", {
    drawer: drawer.username,
    word: room.currentWord,
    wordLength: room.currentWord.length,
  });

  // Send masked word to others
  room.players.forEach((p) => {
    if (p.sid !== drawer.sid) {
      io.to(p.sid).emit("new_round", {
        drawer: drawer.username,
        word: "_".repeat(room.currentWord.length),
        wordLength: room.currentWord.length,
      });
    }
  });

  room.roundTimer = setTimeout(() => endRound(roomCode), 60000);
}

function endRound(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  clearTimeout(room.roundTimer);

  room.guessedPlayers.forEach((sid) => {
    const p = room.players.find((x) => x.sid === sid);
    if (p) p.score += 100;
  });

  io.to(roomCode).emit("round_end", {
    word: room.currentWord,
    players: room.players,
  });

  room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;

  setTimeout(() => startNewRound(roomCode), 5000);
}

/* =======================
   Socket.IO
======================= */
io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  socket.on("find_nearby_match", ({ lat, lng, username }) => {
    const match = findNearbyPlayer(socket.id, lat, lng);

    if (match) {
      const roomCode = generateRoomCode();

      playersSearching.delete(socket.id);
      playersSearching.delete(match.sid);

      gameRooms.set(roomCode, {
        players: [
          { sid: socket.id, username, score: 0 },
          { sid: match.sid, username: match.username, score: 0 },
        ],
        currentDrawerIndex: 0,
      });

      socket.join(roomCode);
      io.sockets.sockets.get(match.sid)?.join(roomCode);

      io.to(roomCode).emit("match_found", { roomCode });
    } else {
      playersSearching.set(socket.id, { lat, lng, username });
      socket.emit("searching");
    }
  });

  socket.on("draw_stroke", ({ room_code, stroke }) => {
    socket.to(room_code).emit("stroke_drawn", stroke);
  });

  socket.on("send_guess", ({ room_code, guess }) => {
    const room = gameRooms.get(room_code);
    if (!room) return;

    if (guess.toLowerCase() === room.currentWord.toLowerCase()) {
      io.to(room_code).emit("correct_guess", { by: socket.id });
      endRound(room_code);
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
    playersSearching.delete(socket.id);
  });
});

/* =======================
   REST APIs
======================= */
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    rooms: gameRooms.size,
    searching: playersSearching.size,
  });
});
io.on("connection", (socket) => {
  console.log("🔥 WS CONNECTED:", socket.id);

  socket.on("disconnect", (reason) => {
    console.log("❌ WS DISCONNECTED:", reason);
  });
});

io.engine.on("connection_error", (err) => {
  console.log("🚨 WS ERROR:", {
    code: err.code,
    message: err.message,
  });
});

/* =======================
   Server Start
======================= */
const PORT = process.env.PORT || 10000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on ${PORT}`);
});
