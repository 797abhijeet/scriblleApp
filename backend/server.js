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

const WORD_BANK = ["cat", "dog", "car", "house", "tree", "phone", "pizza", "apple", "mountain", "ocean", "computer", "guitar", "bicycle", "flower", "pencil"];
const WORD_DIFFICULTY = {
  "cat": 1, "dog": 1, "car": 1,
  "house": 2, "tree": 2, "phone": 2,
  "pizza": 3, "apple": 3, "mountain": 3,
  "ocean": 4, "computer": 4, "guitar": 4,
  "bicycle": 5, "flower": 5, "pencil": 5
};

const generateRoomCode = () =>
  Math.random().toString(36).substring(2, 8).toUpperCase();

/* ======================
   SCORING SYSTEM
====================== */
class ScoringSystem {
  // Strategy 1: Time-based scoring (faster guesses = more points)
  static timeBasedScore(baseScore, timeLeft, roundDuration) {
    const timePercentage = timeLeft / roundDuration;
    return Math.floor(baseScore * timePercentage);
  }

  // Strategy 2: Difficulty-based scoring (harder words = more points)
  static difficultyBasedScore(word) {
    const difficulty = WORD_DIFFICULTY[word] || 3;
    return difficulty * 50; // 50-250 points based on difficulty
  }

  // Strategy 3: Streak bonus (consecutive correct guesses)
  static streakBonus(player, baseScore) {
    const streak = player.streak || 0;
    const bonus = Math.min(streak * 10, 100); // Max 100 bonus
    return baseScore + bonus;
  }

  // Strategy 4: Position-based scoring (first guess gets bonus)
  static positionBonus(baseScore, guessOrder, totalPlayers) {
    if (guessOrder === 1) return baseScore * 1.5; // First correct gets 50% bonus
    if (guessOrder === 2) return baseScore * 1.25; // Second gets 25% bonus
    return baseScore;
  }

  // Strategy 5: Drawing quality bonus (if drawer gets likes)
  static drawingBonus(baseScore, likes) {
    return baseScore + (likes * 5);
  }

  // Main scoring function combining multiple strategies
  static calculateScore(word, timeLeft, roundDuration, player, guessOrder, totalPlayers) {
    let score = 0;
    
    // Base score based on difficulty
    const baseScore = this.difficultyBasedScore(word);
    
    // Apply time bonus (faster = more points)
    const timeBonus = this.timeBasedScore(baseScore, timeLeft, roundDuration);
    
    // Apply position bonus
    const positionBonus = this.positionBonus(timeBonus, guessOrder, totalPlayers);
    
    // Apply streak bonus
    const streakBonus = this.streakBonus(player, positionBonus);
    
    // Ensure minimum score
    score = Math.max(streakBonus, 50);
    
    // Cap maximum score
    score = Math.min(score, 500);
    
    return Math.floor(score);
  }
}

/* ======================
   GAME HELPERS
====================== */
async function startNewRound(roomCode) {
  const room = await Room.findOne({ roomCode });
  if (!room) return;

  const drawer = room.players[room.currentDrawerIndex];
  room.currentDrawerSid = drawer.sid;
  
  // Select random word
  const randomWord = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  room.currentWord = randomWord;
  room.roundActive = true;
  room.guessedPlayers = [];
  room.strokes = [];
  room.roundStartTime = Date.now();
  room.roundDuration = 60; // 60 seconds per round
  room.correctGuessCount = 0;

  await room.save();

  room.players.forEach((p) => {
    io.to(p.sid).emit("new_round", {
      round: room.currentRound,
      drawer: drawer.username,
      drawerSid: drawer.sid,
      word: p.sid === drawer.sid ? room.currentWord : "_".repeat(room.currentWord.length),
      wordLength: room.currentWord.length,
      difficulty: WORD_DIFFICULTY[room.currentWord] || 3,
      roundDuration: room.roundDuration
    });
  });

  // Start round timer
  setTimeout(() => {
    if (room.roundActive) {
      endRound(roomCode, false);
    }
  }, room.roundDuration * 1000);
}

