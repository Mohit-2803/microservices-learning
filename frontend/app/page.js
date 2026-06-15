'use client';

// ============================================================================
//  Mini-Shop frontend  —  auth-aware
//
//  - Login now KEEPS the JWT (in state + localStorage so it survives refresh).
//  - Buying sends the token as "Authorization: Bearer <token>".
//  - orders-svc verifies that token; no token => 401 => we show a clear msg.
//  Every fetch() uses a relative "/api/..." url => same origin => no CORS.
// ============================================================================

import { useEffect, useState } from 'react';

const emojiFor = (name = '') => {
  const n = name.toLowerCase();
  if (n.includes('keyboard')) return '⌨️';
  if (n.includes('mouse')) return '🖱️';
  if (n.includes('hub')) return '🔌';
  if (n.includes('monitor')) return '🖥️';
  if (n.includes('webcam') || n.includes('cam')) return '📷';
  return '📦';
};

export default function Home() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('demo@shop.test');
  const [password, setPassword] = useState('password123');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState('👋 Welcome! Sign in, then place an order.');

  async function loadProducts() {
    const r = await fetch('/api/products/');
    const d = await r.json();
    setProducts(d.products || []);
  }

  async function loadOrders() {
    const r = await fetch('/api/orders/');
    const d = await r.json();
    setOrders(d.orders || []);
  }

  // On first load: fetch data + restore any saved session from localStorage.
  useEffect(() => {
    loadProducts();
    loadOrders();
    try {
      const t = localStorage.getItem('token');
      const u = localStorage.getItem('user');
      if (t && u) { setToken(t); setUser(JSON.parse(u)); }
    } catch {}
  }, []);

  async function login(e) {
    e.preventDefault();
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (r.ok) {
      setToken(d.token);
      setUser(d.user);
      try {
        localStorage.setItem('token', d.token);
        localStorage.setItem('user', JSON.stringify(d.user));
      } catch {}
      setMsg(`✅ Signed in as ${d.user.name} — you can buy now.`);
    } else {
      setMsg(`❌ Login failed: ${d.error || r.status}`);
    }
  }

  function logout() {
    setToken(null);
    setUser(null);
    try { localStorage.removeItem('token'); localStorage.removeItem('user'); } catch {}
    setMsg('👋 Signed out. Orders now require signing in again.');
  }

  async function buy(p) {
    setBusy(p.id);
    setMsg(`⏳ Placing order for ${p.name}…`);

    // Attach the token IF we have one. If not, we deliberately send the request
    // anyway so you can SEE the server reject it with 401 (server-side enforcement).
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const r = await fetch('/api/orders/', {
      method: 'POST',
      headers,
      body: JSON.stringify({ productId: p.id, quantity: 1 }),
    });
    const d = await r.json();

    if (r.ok) {
      setMsg(`✅ Order #${d.orderId} placed by ${d.buyer} — paid $${d.total} (txn ${d.payment.txnId}).`);
      await loadOrders();
    } else if (r.status === 401) {
      setMsg('🔒 Rejected with 401 — orders-svc checked your token and you’re not signed in. Sign in above, then try again.');
    } else {
      setMsg(`❌ Order failed: ${d.error || r.status}`);
    }
    setBusy(null);
  }

  return (
    <>
      <header className="nav">
        <div className="brand"><span className="logo">🛒</span> Mini-Shop</div>
        <div className="nav-right">
          {user ? (
            <>
              <span className="chip"><span className="dot" /> {user.name}</span>
              <button className="btn ghost sm" onClick={logout}>Sign out</button>
            </>
          ) : (
            <span className="lock">🔒 Not signed in</span>
          )}
        </div>
      </header>

      <div className="container">
        <div className="status">{msg}</div>

        {!user && (
          <section className="section">
            <h2>Sign in <span className="tag">auth-svc</span></h2>
            <p className="sub">Exchanges your credentials for a JWT. The token is then sent with each order.</p>
            <div className="card">
              <form className="form" onSubmit={login}>
                <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                <button className="btn" type="submit">Log in</button>
              </form>
            </div>
          </section>
        )}

        <section className="section">
          <h2>Products <span className="tag">products-svc</span></h2>
          <p className="sub">Loaded live from the products database.{!user && ' Sign in to buy.'}</p>
          <div className="grid">
            {products.map((p) => (
              <div className="product" key={p.id}>
                <div className="thumb">{emojiFor(p.name)}</div>
                <div className="name">{p.name}</div>
                <div className="row">
                  <span className="price">${p.price}</span>
                  <button className="btn" onClick={() => buy(p)} disabled={busy === p.id}>
                    {busy === p.id ? '…' : user ? 'Buy' : '🔒 Buy'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Orders <span className="tag">orders-svc → products + payments</span></h2>
          <p className="sub">{orders.length} order{orders.length === 1 ? '' : 's'} · each one is stamped with the signed-in buyer.</p>
          <div className="card">
            {orders.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>No orders yet — sign in and hit <strong>Buy</strong>.</p>
            ) : (
              orders.map((o) => (
                <div className="order" key={o.id}>
                  <span>
                    {emojiFor(o.product_name)} &nbsp;<strong>#{o.id}</strong> · {o.product_name} ×{o.quantity}
                    {o.buyer_email && <span className="by"> &nbsp;· by {o.buyer_email}</span>}
                  </span>
                  <span><strong className="price">${o.total}</strong> &nbsp;<span className="badge">{o.status}</span></span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </>
  );
}
