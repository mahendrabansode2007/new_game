/* ═══════════════════════════════════════════════════════════════════════════
   script.js — BrainForge IQ Test + Game Recommendation System
   Sections:
     1.  App State & Constants
     2.  Utility helpers
     3.  Screen management
     4.  Quiz engine
     5.  Score / Result screen
     6.  Backend API call (POST /get-game)
     7.  Game dispatcher
     8.  Game 1 — Memory Match
     9.  Game 2 — Reaction Speed
     10. Game 3 — Number Slide (15-puzzle)
     11. Initialisation (auto-seed + DOMContentLoaded)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────────────────────────────────
   1. APP STATE & CONSTANTS
   ───────────────────────────────────────────────────────────────────────────── */

// Persistent unique user ID stored in localStorage
const USER_ID = (() => {
  let id = localStorage.getItem("bf_uid");
  if (!id) {
    id = "u_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
    localStorage.setItem("bf_uid", id);
  }
  return id;
})();

// Global quiz state
const QS = {
  username:    "",
  current:     0,      // current question index
  score:       0,
  selected:    null,   // index of chosen option (null = none yet)
  timer:       null,   // setInterval reference
  secondsLeft: 30,
};

/* ─────────────────────────────────────────────────────────────────────────────
   2. IQ QUESTIONS  (5 MCQs)
   ───────────────────────────────────────────────────────────────────────────── */
const QUESTIONS = [
  {
    text:    "What comes next in the series?\n2  →  6  →  12  →  20  →  30  →  ?",
    opts:    ["38", "40", "42", "44"],
    answer:  2,   // index 2 = "42"
  },
  {
    text:    "All Bloops are Razzles. All Razzles are Lazzles.\nTherefore, all Bloops are definitely…",
    opts:    ["Razzles only", "Lazzles", "Neither Razzles nor Lazzles", "Cannot be determined"],
    answer:  1,
  },
  {
    text:    "A train travels 120 km in 1.5 hours at a constant speed.\nHow far does it travel in 2.5 hours?",
    opts:    ["160 km", "180 km", "200 km", "220 km"],
    answer:  2,
  },
  {
    text:    "Which shape is the odd one out?\n△  ○  □  ◇  ▭",
    opts:    ["Triangle △", "Circle ○", "Rectangle ▭", "Diamond ◇"],
    answer:  1,  // Circle — only one with no straight edges
  },
  {
    text:    "Unscramble the letters: C I F A I P C\nThis is the name of a…",
    opts:    ["Country", "Animal", "Ocean", "City"],
    answer:  2,  // PACIFIC
  },
];

const KEYS = ["A", "B", "C", "D"];

/* ─────────────────────────────────────────────────────────────────────────────
   2. UTILITY HELPERS
   ───────────────────────────────────────────────────────────────────────────── */

/** Show a toast notification */
function toast(msg, duration = 3000) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), duration);
}

/** Fisher-Yates shuffle in-place */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ─────────────────────────────────────────────────────────────────────────────
   3. SCREEN MANAGEMENT
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Show exactly one screen, hide all others.
 * Triggers CSS fadeIn animation by removing and re-adding the class.
 */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => {
    s.classList.remove("active");
    s.style.display = "none";
  });
  const target = document.getElementById(id);
  target.style.display = "flex";
  // Force reflow to restart animation
  void target.offsetWidth;
  target.classList.add("active");
}

/** Return to welcome screen and reset quiz state */
function goHome() {
  clearInterval(QS.timer);
  QS.current = 0;
  QS.score = 0;
  QS.selected = null;
  showScreen("screenWelcome");
}

/* ─────────────────────────────────────────────────────────────────────────────
   4. QUIZ ENGINE
   ───────────────────────────────────────────────────────────────────────────── */

/** Called by "Begin Test" button click */
function startQuiz() {
  const name = document.getElementById("nameInput").value.trim();
  if (!name) {
    toast("⚠️  Please enter your name first!");
    document.getElementById("nameInput").focus();
    return;
  }

  // Store name and show player chip in header
  QS.username = name;
  QS.current  = 0;
  QS.score    = 0;
  document.getElementById("chipName").textContent = name;
  document.getElementById("playerChip").style.display = "flex";

  showScreen("screenQuiz");
  renderQuestion();
}

