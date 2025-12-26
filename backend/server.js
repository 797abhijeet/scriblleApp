const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// CORS middleware for REST API
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://scriblleapp.onrender.com",
      "http://localhost:5173",
    ],
    credentials: true,
  })
);

app.use(express.json());

// MongoDB connection
const MONGO_URL =
  process.env.MONGO_URL || "mongodb://localhost:27017/scribble_game";
mongoose
  .connect(MONGO_URL)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Socket.IO configuration
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://scriblleapp.onrender.com",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  allowEIO3: true,
});

// Word bank
const WORD_BANK = [
  // Original words (26)
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

  // Animals (25)
  "lion",
  "bear",
  "frog",
  "owl",
  "bee",
  "fox",
  "duck",
  "pig",
  "cow",
  "horse",
  "rabbit",
  "mouse",
  "sheep",
  "goat",
  "snake",
  "whale",
  "shark",
  "turtle",
  "crab",
  "butterfly",
  "spider",
  "ant",
  "elephant",
  "giraffe",
  "monkey",

  // Nature & Weather (25)
  "cloud",
  "rain",
  "snow",
  "wind",
  "storm",
  "river",
  "mountain",
  "ocean",
  "beach",
  "forest",
  "leaf",
  "grass",
  "rock",
  "fire",
  "ice",
  "wave",
  "island",
  "desert",
  "cave",
  "volcano",
  "rainbow",
  "lightning",
  "thunder",
  "fog",
  "dew",

  // Food & Drink (25)
  "apple",
  "banana",
  "cake",
  "pizza",
  "burger",
  "fries",
  "cookie",
  "donut",
  "ice cream",
  "sandwich",
  "cheese",
  "bread",
  "egg",
  "milk",
  "juice",
  "coffee",
  "tea",
  "water",
  "soda",
  "pasta",
  "rice",
  "soup",
  "salad",
  "chocolate",
  "candy",

  // Household Items (25)
  "bed",
  "sofa",
  "lamp",
  "door",
  "window",
  "mirror",
  "brush",
  "key",
  "lock",
  "pen",
  "pencil",
  "paper",
  "bag",
  "box",
  "ball",
  "toy",
  "game",
  "tv",
  "radio",
  "fan",
  "oven",
  "fridge",
  "sink",
  "toilet",
  "shower",

  // Clothing & Accessories (20)
  "shirt",
  "pants",
  "dress",
  "skirt",
  "jacket",
  "coat",
  "sock",
  "glove",
  "scarf",
  "belt",
  "watch",
  "ring",
  "necklace",
  "glasses",
  "purse",
  "wallet",
  "tie",
  "boot",
  "sandal",
  "sunglasses",

  // Transportation (20)
  "bus",
  "train",
  "plane",
  "boat",
  "ship",
  "truck",
  "motorcycle",
  "helicopter",
  "rocket",
  "submarine",
  "taxi",
  "van",
  "ambulance",
  "firetruck",
  "police car",
  "scooter",
  "skateboard",
  "wagon",
  "tractor",
  "jetski",

  // People & Body Parts (20)
  "baby",
  "child",
  "woman",
  "man",
  "family",
  "friend",
  "hand",
  "foot",
  "head",
  "face",
  "eye",
  "nose",
  "mouth",
  "ear",
  "hair",
  "heart",
  "bone",
  "tooth",
  "leg",
  "arm",

  // Buildings & Places (20)
  "school",
  "store",
  "hospital",
  "restaurant",
  "hotel",
  "bank",
  "park",
  "zoo",
  "farm",
  "castle",
  "bridge",
  "tower",
  "tent",
  "pyramid",
  "statue",
  "fountain",
  "library",
  "museum",
  "factory",
  "apartment",

  // Shapes & Colors (20)
  "circle",
  "square",
  "triangle",
  "rectangle",
  "oval",
  "diamond",
  "heart shape",
  "star shape",
  "arrow",
  "line",
  "red",
  "blue",
  "green",
  "yellow",
  "orange",
  "purple",
  "pink",
  "black",
  "white",
  "brown",

  // Tools & Objects (20)
  "hammer",
  "nail",
  "screwdriver",
  "scissors",
  "knife",
  "fork",
  "spoon",
  "plate",
  "bowl",
  "pot",
  "pan",
  "broom",
  "bucket",
  "ladder",
  "rope",
  "chain",
  "hook",
  "flag",
  "balloon",
  "kite",

  // Fantasy & Entertainment (20)
  "dragon",
  "unicorn",
  "robot",
  "alien",
  "ghost",
  "wizard",
  "fairy",
  "pirate",
  "crown",
  "castle",
  "magic",
  "music",
  "movie",
  "camera",
  "microphone",
  "guitar",
  "drum",
  "trumpet",
  "violin",
  "harp",

  // Sports & Activities (20)
  "ball",
  "bat",
  "goal",
  "net",
  "racket",
  "pool",
  "slide",
  "swing",
  "jump",
  "run",
  "swim",
  "dance",
  "sing",
  "paint",
  "draw",
  "read",
  "write",
  "cook",
  "shop",
  "hike",
];

