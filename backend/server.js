require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const { getDistance } = require("geolib");
const Room = require("./models/room");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  path: "/api/socket.io",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

app.use(cors());
app.use(express.json());

/* ==========================
   MongoDB
========================== */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error", err));

/* ==========================
   Constants
========================== */
const WORD_BANK = [
  "cat","dog","house","tree","car","sun","moon","star","flower","bird",
  "book","phone","computer","pizza","burger","apple","banana","chair",
  "table","clock","butterfly","mountain","river","rocket","airplane",
];

const NEARBY_RADIUS_KM = 50;

/* ==========================
   Helpers
========================== */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  return (
    getDistance(
      { latitude: lat1, longitude: lon1 },
      { latitude: lat2, longitude: lon2 }
    ) / 1000
  );
}

/* ==========================
   Game Logic
========================== */
async function startNewRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const drawer = room.players[room.currentDrawerIndex];
  if (!drawer) return;

  room.currentDrawerSid = drawer.sid;
  room.currentWord =
    WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.strokes = [];
  room.guessedPlayers = [];
  room.roundActive = true;
  room.roundStartTime = Date.now();

  await room.save();

  // Drawer sees full word
  io.to(drawer.sid).emit("new_round", {
    drawer: drawer.username,
    drawerSid: drawer.sid,
    word: room.currentWord,
    wordLength: room.currentWord.length,
  });

  // Others see blanks
  room.players.forEach((p) => {
    if (p.sid !== drawer.sid) {
      io.to(p.sid).emit("new_round", {
        drawer: drawer.username,
        drawerSid: drawer.sid,
        word: "_".repeat(room.currentWord.length),
        wordLength: room.currentWord.length,
      });
    }
  });
}

async function endRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  io.to(roomCode).emit("round_end", {
    word: room.currentWord,
    players: room.players,
  });

  room.currentDrawerIndex =
    (room.currentDrawerIndex + 1) % room.players.length;

  if (room.currentDrawerIndex === 0) {
    room.currentRound += 1;
  }

  if (room.currentRound > room.maxRounds) {
    io.to(roomCode).emit("game_end", {
      players: [...room.players].sort((a, b) => b.score - a.score),
    });

    room.gameStarted = false;
    room.currentRound = 0;
    room.currentDrawerIndex = 0;
    room.players.forEach((p) => (p.score = 0));
    await room.save();
    return;
  }

  await room.save();
  startNewRound(roomCode);
}

/* ==========================
   Socket.IO
========================== */
io.on("connection", (socket) => {
  console.log("🔗 Connected:", socket.id);

  socket.emit("connected", { sid: socket.id });

  /* ===== Room Creation ===== */
  socket.on("create_room", async ({ username }) => {
    const roomCode = generateRoomCode();

    const room = await Room.create({
      roomCode,
      players: [{ sid: socket.id, username, score: 0, isHost: true }],
      gameStarted: false,
      currentRound: 0,
      maxRounds: 3,
      currentDrawerIndex: 0,
      guessedPlayers: [],
      roundActive: false,
    });

    socket.join(roomCode);

    socket.emit("room_created", {
      room_code: roomCode,
      players: room.players,
    });
  });

  /* ===== Join Room ===== */
  socket.on("join_room", async ({ room_code, username }) => {
    const roomCode = room_code.toUpperCase();
    const room = await Room.findOne({ roomCode });

    if (!room) {
      socket.emit("error", { message: "Room not found" });
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

    io.to(roomCode).emit("player_joined", {
      players: room.players,
    });
  });

  /* ===== Start Game ===== */
  socket.on("start_game", async ({ room_code }) => {
    const roomCode = room_code.toUpperCase();
    const room = await Room.findOne({ roomCode });
    if (!room) return;

    const host = room.players.find(
      (p) => p.sid === socket.id && p.isHost
    );

    if (!host) {
      socket.emit("error", { message: "Only host can start" });
      return;
    }

    room.gameStarted = true;
    room.currentRound = 1;
    await room.save();

    io.to(roomCode).emit("game_started");
    startNewRound(roomCode);
  });

  /* ===== Drawing ===== */
  socket.on("draw_stroke", async ({ room_code, points, color, width }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || room.currentDrawerSid !== socket.id) return;

    const stroke = { points, color, width };
    room.strokes.push(stroke);
    await room.save();

    socket.to(room_code).emit("stroke_drawn", stroke);
  });

  /* ===== Guess ===== */
  socket.on("send_guess", async ({ room_code, guess }) => {
    const roomCode = room_code.toUpperCase();
    const room = await Room.findOne({ roomCode });
    if (!room || !room.roundActive) return;

    if (room.currentDrawerSid === socket.id) return;
    if (room.guessedPlayers.includes(socket.id)) return;

    const player = room.players.find((p) => p.sid === socket.id);
    if (!player) return;

    if (guess.trim().toLowerCase() === room.currentWord.toLowerCase()) {
      room.roundActive = false;
      room.guessedPlayers.push(socket.id);
      player.score += 100;
      await room.save();

      io.to(roomCode).emit("system_message", {
        text: `✅ ${player.username} guessed the word correctly!`,
      });

      setTimeout(() => endRound(roomCode), 800);
      return;
    }

    io.to(roomCode).emit("chat_message", {
      username: player.username,
      message: guess,
    });
  });

  /* ===== Disconnect + Host Migration ===== */
  socket.on("disconnect", async () => {
    console.log("❌ Disconnected:", socket.id);

    const room = await Room.findOne({ "players.sid": socket.id });
    if (!room) return;

    const leaving = room.players.find((p) => p.sid === socket.id);
    const wasHost = leaving?.isHost;

    room.players = room.players.filter((p) => p.sid !== socket.id);

    if (room.players.length === 0) {
      await Room.deleteOne({ roomCode: room.roomCode });
      return;
    }

    if (wasHost) {
      room.players.forEach((p) => (p.isHost = false));
      room.players[0].isHost = true;

      io.to(room.roomCode).emit("host_changed", {
        newHostSid: room.players[0].sid,
        newHostUsername: room.players[0].username,
      });
    }

    await room.save();

    io.to(room.roomCode).emit("player_left", {
      players: room.players,
    });
  });
});

/* ==========================
   REST
========================== */
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

const PORT = process.env.PORT || 8001;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on ${PORT}`)
);
