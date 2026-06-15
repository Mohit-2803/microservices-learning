// ============================================================================
//  auth-svc  —  Milestone 3
//  Now backed by its OWN Postgres database (auth-db). The users live in a real
//  `users` table that only THIS service may touch.
// ============================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 3000;
const NAME = 'auth-svc';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// A connection POOL to this service's own database. The address comes from
// DATABASE_URL (set in docker-compose.yml) and points at the auth-db container.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- Schema + seed ---------------------------------------------------------
// A service OWNS its schema: it creates and migrates its own tables. We retry
// because the database may still be booting when this service starts.
async function initDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id       SERIAL PRIMARY KEY,
          email    TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,   -- plaintext for the DEMO only; real apps hash (bcrypt)
          name     TEXT NOT NULL
        );
      `);
      await pool.query(
        `INSERT INTO users (email, password, name)
         VALUES ($1, $2, $3)
         ON CONFLICT (email) DO NOTHING`,
        ['demo@shop.test', 'password123', 'Demo User']
      );
      console.log(`[${NAME}] database ready`);
      return;
    } catch (err) {
      if (attempt >= 15) throw err;
      console.log(`[${NAME}] waiting for database... (attempt ${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ---- POST /login : look the user up IN THE DATABASE now --------------------
app.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { rows } = await pool.query(
    'SELECT id, email, name FROM users WHERE email = $1 AND password = $2',
    [email, password]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid email or password' });

  const token = jwt.sign(
    { sub: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
  res.json({ token, user });
});

// ---- GET /me : verify a token ----------------------------------------------
app.get('/me', (req, res) => {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    res.json({ valid: true, payload: jwt.verify(token, JWT_SECRET) });
  } catch {
    res.status(401).json({ valid: false, error: 'invalid or expired token' });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: NAME }));

// Start ONLY after the database schema is ready.
initDb()
  .then(() => app.listen(PORT, () => console.log(`[${NAME}] listening on port ${PORT}`)))
  .catch((err) => {
    console.error(`[${NAME}] could not initialise database:`, err.message);
    process.exit(1);
  });
