// ============================================================================
//  charge.test.js  —  unit tests using Node's BUILT-IN test runner.
//  No extra dependencies (no Jest/Mocha). Run with:  node --test   (npm test)
//  Each test() is a case; assert checks the expected result.
// ============================================================================

const { test } = require('node:test');
const assert = require('node:assert');
const { createCharge } = require('./charge');

test('valid amount -> paid with a txn id', () => {
  const r = createCharge({ amount: 49.99, currency: 'USD' });
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(r.amount, 49.99);
  assert.strictEqual(r.currency, 'USD');
  assert.match(r.txnId, /^txn_/);          // txn id has the expected shape
});

test('currency defaults to USD', () => {
  const r = createCharge({ amount: 10 });
  assert.strictEqual(r.currency, 'USD');
});

test('rejects zero or negative amounts', () => {
  assert.throws(() => createCharge({ amount: 0 }), /invalid amount/);
  assert.throws(() => createCharge({ amount: -5 }), /invalid amount/);
});

test('rejects non-number amounts', () => {
  assert.throws(() => createCharge({ amount: 'free' }), /invalid amount/);
  assert.throws(() => createCharge({}), /invalid amount/);   // missing amount
});
