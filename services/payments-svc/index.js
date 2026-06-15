// ============================================================================
//  payments-svc  —  FAKE payment processor.
//  The HTTP layer is now thin: it just calls createCharge() (in charge.js,
//  which is unit-tested) and turns the result/error into an HTTP response.
// ============================================================================

const express = require('express');
const { createCharge } = require('./charge');

const app = express();
app.use(express.json());

const PORT = 3000;
const NAME = 'payments-svc';

app.post('/charge', (req, res) => {
  try {
    const charge = createCharge(req.body || {});
    console.log(`[${NAME}] charged ${charge.currency} ${charge.amount} -> ${charge.txnId}`);
    res.json(charge);
  } catch (err) {
    res.status(400).json({ status: 'failed', error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', service: NAME }));

app.listen(PORT, () => console.log(`[${NAME}] listening on port ${PORT}`));
