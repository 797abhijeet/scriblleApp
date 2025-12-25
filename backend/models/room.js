const mongoose = require("mongoose");

/* ==========================
   Player Schema
========================== */
const PlayerSchema = new mongoose.Schema({
  sid: { type: String, required: true },
  username: { type: String, required: true },
  score: { type: Number, default: 0 },
  isHost: { type: Boolean, default: false },
});

/* ==========================
   Room Schema
========================== */
const RoomSchema = new mongoose.Schema(
  {
    roomCode: { type: String, unique: true, required: true },

    players: [PlayerSchema],
    maxPlayers: { type: Number, default: 8 },

    /* ===== Game State ===== */
    gameStarted: { type: Boolean, default: false },

    currentRound: { type: Number, default: 0 },
    maxRounds: { type: Number, default: 3 },

    currentDrawerIndex: { type: Number, default: 0 },
    currentDrawerSid: { type: String, default: null },

    currentWord: { type: String, default: null },

    /* ===== Drawing ===== */
    strokes: { type: Array, default: [] },

    /* ===== Guessing Control ===== */
    guessedPlayers: { type: [String], default: [] },

    // 🔐 Prevents multiple winners per round
    roundActive: { type: Boolean, default: false },

    roundStartTime: { type: Number, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Room", RoomSchema);
