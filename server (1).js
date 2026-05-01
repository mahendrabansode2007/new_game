// server.js
// IQ Test Based Game Recommendation System — Express Backend
// Run: node server.js
// Then open: http://localhost:3000

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
// Serve all files inside /public as static assets (HTML, CSS, JS)
app.use(express.static("public"));

// Parse incoming JSON request bodies
app.use(express.json());

// ─── MongoDB Connection ────────────────────────────────────────────────────────
const MONGO_URI = "mongodb://127.0.0.1:27017/iqgame";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅  MongoDB connected → mongodb://127.0.0.1:27017/iqgame");
  })
  .catch((err) => {
    console.error("❌  MongoDB connection failed:", err.message);
    console.error("    Make sure mongod is running on port 27017");
  });

// ─── Game Model ────────────────────────────────────────────────────────────────
const Game = require("./models/Game");

// ─── Seed Data ─────────────────────────────────────────────────────────────────
// Five pre-defined games inserted by GET /add-games
const GAMES_SEED = [
  {
    name: "Memory Match",
    type: "memory",
    description: "Flip cards and find all matching pairs before time runs out!",
    difficulty: "easy",
  },
  {
    name: "Reaction Blitz",
    type: "reaction",
    description: "Click the pad the instant it turns green. How fast are you?",
    difficulty: "medium",
  },
  {
    name: "Number Slide",
    type: "puzzle",
    description: "Slide the tiles into order — classic 15-puzzle challenge.",
    difficulty: "hard",
  },
  {
    name: "Emoji Pairs",
    type: "memory",
    description: "Match emoji pairs as fast as possible. Memory at its finest.",
    difficulty: "medium",
  },
  {
    name: "Lightning Tap",
    type: "reaction",
    description: "The color changes — you tap. Measure your reflex speed.",
    difficulty: "easy",
  },
];

// ─── API: Seed Games ───────────────────────────────────────────────────────────
// GET /add-games
// Call this once after starting the server to populate MongoDB.
// Safe to call multiple times — checks count before inserting.
app.get("/add-games", async (req, res) => {
  try {
    const existing = await Game.countDocuments();

    if (existing >= GAMES_SEED.length) {
      return res.json({
        success: true,
        message: `Database already has ${existing} games. No changes made.`,
        count: existing,
      });
    }

    // Wipe and re-seed for a clean state
    await Game.deleteMany({});
    const inserted = await Game.insertMany(GAMES_SEED);

    console.log(`✅  Seeded ${inserted.length} games into MongoDB`);

    res.json({
      success: true,
      message: `${inserted.length} games added to database!`,
      games: inserted.map((g) => ({ name: g.name, type: g.type })),
    });
  } catch (err) {
    console.error("❌  Error seeding games:", err.message);
    res.status(500).json({ success: false, error: "Failed to seed games." });
  }
});

// ─── API: Get Game for User ────────────────────────────────────────────────────
// POST /get-game
// Body: { userId: String }
//
// Logic:
//   1. Find a game this user has NOT played (userId not in usedBy[])
//   2. Prefer a globally fresh game (isUsed = false)
//   3. If found → add userId to usedBy, mark isUsed = true, return game
//   4. If none found → 404 with message
app.post("/get-game", async (req, res) => {
  try {
    const { userId } = req.body;

    // Validate userId
    if (!userId || typeof userId !== "string" || userId.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "A valid userId string is required in the request body.",
      });
    }

    const cleanId = userId.trim();

    // Step 1: Try globally unused game this user hasn't played
    let game = await Game.findOne({
      usedBy: { $nin: [cleanId] },
      isUsed: false,
    });

    // Step 2: Fall back to any game this user hasn't played
    if (!game) {
      game = await Game.findOne({ usedBy: { $nin: [cleanId] } });
    }

    // Step 3: No games left for this user
    if (!game) {
      return res.status(404).json({
        success: false,
        message:
          "You have played all available games! Check back later for new ones.",
      });
    }

    // Step 4: Mark game as used and save
    game.usedBy.push(cleanId);
    game.isUsed = true;
    await game.save();

    console.log(`✅  Game "${game.name}" assigned to user: ${cleanId}`);

    res.json({
      success: true,
      game: {
        id: game._id,
        name: game.name,
        type: game.type,
        description: game.description,
        difficulty: game.difficulty,
      },
    });
  } catch (err) {
    console.error("❌  Error in /get-game:", err.message);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

// ─── Health Check ──────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    uptime: Math.floor(process.uptime()) + "s",
  });
});

// ─── Catch-all: serve index.html for any unknown GET route ────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(3000, () => {
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("🚀  Server running at   http://localhost:3000");
  console.log("📦  Seed games at       http://localhost:3000/add-games");
  console.log("❤️   Health check at    http://localhost:3000/health");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
});
