const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  sid: String,
  username: String,
  score: { type: Number, default: 0 },
  isHost: Boolean
});

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true },
  players: [PlayerSchema],
  maxPlayers: { type: Number, default: 8 },

  gameStarted: { type: Boolean, default: false },
  currentRound: { type: Number, default: 0 },
  maxRounds: { type: Number, default: 3 },

  currentDrawerIndex: { type: Number, default: 0 },
  currentDrawerSid: String,
  currentWord: String,

  strokes: { type: Array, default: [] },
  guessedPlayers: { type: Array, default: [] },
  roundStartTime: Number
}, { timestamps: true });

module.exports = mongoose.model('Room', RoomSchema);