// Total words: 286 (26 original + 260 new)

// In-memory storage
const gameRooms = new Map();
const players = new Map();

// Game constants
const ROUND_TIME = 60;
const MAX_PLAYERS = 8;
const MIN_PLAYERS = 2;
const MAX_ROUNDS = 5;

// Helper functions
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log(`✅ User connected: ${socket.id}`);

  // Send connection confirmation
  socket.emit("connected", {
    message: "Connected to server",
    sid: socket.id,
  });

  // Create room - SINGLE HANDLER (FIXED)
  socket.on("create_room", (data) => {
    try {
      const { username, room_code } = data;

      console.log(
        `📝 Creating room request from ${username}, code: ${room_code}`
      );

      if (!username) {
        socket.emit("error", { message: "Username is required" });
        return;
      }

      // If room_code is provided, use it. Otherwise generate one.
      let roomCode;
      if (room_code && room_code.trim()) {
        roomCode = room_code.toUpperCase().trim();

        // Check if room already exists
        if (gameRooms.has(roomCode)) {
          socket.emit("error", {
            message: `Room ${roomCode} already exists. Try a different code.`,
          });
          return;
        }
      } else {
        roomCode = generateRoomCode();
      }

      console.log(`🎮 Creating room with code: ${roomCode}`);

      // Create room object
      const room = {
        code: roomCode,
        players: [
          {
            id: socket.id,
            username: username,
            isHost: true,
            score: 0,
            avatar: null,
          },
        ],
        gameStarted: false,
        currentRound: 0,
        currentWord: null,
        currentDrawer: null,
        strokes: [],
        guessedPlayers: [],
        roundTimer: null,
        roundStartTime: null,
      };

      // Store the room
      gameRooms.set(roomCode, room);
      players.set(socket.id, { roomCode, username });

      // Join the room
      socket.join(roomCode);

      console.log(`✅ Room ${roomCode} created by ${username}`);
      console.log(`📊 Total rooms now: ${gameRooms.size}`);

      // Log all rooms for debugging
      console.log("Active rooms:", Array.from(gameRooms.keys()));

      // Send response to creator
      socket.emit("room_created", {
        roomCode,
        players: room.players,
        message: `Room ${roomCode} created successfully! Share this code with friends: ${roomCode}`,
      });
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("error", { message: "Failed to create room" });
    }
  });

  // Join room - UPDATED with better handling
  socket.on("join_room", (data) => {
    try {
      const { room_code, username } = data;
      const roomCode = room_code.toUpperCase().trim();

      console.log(
        `🔍 Attempting to join room: ${roomCode}, Username: ${username}`
      );

      // Debug: Log all rooms
      console.log(
        `📊 Available rooms:`,
        Array.from(gameRooms.entries()).map(([code, room]) => ({
          code,
          playerCount: room.players.length,
          players: room.players.map((p) => p.username),
          gameStarted: room.gameStarted,
        }))
      );

      if (!roomCode || !username) {
        socket.emit("error", {
          message: "Room code and username are required",
        });
        return;
      }

      const room = gameRooms.get(roomCode);

      if (!room) {
        console.log(
          `❌ Room ${roomCode} not found. Available rooms: ${Array.from(
            gameRooms.keys()
          )}`
        );
        socket.emit("error", {
          message: `Room ${roomCode} not found. Make sure the code is correct or ask the host to share it again.`,
        });
        return;
      }

      console.log(
        `✅ Room ${roomCode} found, players: ${room.players.map(
          (p) => p.username
        )}`
      );

      if (room.players.length >= MAX_PLAYERS) {
        socket.emit("error", { message: "Room is full (max 8 players)" });
        return;
      }

      if (
        room.players.some(
          (p) => p.username.toLowerCase() === username.toLowerCase()
        )
      ) {
        socket.emit("error", {
          message: "Username already taken in this room",
        });
        return;
      }

      if (room.gameStarted) {
        // Allow joining mid-game as spectator/player
        console.log(`⚠️ ${username} joining game in progress`);
      }

      const newPlayer = {
        id: socket.id,
        username,
        isHost: false,
        score: room.gameStarted ? 0 : 0, // Start with 0 if joining mid-game
        avatar: null,
      };

      room.players.push(newPlayer);
      players.set(socket.id, { roomCode, username });
      socket.join(roomCode);

      console.log(`👤 ${username} successfully joined room ${roomCode}`);

      // Send current game state to new player
      const gameState = {
        roomCode,
        players: room.players,
        gameStarted: room.gameStarted,
        currentRound: room.currentRound,
        currentWord: room.currentWord,
        currentDrawer: room.currentDrawer,
        timeLeft: room.roundTimer
          ? Math.floor(
              (room.roundStartTime + ROUND_TIME * 1000 - Date.now()) / 1000
            )
          : 0,
        scores: room.players.map((p) => ({
          username: p.username,
          score: p.score,
        })),
      };

      // Notify new player
      socket.emit("room_joined", gameState);

      // Notify all players in the room (including the new one)
      io.to(roomCode).emit("room_players_update", {
        players: room.players,
        message: `${username} joined the room`,
      });

      // If game is in progress, send current game state
      if (room.gameStarted) {
        socket.emit("game_state_update", {
          gameStarted: true,
          currentRound: room.currentRound,
          drawer:
            room.players.find((p) => p.id === room.currentDrawer)?.username ||
            "Unknown",
          drawerSid: room.currentDrawer,
          word:
            socket.id === room.currentDrawer
              ? room.currentWord
              : "_".repeat(room.currentWord?.length || 0),
          timeLeft: Math.max(
            0,
            ROUND_TIME - Math.floor((Date.now() - room.roundStartTime) / 1000)
          ),
        });

        // Send current canvas state
        if (room.strokes.length > 0) {
          setTimeout(() => {
            room.strokes.forEach((stroke) => {
              socket.emit("stroke_drawn", stroke);
            });
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("error", {
        message: "Failed to join room. Please try again.",
      });
    }
  });

  // Start game
  socket.on("start_game", (data) => {
    try {
      const { room_code } = data;
      const roomCode = room_code.toUpperCase();

      const room = gameRooms.get(roomCode);
      if (!room) {
        socket.emit("error", { message: "Room not found" });
        return;
      }

      const player = room.players.find((p) => p.id === socket.id);
      if (!player?.isHost) {
        socket.emit("error", { message: "Only the host can start the game" });
        return;
      }

      if (room.players.length < MIN_PLAYERS) {
        socket.emit("error", {
          message: `Need at least ${MIN_PLAYERS} players to start`,
        });
        return;
      }

      room.gameStarted = true;
      room.currentRound = 1;
      room.currentDrawer = room.players[0].id;
      room.currentWord =
        WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
      room.guessedPlayers = [];
      room.strokes = [];

      // Shuffle players for drawing order
      room.players = room.players.sort(() => Math.random() - 0.5);

      console.log(
        `🎯 Game started in room ${roomCode}, word: ${room.currentWord}`
      );

      // Notify all players
      io.to(roomCode).emit("game_started", {
        players: room.players,
        currentRound: 1,
        totalRounds: MAX_ROUNDS,
      });

      // Start first round
      setTimeout(() => startNewRound(roomCode), 2000);
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  });

  // Drawing events
  socket.on("draw_stroke", (data) => {
    try {
      const { room_code, points, color, width } = data;
      const roomCode = room_code.toUpperCase();

      const room = gameRooms.get(roomCode);
      if (!room || room.currentDrawer !== socket.id) return;

      const strokeData = {
        points,
        color: color || "#000000",
        width: width || 3,
      };

      room.strokes.push(strokeData);

      // Broadcast to all other players
      socket.to(roomCode).emit("stroke_drawn", strokeData);
    } catch (error) {
      console.error("Error drawing stroke:", error);
    }
  });

  socket.on("clear_canvas", (data) => {
    const { room_code } = data;
    const roomCode = room_code.toUpperCase();

    const room = gameRooms.get(roomCode);
    if (!room || room.currentDrawer !== socket.id) return;

    room.strokes = [];
    io.to(roomCode).emit("canvas_cleared");
  });

  // Guess word
  socket.on("send_guess", (data) => {
    try {
      const { room_code, guess } = data;
      const roomCode = room_code.toUpperCase();

      const room = gameRooms.get(roomCode);
      if (!room || !room.currentWord) return;

      const player = room.players.find((p) => p.id === socket.id);
      if (!player || socket.id === room.currentDrawer) return;

      if (room.guessedPlayers.includes(socket.id)) {
        socket.emit("guess_result", {
          correct: false,
          message: "You already guessed correctly!",
        });
        return;
      }

      const guessLower = guess.toLowerCase().trim();
      const wordLower = room.currentWord.toLowerCase();

      // Broadcast guess to chat
      io.to(roomCode).emit("chat_message", {
        username: player.username,
        message: guess,
        type: "guess",
      });

      if (guessLower === wordLower) {
        // Correct guess
        room.guessedPlayers.push(socket.id);

        const timeElapsed = (Date.now() - room.roundStartTime) / 1000;
        const points = Math.max(50, 300 - Math.floor(timeElapsed * 3));
        player.score += points;

        // Award drawer
        const drawer = room.players.find((p) => p.id === room.currentDrawer);
        if (drawer) {
          drawer.score += 25;
        }

        // Notify all players
        io.to(roomCode).emit("correct_guess", {
          player: player.username,
          points,
          totalGuessed: room.guessedPlayers.length,
        });

        socket.emit("guess_result", {
          correct: true,
          points,
          word: room.currentWord,
        });

        // Check if all players guessed
        if (room.guessedPlayers.length === room.players.length - 1) {
          endRound(roomCode);
        }
      } else {
        socket.emit("guess_result", {
          correct: false,
          message: "Try again!",
        });
      }
    } catch (error) {
      console.error("Error processing guess:", error);
    }
  });

  // Chat message
  socket.on("chat_message", (data) => {
    const { room_code, message } = data;
    const roomCode = room_code.toUpperCase();

    const room = gameRooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.id === socket.id);
    if (!player) return;

    io.to(roomCode).emit("chat_message", {
      username: player.username,
      message,
      type: "chat",
    });
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);

    const playerData = players.get(socket.id);
    if (playerData) {
      const room = gameRooms.get(playerData.roomCode);
      if (room) {
        const playerIndex = room.players.findIndex((p) => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          room.players.splice(playerIndex, 1);

          console.log(`👋 ${player.username} left room ${playerData.roomCode}`);

          if (room.players.length === 0) {
            gameRooms.delete(playerData.roomCode);
            console.log(`🧹 Room ${playerData.roomCode} deleted (empty)`);
          } else {
            // Notify remaining players
            io.to(playerData.roomCode).emit("player_left", {
              player: player.username,
              players: room.players,
            });

            // Assign new host if needed
            if (player.isHost && room.players.length > 0) {
              room.players[0].isHost = true;
              io.to(playerData.roomCode).emit("new_host", {
                host: room.players[0].username,
              });
            }

            // Handle drawer disconnection
            if (room.gameStarted && room.currentDrawer === socket.id) {
              startNewRound(playerData.roomCode);
            }
          }
        }
      }
      players.delete(socket.id);
    }
  });
});

// Game functions
function startNewRound(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room || !room.gameStarted) return;

  // Find next drawer
  let drawerIndex = room.players.findIndex((p) => p.id === room.currentDrawer);
  drawerIndex = (drawerIndex + 1) % room.players.length;

  room.currentDrawer = room.players[drawerIndex].id;
  room.currentWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.strokes = [];
  room.guessedPlayers = [];
  room.roundStartTime = Date.now();

  console.log(
    `🎨 Round ${room.currentRound} - ${room.players[drawerIndex].username} drawing: ${room.currentWord}`
  );

  // Notify drawer with the word
  io.to(room.currentDrawer).emit("new_round", {
    round: room.currentRound,
    drawer: room.players[drawerIndex].username,
    drawerSid: room.currentDrawer,
    word: room.currentWord,
    wordLength: room.currentWord.length,
    roundTime: ROUND_TIME,
  });

  // Notify other players with blanks
  room.players.forEach((player) => {
    if (player.id !== room.currentDrawer) {
      io.to(player.id).emit("new_round", {
        round: room.currentRound,
        drawer: room.players[drawerIndex].username,
        drawerSid: room.currentDrawer,
        word: "_".repeat(room.currentWord.length),
        wordLength: room.currentWord.length,
        roundTime: ROUND_TIME,
      });
    }
  });

  // Start round timer
  if (room.roundTimer) clearTimeout(room.roundTimer);
  room.roundTimer = setTimeout(() => endRound(roomCode), ROUND_TIME * 1000);
}