async function handleCorrectGuess(room, player, socket) {
  if (!room.roundActive) return;
  
  // Calculate time left
  const elapsedTime = Date.now() - room.roundStartTime;
  const timeLeftSeconds = Math.max(0, room.roundDuration - Math.floor(elapsedTime / 1000));
  
  // Increment correct guess count
  room.correctGuessCount += 1;
  
  // Calculate score using multiple strategies
  const score = ScoringSystem.calculateScore(
    room.currentWord,
    timeLeftSeconds,
    room.roundDuration,
    player,
    room.correctGuessCount,
    room.players.length
  );
  
  // Update player stats
  player.score += score;
  player.streak = (player.streak || 0) + 1;
  player.correctGuesses = (player.correctGuesses || 0) + 1;
  player.totalScore += score;
  
  // Add to guessed players
  room.guessedPlayers.push({
    sid: socket.id,
    username: player.username,
    time: Date.now(),
    score: score
  });
  
  // Notify all players
  io.to(room.roomCode).emit("correct_guess", {
    player: player.username,
    points: score,
    word: room.currentWord,
    timeLeft: timeLeftSeconds,
    guessOrder: room.correctGuessCount
  });
  
  io.to(room.roomCode).emit("system_message", {
    text: `🎉 ${player.username} guessed "${room.currentWord}" correctly and earned ${score} points! (${timeLeftSeconds}s remaining)`
  });
  
  // Update drawer's score (drawer gets points for each correct guess)
  const drawer = room.players.find(p => p.sid === room.currentDrawerSid);
  if (drawer) {
    const drawerBonus = Math.floor(score * 0.3); // Drawer gets 30% of guesser's points
    drawer.score += drawerBonus;
    drawer.totalScore += drawerBonus;
    
    io.to(drawer.sid).emit("drawer_bonus", {
      player: player.username,
      bonus: drawerBonus,
      totalScore: drawer.score
    });
  }
  
  // Check if all players have guessed (except drawer)
  const playersLeftToGuess = room.players.filter(p => 
    p.sid !== room.currentDrawerSid && 
    !room.guessedPlayers.find(gp => gp.sid === p.sid)
  );
  
  if (playersLeftToGuess.length === 0) {
    // All players guessed correctly
    room.roundActive = false;
    await room.save();
    
    io.to(room.roomCode).emit("system_message", {
      text: `✨ All players guessed the word correctly! Round ending...`
    });
    
    setTimeout(() => endRound(room.roomCode, true), 2000);
  } else {
    await room.save();
  }
}