/** Render the current question */
function renderQuestion() {
  const q     = QUESTIONS[QS.current];
  const total = QUESTIONS.length;

  // Update top bar
  document.getElementById("qCounter").textContent = `${QS.current + 1} / ${total}`;
  document.getElementById("qTag").textContent      = `Q${QS.current + 1}`;
  document.getElementById("qText").textContent     = q.text;

  // Render option buttons
  const list = document.getElementById("optionsList");
  list.innerHTML = "";
  q.opts.forEach((text, i) => {
    const btn = document.createElement("button");
    btn.className = "opt-btn";
    btn.innerHTML = `<span class="opt-key">${KEYS[i]}</span>${text}`;
    btn.addEventListener("click", () => selectOption(i, btn));
    list.appendChild(btn);
  });

  // Disable Next button until an option is selected
  const btnNext = document.getElementById("btnNext");
  btnNext.disabled = true;
  btnNext.textContent = QS.current === total - 1 ? "Submit Quiz ✓" : "Next →";

  QS.selected = null;
  startTimer();
}

/** Start the 30-second countdown */
function startTimer() {
  clearInterval(QS.timer);
  QS.secondsLeft = 30;
  updateTimerUI(30);

  QS.timer = setInterval(() => {
    QS.secondsLeft--;
    updateTimerUI(QS.secondsLeft);

    if (QS.secondsLeft <= 0) {
      clearInterval(QS.timer);
      onTimeout();
    }
  }, 1000);
}

/** Update timer bar width and number */
function updateTimerUI(sec) {
  const bar = document.getElementById("timerBar");
  const num = document.getElementById("timerNum");
  bar.style.width = (sec / 30 * 100) + "%";
  num.textContent = sec;
  // Turn red when under 10 seconds
  if (sec <= 10) {
    bar.classList.add("urgent");
  } else {
    bar.classList.remove("urgent");
  }
}

/** Auto-advance on timeout (counts as wrong) */
function onTimeout() {
  const q    = QUESTIONS[QS.current];
  const btns = document.querySelectorAll(".opt-btn");
  btns.forEach((b, i) => {
    b.disabled = true;
    if (i === q.answer) b.classList.add("correct");
  });
  document.getElementById("btnNext").disabled = false;
  setTimeout(nextQuestion, 1400);
}

/** User clicked an option */
function selectOption(index, clickedBtn) {
  if (QS.selected !== null) return;  // already answered
  clearInterval(QS.timer);
  QS.selected = index;

  const q    = QUESTIONS[QS.current];
  const btns = document.querySelectorAll(".opt-btn");
  btns.forEach((b) => (b.disabled = true));

  if (index === q.answer) {
    clickedBtn.classList.add("correct");
    QS.score++;
  } else {
    clickedBtn.classList.add("wrong");
    btns[q.answer].classList.add("correct");
  }

  document.getElementById("btnNext").disabled = false;
}

