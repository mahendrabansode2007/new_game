// models/Game.js
// Mongoose schema for the Game collection

const mongoose = require("mongoose");

const GameSchema = new mongoose.Schema(
  {
    // Display name of the game
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // Game type — used by frontend to render the correct game engine
    // Allowed: "memory" | "reaction" | "puzzle"
    type: {
      type: String,
      required: true,
      enum: ["memory", "reaction", "puzzle"],
    },

    // Short description shown to user
    description: {
      type: String,
      default: "A fun brain-training mini game!",
    },

    // Difficulty tag (display only)
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    // List of userIds who have already been assigned this game
    usedBy: {
      type: [String],
      default: [],
    },

    // True once any user has been assigned this game (global uniqueness)
    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Game", GameSchema);