async function endRound(roomCode, successful) {
  const room = await Room.findOne({ roomCode });
  if (!room || !room.roundActive) return;

  room.roundActive = false;
  
  // Award drawer for successful drawing (if at least one player guessed)
  if (successful && room.guessedPlayers.length > 0) {
    const drawer = room.players.find(p => p.sid === room.currentDrawerSid);
    if (drawer) {
      const drawingBonus = 50 + (room.guessedPlayers.length * 10);
      drawer.score += drawingBonus;
      drawer.totalScore += drawingBonus;
      
      io.to(room.roomCode).emit("system_message", {
        text: `🎨 ${drawer.username} earned ${drawingBonus} bonus points for the drawing!`
      });
    }
  }
  
  // Reset streaks for players who didn't guess
  room.players.forEach(player => {
    if (!room.guessedPlayers.find(gp => gp.sid === player.sid) && player.sid !== room.currentDrawerSid) {
      player.streak = 0;
    }
  });

  // Send round end summary
  io.to(roomCode).emit("round_end", {
    word: room.currentWord,
    players: room.players,
    guessedPlayers: room.guessedPlayers,
    drawer: room.players.find(p => p.sid === room.currentDrawerSid)?.username,
    successful: successful,
    correctCount: room.guessedPlayers.length
  });

  // Move to next drawer
  room.currentDrawerIndex = (room.currentDrawerIndex + 1) % room.players.length;

  // Check if we've completed all rounds
  if (room.currentDrawerIndex === 0) {
    room.currentRound++;
  }

  if (room.currentRound > room.maxRounds) {
    // Game over - calculate final scores with bonuses
    const finalPlayers = room.players.map(player => {
      // Add accuracy bonus
      const accuracy = player.correctGuesses / (room.maxRounds * (room.players.length - 1));
      const accuracyBonus = Math.floor(accuracy * 100);
      player.score += accuracyBonus;
      
      // Add streak bonus
      const streakBonus = Math.min((player.streak || 0) * 20, 200);
      player.score += streakBonus;
      
      return player;
    });
    
    // Sort by final score
    finalPlayers.sort((a, b) => b.score - a.score);
    
    io.to(roomCode).emit("game_end", {
      players: finalPlayers,
      totalRounds: room.maxRounds
    });

    room.gameStarted = false;
    room.currentRound = 1;
    room.currentDrawerIndex = 0;
    room.players.forEach(p => {
      p.score = 0;
      p.streak = 0;
      p.correctGuesses = 0;
      p.totalScore = 0;
    });
    await room.save();
    return;
  }

  await room.save();
  
  // Start next round after delay
  setTimeout(() => startNewRound(roomCode), 3000);
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
      players: [{ 
        sid: socket.id, 
        username, 
        isHost: true,
        score: 0,
        streak: 0,
        correctGuesses: 0,
        totalScore: 0
      }],
      gameStarted: false,
      currentRound: 1,
      maxRounds: 3
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

    room.players.push({ 
      sid: socket.id, 
      username,
      score: 0,
      streak: 0,
      correctGuesses: 0,
      totalScore: 0
    });
    await room.save();

    socket.join(room_code);
    io.to(room_code).emit("room_joined", { players: room.players });
  });

  socket.on("start_game", async ({ room_code }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room) return;

    room.gameStarted = true;
    room.maxRounds = Math.min(Math.max(room.players.length, 3), 5); // 3-5 rounds based on players
    await room.save();

    io.to(room_code).emit("game_started", {
      maxRounds: room.maxRounds,
      players: room.players
    });
    startNewRound(room_code);
  });

  socket.on("draw_stroke", async ({ room_code, ...stroke }) => {
    socket.to(room_code).emit("stroke_drawn", stroke);
  });

  socket.on("send_guess", async ({ room_code, guess }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || !room.roundActive) return;

    const player = room.players.find(p => p.sid === socket.id);
    if (!player) return;

    // Check if already guessed
    if (room.guessedPlayers.find(gp => gp.sid === socket.id)) {
      socket.emit("already_guessed", {
        message: "You've already guessed correctly this round!"
      });
      return;
    }

    // Check if guess is correct
    if (guess.toLowerCase() === room.currentWord.toLowerCase()) {
      await handleCorrectGuess(room, player, socket);
      return;
    }

    // Incorrect guess - send to chat
    io.to(room_code).emit("chat_message", {
      username: player.username,
      message: guess,
      type: "guess"
    });

    // Send feedback to player
    socket.emit("guess_feedback", {
      correct: false,
      hint: getHint(room.currentWord, guess)
    });
  });

  // Like drawing feature
  socket.on("like_drawing", async ({ room_code }) => {
    const room = await Room.findOne({ roomCode: room_code });
    if (!room || !room.roundActive) return;

    const drawer = room.players.find(p => p.sid === room.currentDrawerSid);
    if (drawer) {
      drawer.likes = (drawer.likes || 0) + 1;
      await room.save();
      
      io.to(drawer.sid).emit("drawing_liked", {
        likes: drawer.likes
      });
    }
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

// Helper function to provide hints
function getHint(correctWord, guess) {
  let hint = "";
  const minLength = Math.min(correctWord.length, guess.length);
  
  for (let i = 0; i < minLength; i++) {
    if (correctWord[i].toLowerCase() === guess[i].toLowerCase()) {
      hint += "🟩"; // Correct letter in correct position
    } else if (correctWord.toLowerCase().includes(guess[i].toLowerCase())) {
      hint += "🟨"; // Correct letter in wrong position
    } else {
      hint += "⬛"; // Letter not in word
    }
  }
  
  return hint;
}

const PORT = process.env.PORT || 8001;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on ${PORT}`)
);