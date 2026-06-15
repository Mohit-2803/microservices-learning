// ============================================================================
//  products-svc  —  Milestone 3
//  Now backed by its OWN Postgres database (products-db), completely separate
//  from auth-db. This service cannot see users; auth-svc cannot see products.
// ============================================================================

const express = require('express');
const os = require('os');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;
const NAME = 'products-svc';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---- Schema + seed ---------------------------------------------------------
async function initDb() {
  const seed = [
    ['Mechanical Keyboard', 89.99],
    ['Wireless Mouse', 39.50],
    ['USB-C Hub', 24.00],
    ['27" Monitor', 219.99],
  ];
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id    SERIAL PRIMARY KEY,
          name  TEXT NOT NULL,
          price NUMERIC(10,2) NOT NULL
        );
      `);
      // Seed only if the table is empty (so restarts don't duplicate rows).
      const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM products');
      if (rows[0].n === 0) {
        for (const [name, price] of seed) {
          await pool.query('INSERT INTO products (name, price) VALUES ($1, $2)', [name, price]);
        }
      }
      console.log(`[${NAME}] database ready`);
      return;
    } catch (err) {
      if (attempt >= 15) throw err;
      console.log(`[${NAME}] waiting for database... (attempt ${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ---- GET / : list products from the database -------------------------------
// price::float casts Postgres NUMERIC (which the driver returns as a string)
// back into a real JSON number.
app.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, price::float AS price FROM products ORDER BY id');
  res.json({ service: NAME, servedBy: os.hostname(), count: rows.length, products: rows });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: NAME }));

// ---- GET /:id : one product (defined AFTER /health on purpose) -------------
app.get('/:id', async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, name, price::float AS price FROM products WHERE id = $1',
    [Number(req.params.id)]
  );
  if (!rows[0]) return res.status(404).json({ error: 'product not found' });
  res.json(rows[0]);
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`[${NAME}] listening on port ${PORT}`)))
  .catch((err) => {
    console.error(`[${NAME}] could not initialise database:`, err.message);
    process.exit(1);
  });