function endRound(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  if (room.roundTimer) {
    clearTimeout(room.roundTimer);
    room.roundTimer = null;
  }

  // Notify players of round end
  io.to(roomCode).emit("round_end", {
    word: room.currentWord,
    players: room.players,
    guessedPlayers: room.guessedPlayers.length,
  });

  console.log(`🏁 Round ${room.currentRound} ended in room ${roomCode}`);

  // Check if game should continue
  room.currentRound++;
  if (room.currentRound > MAX_ROUNDS) {
    endGame(roomCode);
  } else {
    // Start next round after delay
    setTimeout(() => startNewRound(roomCode), 5000);
  }
}

function endGame(roomCode) {
  const room = gameRooms.get(roomCode);
  if (!room) return;

  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);

  io.to(roomCode).emit("game_end", {
    players: sortedPlayers,
    winner: sortedPlayers[0],
  });

  console.log(`🏆 Game ended in room ${roomCode}`);

  // Reset room
  room.gameStarted = false;
  room.currentRound = 0;
  room.currentDrawer = null;
  room.currentWord = null;
  room.strokes = [];
  room.guessedPlayers = [];
}

// REST API Routes
app.get("/", (req, res) => {
  res.json({
    message: "Scribble Game API",
    version: "1.0.0",
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    activeRooms: gameRooms.size,
    activePlayers: players.size,
  });
});

// Debug endpoint to list all rooms
app.get("/api/rooms/list", (req, res) => {
  const roomsList = [];

  for (const [code, room] of gameRooms.entries()) {
    roomsList.push({
      code,
      playerCount: room.players.length,
      players: room.players.map((p) => p.username),
      gameStarted: room.gameStarted,
      createdAt: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    rooms: roomsList,
    total: roomsList.length,
  });
});

// Check if room exists - IMPORTANT FOR HOME PAGE
app.get("/api/rooms/:roomCode/exists", (req, res) => {
  const roomCode = req.params.roomCode.toUpperCase();
  const room = gameRooms.get(roomCode);

  res.json({
    exists: !!room,
    roomCode,
    playerCount: room ? room.players.length : 0,
    gameStarted: room ? room.gameStarted : false,
    players: room ? room.players.map((p) => p.username) : [],
    maxPlayers: MAX_PLAYERS,
  });
});

// Start server
const PORT = process.env.PORT || 8001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Scribble Game Server running on port ${PORT}
📡 Socket.IO ready for connections
🎮 Max players per room: ${MAX_PLAYERS}
⏱️ Round time: ${ROUND_TIME} seconds
  `);
});
