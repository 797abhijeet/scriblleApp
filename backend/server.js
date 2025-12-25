require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
const Room = require("./models/room");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  path: "/api/socket.io",
  cors: { origin: "*" },
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(console.error);

const WORD_BANK = ["cat", "dog", "car", "house", "tree", "phone", "pizza", "apple"];

const generateRoomCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/* ======================
   GAME HELPERS
====================== */
async function startNewRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const drawer = room.players[room.currentDrawerIndex];
  room.currentDrawerSid = drawer.sid;
  room.currentWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.roundActive = true;
  room.guessedPlayers = [];
  room.strokes = [];

  await room.save();

  room.players.forEach((p) => {
    io.to(p.sid).emit("new_round", {
      round: room.currentRound,
      drawer: drawer.username,
      drawerSid: drawer.sid,
      word: p.sid === drawer.sid ? room.currentWord : "_".repeat(room.currentWord.length),
    });
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

  if (room.currentDrawerIndex === 0) room.currentRound++;

  if (room.currentRound > room.maxRounds) {
    io.to(roomCode).emit("game_end", {
      players: [...room.players].sort((a, b) => b.score - a.score),
    });

    room.gameStarted = false;
    room.currentRound = 1;
    room.currentDrawerIndex = 0;
    room.players.forEach(p => p.score = 0);
    await room.save();
    return;
  }

  await room.save();
  startNewRound(roomCode);
}

/* ======================
   SOCKET
====================== */
io.on("connection", (socket) => {
  console.log("🔗 Connected:", socket.id);

  socket.on("create_room", async ({ username }) => {
    const roomCode = generateRoomCode();

    const room = await Room.create({
      roomCode,
      players: [{ sid: socket.id, username, isHost: true }],
      gameStarted: false,
      currentRound: 1,
    });

    socket.join(roomCode);

    socket.emit("room_created", {
      roomCode,
      players: room.players,
    });
  });

  socket.on("join_room", async ({ room_code, username }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room) return socket.emit("error", { message: "Room not found" });

    room.players.push({ sid: socket.id, username });
    await room.save();

    socket.join(room_code);
    io.to(room_code).emit("room_joined", { players: room.players });
  });

  socket.on("start_game", async ({ room_code }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room) return;

    room.gameStarted = true;
    await room.save();

    io.to(room_code).emit("game_started");
    startNewRound(room_code);
  });

  socket.on("draw_stroke", async ({ room_code, ...stroke }) => {
    socket.to(room_code).emit("stroke_drawn", stroke);
  });

  socket.on("send_guess", async ({ room_code, guess }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || !room.roundActive) return;

    if (guess.toLowerCase() === room.currentWord.toLowerCase()) {
      const player = room.players.find(p => p.sid === socket.id);
      if (!player) return;

      room.roundActive = false;
      player.score += 100;
      await room.save();

      io.to(room_code).emit("system_message", {
        text: `✅ ${player.username} guessed the word correctly!`
      });

      setTimeout(() => endRound(room_code), 1000);
      return;
    }

    io.to(room_code).emit("chat_message", {
      username: room.players.find(p => p.sid === socket.id)?.username,
      message: guess,
    });
  });

  /* ======================
     PLAYER DISCONNECTION HANDLING
  ====================== */
  socket.on("disconnect", async () => {
    console.log("🔌 Disconnected:", socket.id);

    try {
      // Find all rooms where this player exists
      const rooms = await Room.find({ "players.sid": socket.id });

      for (const room of rooms) {
        const player = room.players.find(p => p.sid === socket.id);
        if (!player) continue;

        // Store player info for message
        const playerUsername = player.username;
        const wasHost = player.isHost;

        // Remove player from room
        room.players = room.players.filter(p => p.sid !== socket.id);

        // If room becomes empty, delete it
        if (room.players.length === 0) {
          await Room.deleteOne({ roomCode: room.roomCode });
          continue;
        }

        // If the disconnected player was the host, transfer host to the next player
        if (wasHost && room.players.length > 0) {
          room.players[0].isHost = true;
          
          io.to(room.roomCode).emit("system_message", {
            text: `👑 ${room.players[0].username} is now the room owner`
          });
        }

        // Save room
        await room.save();

        // Notify all players in the room
        io.to(room.roomCode).emit("player_left", {
          players: room.players,
          leftPlayer: playerUsername,
          isHost: wasHost,
          newHost: wasHost && room.players.length > 0 ? room.players[0].username : null
        });

        // Send system message to chat
        io.to(room.roomCode).emit("system_message", {
          text: `👋 ${playerUsername} left the room${wasHost ? " (was room owner)" : ""}`
        });
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

const PORT = process.env.PORT || 8001;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on ${PORT}`)
);