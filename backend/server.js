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
  cors: {
    origin: "*",
  },
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

    const dist = distanceKm(lat, lng, data.lat, data.lng);
    if (dist <= NEARBY_RADIUS_KM) {
      return { sid, ...data, distance: dist };
    }
  }
  return null;
}

/* =======================
   Socket.IO
======================= */
io.on("connection", (socket) => {
  console.log("✅ Connected:", socket.id);

  /* -------- FIND NEARBY -------- */
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

      // 🔥 Send match to BOTH sockets
      socket.emit("match_found", {
        roomCode,
        matchedWith: match.username,
        distance: match.distance.toFixed(1),
      });

      io.to(match.sid).emit("match_found", {
        roomCode,
        matchedWith: username,
        distance: match.distance.toFixed(1),
      });

      console.log("📍 Nearby match created:", roomCode);
    } else {
      playersSearching.set(socket.id, { lat, lng, username });
      socket.emit("searching", {
        message: "Searching for nearby players...",
      });
    }
  });

  /* -------- CANCEL SEARCH -------- */
  socket.on("cancel_search", () => {
    playersSearching.delete(socket.id);
    console.log("❌ Nearby search cancelled:", socket.id);
  });

  socket.on("disconnect", () => {
    playersSearching.delete(socket.id);
    console.log("❌ Disconnected:", socket.id);
  });
});

/* =======================
   Health
======================= */
app.get("/health", (_, res) => {
  res.json({
    status: "ok",
    searching: playersSearching.size,
    rooms: gameRooms.size,
  });
});

/* =======================
   Start Server
======================= */
const PORT = process.env.PORT || 10000;
server.listen(PORT, "0.0.0.0", () =>
  console.log("🚀 Server running on", PORT)
);
