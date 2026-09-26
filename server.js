const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json());

const DB_FILE = path.join(__dirname, "users.json");

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch (e) {
    return {};
  }
}

function saveDB(db) {
  try {
    var tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {}
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

app.post("/api/users/ping", (req, res) => {
  const { installId, version, reason, ts } = req.body || {};
  if (!installId) return res.status(400).json({ ok: false, error: "no installId" });

  const db = loadDB();
  const now = Date.now();
  const today = todayKey();

  if (!db[installId]) {
    db[installId] = { firstSeen: now, lastSeen: now, firstDay: today, version: version || "" };
  } else {
    db[installId].lastSeen = now;
    if (version) db[installId].version = version;
  }
  saveDB(db);
  res.json({ ok: true });
});

app.get("/api/users/stats", (req, res) => {
  const db = loadDB();
  const now = Date.now();
  const today = todayKey();
  const DAY = 24 * 60 * 60 * 1000;

  const ids = Object.keys(db);
  const total = ids.length;
  let active = 0;
  let newToday = 0;

  ids.forEach((id) => {
    const u = db[id];
    if (now - u.lastSeen < DAY) active++;
    if (u.firstDay === today) newToday++;
  });

  res.json({ total, active, newToday });
});

app.get("/", (req, res) => res.send("CashBook API running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("CashBook API on port " + PORT));