/** Move to next question or show results */
function nextQuestion() {
  clearInterval(QS.timer);
  QS.current++;
  if (QS.current >= QUESTIONS.length) {
    showResult();
  } else {
    renderQuestion();
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   5. SCORE / RESULT SCREEN
   ───────────────────────────────────────────────────────────────────────────── */

/** Map score to IQ range label and message */
function getIQData(score) {
  if (score === 5) return { label: "Genius — IQ 130+",       msg: "A perfect score! You are in the top 2% globally." };
  if (score === 4) return { label: "Superior — IQ 115–129",  msg: "Excellent reasoning and sharp logical thinking." };
  if (score === 3) return { label: "Above Average — IQ 105–114", msg: "Solid performance. Strong analytical ability." };
  if (score === 2) return { label: "Average — IQ 90–104",    msg: "Good effort! Keep sharpening your brain daily." };
  if (score === 1) return { label: "Below Average — IQ 80–89", msg: "Don't give up — practice makes perfect." };
  return           { label: "Low Range — IQ < 80",           msg: "Try again! Every attempt makes you stronger." };
}

/** Animate the score ring SVG */
function animateRing(score, total) {
  const circumference = 264; // 2 * π * 42
  const offset = circumference * (1 - score / total);
  setTimeout(() => {
    document.getElementById("scoreRing").style.strokeDashoffset = offset;
  }, 80);
}

/** Transition to result screen */
function showResult() {
  const { label, msg } = getIQData(QS.score);

  document.getElementById("scoreNum").textContent    = QS.score;
  document.getElementById("resultHeading").textContent =
    QS.score >= 4 ? `Well done, ${QS.username}! 🏆` :
    QS.score >= 2 ? `Good try, ${QS.username}!`     :
                    `Keep going, ${QS.username}!`;
  document.getElementById("resultSub").textContent   = msg;
  document.getElementById("iqLabel").textContent     = label;

  showScreen("screenResult");
  animateRing(QS.score, QUESTIONS.length);
}

/* ─────────────────────────────────────────────────────────────────────────────
   6. BACKEND API — POST /get-game
   ───────────────────────────────────────────────────────────────────────────── */

/** Fetch a unique game from the backend for this user */
async function getGame() {
  showScreen("screenLoading");

  try {
    // NOTE: URL is relative — works on any host/port without modification
    const res  = await fetch("/get-game", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId: USER_ID }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Server returned an error (e.g. no games left)
      showScreen("screenResult");
      toast("🎮 " + (data.message || data.error || "Could not fetch game."));
      return;
    }

    if (!data.success) {
      showScreen("screenResult");
      toast("⚠️  " + (data.message || "No games available right now."));
      return;
    }

    // Load the game!
    loadGame(data.game);

  } catch (err) {
    console.error("Fetch error:", err);
    showScreen("screenResult");
    toast("❌  Cannot reach server. Is it running on localhost:3000?");
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   7. GAME DISPATCHER
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Takes the game object from the API and renders the correct game.
 * @param {Object} game  { id, name, type, description, difficulty }
 */
function loadGame(game) {
  // Update arena header
  document.getElementById("arenaTag").textContent   = game.type;
  document.getElementById("arenaTitle").textContent = game.name;
  document.getElementById("arenaDesc").textContent  = game.description;

  // Hide all game boxes
  document.getElementById("gameMemory").style.display   = "none";
  document.getElementById("gameReaction").style.display = "none";
  document.getElementById("gamePuzzle").style.display   = "none";

  // Show and initialise the correct game
  switch (game.type) {
    case "memory":
      document.getElementById("gameMemory").style.display = "block";
      initMemory();
      break;
    case "reaction":
      document.getElementById("gameReaction").style.display = "block";
      initReaction();
      break;
    case "puzzle":
      document.getElementById("gamePuzzle").style.display = "block";
      initPuzzle();
      break;
    default:
      // Fallback to memory if type is unrecognised
      document.getElementById("gameMemory").style.display = "block";
      initMemory();
  }

  showScreen("screenGame");
}

/* ─────────────────────────────────────────────────────────────────────────────
   8. GAME 1 — MEMORY MATCH
   ───────────────────────────────────────────────────────────────────────────── */

const MEM_EMOJIS = ["🧠","⚡","🎯","💡","🔥","🌊","🎲","🦋"];

let mem = {
  flipped:  [],     // up to 2 cards currently face-up (not yet matched)
  matched:  0,      // number of matched pairs
  flips:    0,      // total flip count
  locked:   false,  // prevent clicks during mismatch animation
  interval: null,   // timer
  elapsed:  0,      // seconds
};

function initMemory() {
  clearInterval(mem.interval);
  mem = { flipped: [], matched: 0, flips: 0, locked: false, interval: null, elapsed: 0 };

  document.getElementById("memFlips").textContent = "0";
  document.getElementById("memPairs").textContent = "0";
  document.getElementById("memTimer").textContent = "0s";

  // Build deck: 8 emojis × 2 = 16 cards, shuffled
  const deck = shuffle([...MEM_EMOJIS, ...MEM_EMOJIS]);
  const grid = document.getElementById("memGrid");
  grid.innerHTML = "";

  deck.forEach((emoji, idx) => {
    const card = document.createElement("div");
    card.className  = "mem-card";
    card.dataset.emoji = emoji;
    card.innerHTML  = `
      <div class="mem-inner">
        <div class="mem-front"></div>
        <div class="mem-back">${emoji}</div>
      </div>`;
    card.addEventListener("click", () => memFlip(card));
    grid.appendChild(card);
  });

  // Start elapsed timer
  mem.interval = setInterval(() => {
    mem.elapsed++;
    document.getElementById("memTimer").textContent = mem.elapsed + "s";
  }, 1000);
}

function memFlip(card) {
  if (
    mem.locked ||
    card.classList.contains("flipped") ||
    card.classList.contains("matched")
  ) return;

  card.classList.add("flipped");
  mem.flipped.push(card);
  mem.flips++;
  document.getElementById("memFlips").textContent = mem.flips;

  if (mem.flipped.length === 2) {
    mem.locked = true;
    checkMemMatch();
  }
}

function checkMemMatch() {
  const [a, b] = mem.flipped;
  if (a.dataset.emoji === b.dataset.emoji) {
    // Match!
    a.classList.add("matched");
    b.classList.add("matched");
    mem.matched++;
    document.getElementById("memPairs").textContent = mem.matched;
    mem.flipped = [];
    mem.locked  = false;

    if (mem.matched === MEM_EMOJIS.length) {
      clearInterval(mem.interval);
      setTimeout(() => toast(`🎉 Solved in ${mem.flips} flips & ${mem.elapsed}s!`), 300);
    }
  } else {
    // No match — flip back after delay
    setTimeout(() => {
      a.classList.remove("flipped");
      b.classList.remove("flipped");
      mem.flipped = [];
      mem.locked  = false;
    }, 900);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   9. GAME 2 — REACTION SPEED
   ───────────────────────────────────────────────────────────────────────────── */

let rx = {
  phase:     "idle",    // idle | waiting | ready | go
  startTime: 0,
  best:      Infinity,
  rounds:    0,
  timeout:   null,
};

function initReaction() {
  rxReset();
}

function rxReset() {
  clearTimeout(rx.timeout);
  rx = { phase: "idle", startTime: 0, best: Infinity, rounds: 0, timeout: null };
  setRxPad("idle", "Click to Start");
  document.getElementById("rxLast").textContent   = "—";
  document.getElementById("rxBest").textContent   = "—";
  document.getElementById("rxRounds").textContent = "0";
}

/** Update the reaction pad visual state */
function setRxPad(phase, text) {
  const pad = document.getElementById("rxPad");
  pad.className = "rx-pad " + phase;
  document.getElementById("rxLabel").textContent = text;
}

/** Handle click on the reaction pad */
function rxClick() {
  switch (rx.phase) {

    case "idle":
      // Begin a new round: wait a random 1.5–5s before going green
      rx.phase = "waiting";
      setRxPad("waiting", "Wait…");
      rx.timeout = setTimeout(() => {
        // Brief "ready" state
        rx.phase = "ready";
        setRxPad("ready", "Get ready…");
        rx.timeout = setTimeout(() => {
          // GO!
          rx.phase     = "go";
          rx.startTime = Date.now();
          setRxPad("go", "CLICK NOW! ⚡");
        }, 400);
      }, 1500 + Math.random() * 3500);
      break;

    case "waiting":
    case "ready":
      // Clicked too early
      clearTimeout(rx.timeout);
      rx.phase = "early";
      setRxPad("early", "Too early! Click to retry");
      rx.timeout = setTimeout(() => {
        rx.phase = "idle";
        setRxPad("idle", "Click to Start");
      }, 1500);
      break;

    case "go":
      // Measure reaction time
      const ms = Date.now() - rx.startTime;
      rx.rounds++;
      if (ms < rx.best) rx.best = ms;

      document.getElementById("rxLast").textContent   = ms + " ms";
      document.getElementById("rxBest").textContent   = rx.best + " ms";
      document.getElementById("rxRounds").textContent = rx.rounds;

      rx.phase = "idle";
      setRxPad("idle", ms + " ms · Click to go again");
      break;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   10. GAME 3 — NUMBER SLIDE (15-PUZZLE)
   ───────────────────────────────────────────────────────────────────────────── */

const PZ_SIZE = 4;  // 4×4 grid

let pz = {
  tiles:   [],    // 1D array, length 16; value 0 = empty cell
  empty:   15,    // index of empty cell
  moves:   0,
  solved:  false,
};

/** Solved state: [1,2,3,…,15,0] */
function pzSolved() {
  return [...Array(15).keys()].map((n) => n + 1).concat([0]);
}

function initPuzzle() {
  pz.tiles  = pzSolved();
  pz.empty  = 15;
  pz.moves  = 0;
  pz.solved = false;

  document.getElementById("pzMoves").textContent  = "0";
  document.getElementById("pzStatus").textContent = "Arrange tiles 1→15. Blank = empty cell.";

  // Randomise by doing 300 legal moves from solved state
  // (guarantees the puzzle is solvable)
  for (let i = 0; i < 300; i++) {
    const nbrs = pzNeighbors(pz.empty);
    const pick = nbrs[Math.floor(Math.random() * nbrs.length)];
    pzSwap(pz.empty, pick);
  }

  renderPuzzle();
}

/** Return indices adjacent (up/down/left/right) to idx */
function pzNeighbors(idx) {
  const r = Math.floor(idx / PZ_SIZE);
  const c = idx % PZ_SIZE;
  const n = [];
  if (r > 0)              n.push(idx - PZ_SIZE);
  if (r < PZ_SIZE - 1)   n.push(idx + PZ_SIZE);
  if (c > 0)              n.push(idx - 1);
  if (c < PZ_SIZE - 1)   n.push(idx + 1);
  return n;
}

/** Swap tiles[a] and tiles[b] */
function pzSwap(a, b) {
  [pz.tiles[a], pz.tiles[b]] = [pz.tiles[b], pz.tiles[a]];
  pz.empty = pz.tiles[a] === 0 ? a : b;
}

/** Click handler for a tile */
function pzClickTile(idx) {
  if (pz.solved) return;
  if (pz.tiles[idx] === 0) return;              // clicked the empty cell
  if (!pzNeighbors(idx).includes(pz.empty)) return; // not adjacent

  pzSwap(idx, pz.empty);
  pz.moves++;
  document.getElementById("pzMoves").textContent = pz.moves;
  renderPuzzle();
  checkPuzzleSolved();
}

/** Re-render the puzzle grid */
function renderPuzzle() {
  const grid   = document.getElementById("pzGrid");
  const solved = pzSolved();
  grid.innerHTML = "";

  pz.tiles.forEach((val, idx) => {
    const tile = document.createElement("div");
    tile.className = "pz-tile";

    if (val === 0) {
      tile.classList.add("pz-empty");
    } else {
      tile.textContent = val;
      if (val === solved[idx]) tile.classList.add("pz-correct");
      tile.addEventListener("click", () => pzClickTile(idx));
    }

    grid.appendChild(tile);
  });
}

/** Check if the puzzle matches the solved state */
function checkPuzzleSolved() {
  const solved = pzSolved();
  if (pz.tiles.every((v, i) => v === solved[i])) {
    pz.solved = true;
    document.getElementById("pzStatus").textContent =
      `🎉 Solved in ${pz.moves} moves!`;
    toast(`🧩 Puzzle complete! ${pz.moves} moves.`);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   11. INITIALISATION
   ───────────────────────────────────────────────────────────────────────────── */

window.addEventListener("DOMContentLoaded", async () => {

  // Auto-seed the database (safe — server checks for existing records)
  try {
    const res  = await fetch("/add-games");
    const data = await res.json();
    console.log("🌱 Seed result:", data.message);
  } catch (e) {
    console.warn("⚠️  Could not reach /add-games:", e.message);
  }

  // Show the welcome screen
  showScreen("screenWelcome");

  // Allow pressing Enter in name field to start quiz
  document.getElementById("nameInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") startQuiz();
  });

});
