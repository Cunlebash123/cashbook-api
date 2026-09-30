const express = require("express");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        install_id TEXT PRIMARY KEY,
        first_seen BIGINT NOT NULL,
        last_seen BIGINT NOT NULL,
        first_day TEXT NOT NULL,
        version TEXT
      )
    `);
    console.log("DB ready");
  } catch (e) {
    console.error("DB init error:", e.message);
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

app.post("/api/users/ping", async (req, res) => {
  const { installId, version } = req.body || {};
  if (!installId) return res.status(400).json({ ok: false, error: "no installId" });

  const now = Date.now();
  const today = todayKey();

  try {
    await pool.query(
      `INSERT INTO users (install_id, first_seen, last_seen, first_day, version)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (install_id) DO UPDATE
       SET last_seen = $3, version = COALESCE($5, users.version)`,
      [installId, now, now, today, version || ""]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error("ping error:", e.message);
    res.status(500).json({ ok: false });
  }
});

app.get("/api/users/stats", async (req, res) => {
  const now = Date.now();
  const today = todayKey();
  const DAY = 24 * 60 * 60 * 1000;

  try {
    const totalR = await pool.query("SELECT COUNT(*)::int AS c FROM users");
    const activeR = await pool.query(
      "SELECT COUNT(*)::int AS c FROM users WHERE last_seen > $1",
      [now - DAY]
    );
    const newR = await pool.query(
      "SELECT COUNT(*)::int AS c FROM users WHERE first_day = $1",
      [today]
    );

    res.json({
      total: totalR.rows[0].c,
      active: activeR.rows[0].c,
      newToday: newR.rows[0].c
    });
  } catch (e) {
    console.error("stats error:", e.message);
    res.status(500).json({ total: 0, active: 0, newToday: 0 });
  }
});

app.get("/", (req, res) => res.send("CashBook API running"));

const PORT = process.env.PORT || 3000;
initDB().then(() => {
  app.listen(PORT, () => console.log("CashBook API on port " + PORT));
});
