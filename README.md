# new_game
iqgame/
├── server.js              ← Express server, MongoDB, APIs
├── package.json           ← Dependencies
├── models/
│   └── Game.js            ← Mongoose schema
└── public/                ← Served statically by Express
    ├── index.html         ← SPA shell (5 screens)
    ├── style.css          ← Editorial dark theme (Bebas Neue + Outfit)
    └── script.js          ← Quiz engine + 3 games + fetch API
