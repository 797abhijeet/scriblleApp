const mongoose = require('mongoose')

const StrokeSchema = new mongoose.Schema({
  points: [{ x: Number, y: Number }],
  color: String,
  width: Number,
})

const PlayerSchema = new mongoose.Schema({
  sid: String,
  username: String,
  score: { type: Number, default: 0 },
  isHost: Boolean,
})

const RoomSchema = new mongoose.Schema({
  roomCode: { type: String, unique: true },
  players: [PlayerSchema],

  gameStarted: Boolean,
  currentRound: Number,
  maxRounds: { type: Number, default: 3 },

  currentDrawerIndex: Number,
  currentDrawerSid: String,
  currentWord: String,

  strokes: [StrokeSchema],        
  undoneStrokes: [StrokeSchema], 

}, { timestamps: true })

module.exports = mongoose.model('Room', RoomSchema)
