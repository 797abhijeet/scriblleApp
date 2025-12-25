require("dotenv").config();

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { getDistance } = require("geolib");

const app = express();
const server = http.createServer(app);

server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

const io = new Server(server, {
  cors: { origin: "*" },
  transports: ["websocket"],
});

app.use(cors());
app.use(express.json());

/* =======================
   In-Memory Stores
======================= */
const gameRooms = new Map();
const playersSearching = new Map();

const NEARBY_RADIUS_KM = 50;

/* =======================
   Helpers
======================= */
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function distanceKm(lat1, lng1, lat2, lng2) {
  return (
    getDistance(
      { latitude: lat1, longitude: lng1 },
      { latitude: lat2, longitude: lng2 }
    ) / 1000
  );
}

function findNearbyPlayer(myId, lat, lng) {
  for (const [sid, data] of playersSearching.entries()) {
    if (sid === myId) continue;
    if (distanceKm(lat, lng, data.lat, data.lng) <= NEARBY_RADIUS_KM) {
      return { sid, ...data };
    }
  }
  return null;
}

/* =======================
   SOCKET.IO
======================= */
io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  /* ---------- CREATE ROOM ---------- */
  socket.on("create_room", ({ room_code, username }) => {
    if (gameRooms.has(room_code)) {
      return socket.emit("error", { message: "Room already exists" });
    }

    gameRooms.set(room_code, {
      players: [{ sid: socket.id, username, score: 0 }],
    });

    socket.join(room_code);

    socket.emit("room_created", {
      players: gameRooms.get(room_code).players,
    });

    console.log("🏠 Room created:", room_code);
  });

  /* ---------- JOIN ROOM ---------- */
  socket.on("join_room", ({ room_code, username }) => {
    const room = gameRooms.get(room_code);

    if (!room) {
      return socket.emit("error", { message: "Room not found" });
    }

    if (room.players.some((p) => p.sid === socket.id)) return;

    room.players.push({ sid: socket.id, username, score: 0 });
    socket.join(room_code);

    io.to(room_code).emit("player_joined", {
      players: room.players,
    });

    socket.emit("room_joined", {
      players: room.players,
    });

    console.log("➕ Joined room:", room_code);
  });

  /* ---------- NEARBY MATCH ---------- */
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
      });

      socket.join(roomCode);
      io.sockets.sockets.get(match.sid)?.join(roomCode);

      socket.emit("match_found", {
        roomCode,
        matchedWith: match.username,
      });

      io.to(match.sid).emit("match_found", {
        roomCode,
        matchedWith: username,
      });

      console.log("📍 Nearby room created:", roomCode);
    } else {
      playersSearching.set(socket.id, { lat, lng, username });
      socket.emit("searching");
    }
  });

  socket.on("cancel_search", () => {
    playersSearching.delete(socket.id);
  });

  /* ---------- DISCONNECT CLEANUP ---------- */
  socket.on("disconnect", () => {
    playersSearching.delete(socket.id);

    for (const [code, room] of gameRooms.entries()) {
      room.players = room.players.filter((p) => p.sid !== socket.id);

      if (room.players.length === 0) {
        gameRooms.delete(code);
      } else {
        io.to(code).emit("player_left", {
          players: room.players,
        });
      }
    }

    console.log("❌ Disconnected:", socket.id);
  });
});

/* =======================
   HEALTH
======================= */
app.get("/health", (_, res) => {
  res.json({
    rooms: gameRooms.size,
    searching: playersSearching.size,
  });
});

/* =======================
   START
======================= */
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () =>
  console.log("🚀 Server running on", PORT)
);
