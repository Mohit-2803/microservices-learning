// ============================================================================
//  orders-svc  —  Milestone 5+ (now AUTH-PROTECTED)
//  To place an order you must be logged in. This service VERIFIES the JWT
//  itself, statelessly, using the same JWT_SECRET that auth-svc signs with.
//  No network call to auth-svc needed — the signature is enough to trust it.
//
//  It still orchestrates the other services:
//     1. verify the caller's token  -> who is buying?
//     2. ask products-svc           -> price
//     3. ask payments-svc           -> charge
//     4. save the order (with buyer) in its own database
// ============================================================================

const express = require('express');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.use(express.json());

const PORT = 3000;
const NAME = 'orders-svc';

// SAME secret auth-svc uses to SIGN tokens. With it, we can VERIFY them.
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PRODUCTS_URL = process.env.PRODUCTS_URL || 'http://products-svc:3000';
const PAYMENTS_URL = process.env.PAYMENTS_URL || 'http://payments-svc:3000';

// Pull "Authorization: Bearer <token>" off the request and verify it.
// Returns the token payload (who the user is) or null if missing/invalid.
function getUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);   // throws if forged or expired
  } catch {
    return null;
  }
}

async function initDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id           SERIAL PRIMARY KEY,
          buyer_email  TEXT NOT NULL,
          product_id   INT NOT NULL,
          product_name TEXT NOT NULL,
          quantity     INT NOT NULL,
          total        NUMERIC(10,2) NOT NULL,
          txn_id       TEXT NOT NULL,
          status       TEXT NOT NULL,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      // If the table already existed from before (older volume), add the
      // new buyer_email column so we don't crash on insert.
      await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS buyer_email TEXT;`);
      console.log(`[${NAME}] database ready`);
      return;
    } catch (err) {
      if (attempt >= 15) throw err;
      console.log(`[${NAME}] waiting for database... (attempt ${attempt}): ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

// ---- POST / : place an order (LOGIN REQUIRED) ------------------------------
app.post('/', async (req, res) => {
  // STEP 0: who is calling? No valid token -> reject before doing anything.
  const buyer = getUser(req);
  if (!buyer) {
    return res.status(401).json({ error: 'you must be logged in to place an order' });
  }

  const { productId, quantity = 1 } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId is required' });

  // STEP 1: ask products-svc about the product
  let product;
  try {
    const r = await fetch(`${PRODUCTS_URL}/${productId}`);
    if (r.status === 404) return res.status(404).json({ error: 'product not found' });
    if (!r.ok) throw new Error(`products-svc responded ${r.status}`);
    product = await r.json();
  } catch (err) {
    return res.status(502).json({ error: 'could not reach products service', detail: err.message });
  }

  const total = Number((product.price * quantity).toFixed(2));

  // STEP 2: ask payments-svc to charge
  let payment;
  try {
    const r = await fetch(`${PAYMENTS_URL}/charge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: total, currency: 'USD', orderRef: `product-${productId}` }),
    });
    if (!r.ok) throw new Error(`payments-svc responded ${r.status}`);
    payment = await r.json();
  } catch (err) {
    return res.status(502).json({ error: 'could not reach payments service', detail: err.message });
  }

  if (payment.status !== 'paid') {
    return res.status(402).json({ error: 'payment was not successful', payment });
  }

  // STEP 3: record the order — now stamped with WHO bought it.
  const { rows } = await pool.query(
    `INSERT INTO orders (buyer_email, product_id, product_name, quantity, total, txn_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, created_at`,
    [buyer.email, product.id, product.name, quantity, total, payment.txnId, 'confirmed']
  );

  res.status(201).json({
    orderId: rows[0].id,
    buyer: buyer.email,
    product: { id: product.id, name: product.name, price: product.price },
    quantity,
    total,
    payment: { status: payment.status, txnId: payment.txnId },
    createdAt: rows[0].created_at,
  });
});

// ---- GET / : list all orders -----------------------------------------------
app.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM orders ORDER BY id DESC');
  res.json({ count: rows.length, orders: rows });
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: NAME }));

initDb()
  .then(() => app.listen(PORT, () => console.log(`[${NAME}] listening on port ${PORT}`)))
  .catch((err) => {
    console.error(`[${NAME}] could not initialise database:`, err.message);
    process.exit(1);
  });
