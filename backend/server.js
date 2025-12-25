require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { getDistance } = require("geolib");

const app = express();
const server = http.createServer(app);

// Render keep-alive
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket"],
});

app.use(cors());
app.use(express.json());

/* =======================
   MongoDB
======================= */
mongoose
  .connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017/scribble_game")
  .then(() => console.log("✅ MongoDB connected"))
  .catch(console.error);

/* =======================
   Game Data
======================= */
const WORD_BANK = ["cat", "dog", "house", "tree", "car", "sun"];
const gameRooms = new Map();
const playersSearching = new Map();

/* =======================
   Helpers
======================= */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

/* =======================
   Game Logic
======================= */
function startNewRound(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  const drawer = room.players[room.currentDrawerIndex];
  room.currentWord =
    WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.currentDrawerSid = drawer.sid;

  room.players.forEach((p) => {
    io.to(p.sid).emit("new_round", {
      round: room.round || 1,
      drawer: drawer.username,
      drawerSid: drawer.sid,
      word: p.sid === drawer.sid ? room.currentWord : "",
    });
  });
}

/* =======================
   Socket.IO
======================= */
io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  /* -------- CREATE ROOM -------- */
  socket.on("create_room", ({ room_code, username }) => {
    if (gameRooms.has(room_code)) {
      socket.emit("error", { message: "Room already exists" });
      return;
    }

    gameRooms.set(room_code, {
      players: [{ sid: socket.id, username, score: 0 }],
      currentDrawerIndex: 0,
      round: 1,
    });

    socket.join(room_code);

    socket.emit("room_created", {
      players: gameRooms.get(room_code).players,
    });

    console.log("🏠 Room created:", room_code);
  });

  /* -------- JOIN ROOM -------- */
  socket.on("join_room", ({ room_code, username }) => {
    const room = gameRooms.get(room_code);
    if (!room) {
      socket.emit("error", { message: "Room not found" });
      return;
    }

    room.players.push({
      sid: socket.id,
      username,
      score: 0,
    });

    socket.join(room_code);

    io.to(room_code).emit("player_joined", {
      players: room.players,
    });

    socket.emit("room_joined", {
      players: room.players,
    });

    console.log(`👤 ${username} joined ${room_code}`);
  });

  /* -------- START GAME -------- */
  socket.on("start_game", ({ room_code }) => {
    startNewRound(room_code);
  });

  /* -------- DRAW STROKE -------- */
  socket.on("draw_stroke", ({ room_code, points, color, width }) => {
    socket.to(room_code).emit("stroke_drawn", {
      points,
      color,
      width,
    });
  });

  /* -------- CLEAR CANVAS -------- */
  socket.on("clear_canvas", ({ room_code }) => {
    socket.to(room_code).emit("canvas_cleared");
  });

  /* -------- GUESS -------- */
  socket.on("send_guess", ({ room_code, guess }) => {
    const room = gameRooms.get(room_code);
    if (!room) return;

    if (guess.toLowerCase() === room.currentWord.toLowerCase()) {
      io.to(room_code).emit("correct_guess", {
        player: socket.id,
        points: 100,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("❌ Disconnected:", socket.id);
  });
});

/* =======================
   Health
======================= */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

/* =======================
   Start Server
======================= */
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () =>
  console.log("🚀 Server running on", PORT)
);
