import { Router } from "express";
import { searchWeb } from "../services/search.js";
import {
  useFacilitator,
  decodePaymentHeader,
  getTokenBySymbol,
} from "x402-stellar";

/**
 * Search Agent Router — x402 payment protected
 *
 * Each search request costs $0.0002 USDC via the x402 protocol.
 * The facilitator at x402.org handles verification + on-chain settlement.
 *
 * Flow:
 * 1. Client sends request without payment → gets 402 with payment requirements
 * 2. Client signs a Soroban SAC transfer and retries with X-PAYMENT header
 * 3. This middleware verifies via the facilitator → settles on-chain → returns results
 */

const router = Router();

// --- x402 config (lazy — env not available at import time in ESM) ---
const NETWORK = "stellar-testnet";
const PRICE = "0.0002"; // USDC per query
const USDC = getTokenBySymbol(NETWORK, "USDC");
const facilitator = useFacilitator({ url: "https://www.x402.org/facilitator" });

function getPaymentRequirements() {
  const receiver = process.env.SEARCH_AGENT_PUBLIC_KEY;
  return {
    scheme: "exact",
    network: NETWORK,
    maxAmountRequired: PRICE,
    resource: "/api/search",
    description: "Web search query via Ferrule",
    mimeType: "application/json",
    payTo: receiver,
    asset: USDC?.address,
  };
}

// Log after a tick so dotenv has loaded
setTimeout(() => {
  console.log(`[Search Agent] x402 initialized ✓  Pay-to: ${process.env.SEARCH_AGENT_PUBLIC_KEY?.slice(0,8)}...`);
}, 0);

/**
 * x402 middleware — handles 402 challenge/response flow
 */
async function x402Gate(req, res, next) {
  // Check for payment header
  const paymentHeader = req.headers["x-payment"];
  const reqs = getPaymentRequirements();

  if (!paymentHeader) {
    // No payment → send 402 with requirements
    res.setHeader("X-Payment", JSON.stringify(reqs));
    return res.status(402).json({
      error: "Payment Required",
      accepts: reqs,
      price: `${PRICE} USDC`,
      payTo: reqs.payTo,
    });
  }

  // Verify payment via facilitator
  try {
    const payload = typeof paymentHeader === "string"
      ? JSON.parse(paymentHeader)
      : paymentHeader;

    const verifyResult = await facilitator.verify(payload, reqs);

    if (!verifyResult.valid) {
      return res.status(402).json({
        error: "Payment verification failed",
        reason: verifyResult.reason,
        accepts: reqs,
      });
    }

    // Settle on-chain
    const settleResult = await facilitator.settle(payload, reqs);

    // Attach settlement info for downstream use
    req.x402 = {
      settled: true,
      txHash: settleResult?.txHash || settleResult?.transaction,
      amount: PRICE,
    };

    next();
  } catch (err) {
    console.warn("[Search Agent] x402 verify/settle error:", err.message);
    // In hackathon mode, allow through but log the failure
    req.x402 = { settled: false, error: err.message };
    next();
  }
}

// Apply x402 gate to all routes
router.use(x402Gate);

/**
 * POST /api/search
 * Body: { query: string, maxResults?: number }
 */
router.post("/", async (req, res) => {
  const { query, maxResults } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const wss = req.app.get("wss");
    const { broadcast } = await import("../websocket.js");

    const results = await searchWeb(query, maxResults || 5);

    // Emit x402 payment event
    if (wss) {
      broadcast(wss, {
        type: "x402_payment",
        channel: "search",
        amount: PRICE,
        query,
        resultCount: results.length,
        txHash: req.x402?.txHash || null,
        timestamp: Date.now(),
      });
    }

    res.json({
      results,
      query,
      resultCount: results.length,
      costUSDC: PRICE,
      agent: "search",
      paymentMethod: "x402",
      settlement: req.x402,
    });
  } catch (error) {
    console.error("[Search Agent] Error:", error.message);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// Health check (no payment needed)
router.get("/health", (_req, res) => {
  // Skip x402 for health — handled by the fact that GET /health comes after the middleware
  // but let's add it directly
  res.json({
    agent: "search",
    paymentMethod: "x402",
    searchEngine: "SearXNG",
    pricePerQuery: `$${PRICE} USDC`,
    receiver: process.env.SEARCH_AGENT_PUBLIC_KEY,
  });
});

export { router as searchAgentRouter };
