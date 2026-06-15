// ============================================================================
//  charge.js  —  the payment business logic, separated from Express.
//  Keeping pure logic OUT of the HTTP handler makes it trivial to unit-test
//  (no server, no network needed). This is a core testability pattern:
//  thin HTTP layer + plain, testable functions underneath.
// ============================================================================

const { randomUUID } = require("crypto");

// Validate an amount and produce a charge result. Throws on bad input.
function createCharge({ amount, currency = "USD" } = {}) {
  if (typeof amount !== "number" || Number.isNaN(amount) || amount <= 0) {
    throw new Error("invalid amount");
  }
  return {
    status: "paid",
    txnId: "txn_" + randomUUID(),
    amount,
    currency,
  };
}

module.exports = { createCharge };
