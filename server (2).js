// server.js — BrainForge IQ Game System
// FIXED VERSION: Robust MongoDB connection + all common error causes resolved

const express  = require("express");
const mongoose = require("mongoose");
const path     = require("path");

const app  = express();
const PORT = 3000;

// ─── Middleware (ORDER MATTERS — must come before routes) ──────────────────
app.use(express.json());                          // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse form bodies
app.use(express.static(path.join(__dirname, "public"))); // serve frontend

// ─── MongoDB Connection ────────────────────────────────────────────────────
const MONGO_URI = "mongodb://127.0.0.1:27017/iqgame";

async function connectDB() {
  try {
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log("✅  MongoDB connected → " + MONGO_URI);
  } catch (err) {
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("❌  MongoDB connection FAILED");
    console.error("    Reason:", err.message);
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("    FIX: Run   mongod   in a separate terminal");
    console.error("    OR:  mongod --dbpath C:\\data\\db   (Windows)");
    console.error("    OR:  sudo mongod                   (Linux/Mac)");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    process.exit(1);
  }
}

mongoose.connection.on("disconnected", () => console.warn("⚠️  MongoDB disconnected."));
mongoose.connection.on("reconnected",  () => console.log("✅  MongoDB reconnected."));
mongoose.connection.on("error", (err) => console.error("❌  MongoDB error:", err.message));

// ─── Game Model (inline — no separate file needed) ─────────────────────────
const GameSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  type:        { type: String, required: true, enum: ["memory","reaction","puzzle"] },
  description: { type: String, default: "A fun brain game!" },
  difficulty:  { type: String, default: "medium" },
  usedBy:      { type: [String], default: [] },
  isUsed:      { type: Boolean, default: false },
}, { timestamps: true });

const Game = mongoose.model("Game", GameSchema);

// ─── Seed Data ─────────────────────────────────────────────────────────────
const SEED = [
  { name: "Memory Match",  type: "memory",   description: "Flip cards and match all pairs!",       difficulty: "easy"   },
  { name: "Reaction Blitz",type: "reaction", description: "Click when the pad turns green!",        difficulty: "medium" },
  { name: "Number Slide",  type: "puzzle",   description: "Slide tiles to arrange 1 through 15.",  difficulty: "hard"   },
  { name: "Emoji Pairs",   type: "memory",   description: "Match emoji pairs as fast as possible.", difficulty: "medium" },
  { name: "Lightning Tap", type: "reaction", description: "Measure your raw reflex speed in ms.",  difficulty: "easy"   },
];

// ─── GET /add-games ────────────────────────────────────────────────────────
app.get("/add-games", async (req, res) => {
  try {
    const count = await Game.countDocuments();
    if (count >= SEED.length) {
      return res.json({ success: true, message: `Already have ${count} games.`, count });
    }
    await Game.deleteMany({});
    const docs = await Game.insertMany(SEED);
    console.log("✅  Seeded", docs.length, "games");
    res.json({ success: true, message: docs.length + " games added!", games: docs.map(g => g.name) });
  } catch (err) {
    console.error("❌  /add-games error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /get-game ────────────────────────────────────────────────────────
app.post("/get-game", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ success: false, error: "userId is required." });
    }

    let game = await Game.findOne({ usedBy: { $nin: [userId] }, isUsed: false });
    if (!game) game = await Game.findOne({ usedBy: { $nin: [userId] } });

    if (!game) {
      return res.status(404).json({ success: false, message: "You have played all available games!" });
    }

    game.usedBy.push(userId);
    game.isUsed = true;
    await game.save();

    console.log("✅  Assigned \"" + game.name + "\" to " + userId);
    res.json({
      success: true,
      game: { id: game._id, name: game.name, type: game.type, description: game.description, difficulty: game.difficulty },
    });
  } catch (err) {
    console.error("❌  /get-game error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /health ───────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({ server: "running", mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected", port: PORT });
});

// ─── Catch-all → index.html ────────────────────────────────────────────────
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start server ONLY after DB connects ──────────────────────────────────
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("🚀  App:    http://localhost:" + PORT);
    console.log("📦  Seed:   http://localhost:" + PORT + "/add-games");
    console.log("❤️   Health: http://localhost:" + PORT + "/health");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  });
});
