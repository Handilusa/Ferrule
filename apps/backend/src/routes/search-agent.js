import { Router } from "express";
import { searchWeb } from "../services/search.js";

/**
 * Search Agent Router — x402 payment protected
 *
 * Each search request costs $0.0002 USDC via the x402 protocol.
 * The Coinbase facilitator handles verification + on-chain settlement.
 *
 * When x402 is active:
 * 1. First request → 402 Payment Required (with payment instructions)
 * 2. Client signs auth entry → retries with signed credential
 * 3. Facilitator verifies + settles → server returns results
 */

const router = Router();

// --- x402 middleware setup ---
let x402Initialized = false;

async function initX402(app) {
  try {
    const { paymentMiddlewareFromConfig } = await import("@x402/express");
    const { HTTPFacilitatorClient } = await import("@x402/core/server");
    const { ExactStellarScheme } = await import("@x402/stellar/exact/server");

    const SEARCH_AGENT_PUBLIC = process.env.SEARCH_AGENT_PUBLIC;
    const NETWORK = process.env.STELLAR_NETWORK || "stellar:testnet";

    if (!SEARCH_AGENT_PUBLIC) {
      console.warn("[Search Agent] SEARCH_AGENT_PUBLIC not set — running in open mode");
      return null;
    }

    const middleware = paymentMiddlewareFromConfig(
      {
        "POST /api/search": {
          accepts: {
            scheme: "exact",
            price: "$0.0002",
            network: NETWORK,
            payTo: SEARCH_AGENT_PUBLIC,
          },
          description: "Web search query via Ferrule",
        },
      },
      new HTTPFacilitatorClient({ url: "https://www.x402.org/facilitator" }),
      [{ network: NETWORK, server: new ExactStellarScheme() }]
    );

    x402Initialized = true;
    console.log("[Search Agent] x402 middleware initialized ✓");
    console.log(`[Search Agent] Pay-to: ${SEARCH_AGENT_PUBLIC.slice(0, 8)}...`);

    return middleware;
  } catch (err) {
    console.warn(`[Search Agent] x402 init failed: ${err.message} — running in open mode`);
    return null;
  }
}

// We need to apply middleware at router level
// Since x402 middleware needs to be applied per-route via app.use,
// we handle the 402 flow manually for the router pattern
let x402Middleware = null;
initX402().then((mw) => {
  x402Middleware = mw;
});

/**
 * POST /api/search
 * Body: { query: string, maxResults?: number }
 * Returns: { results: Array<{title, url, snippet}>, query: string, cost: string }
 */
router.post("/", async (req, res) => {
  // --- x402 Payment gate ---
  // In production, x402 middleware auto-handles the 402 flow.
  // For the single-process architecture, we apply it manually.
  if (x402Middleware) {
    try {
      await new Promise((resolve, reject) => {
        x402Middleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      // If the middleware sent a 402 response, don't continue
      if (res.headersSent) return;
    } catch (err) {
      console.warn("[Search Agent] x402 check failed:", err.message);
      // Continue without payment for development
    }
  }

  const { query, maxResults } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  try {
    const wss = req.app.get("wss");
    const { broadcast } = await import("../websocket.js");

    // Perform search
    const results = await searchWeb(query, maxResults || 5);

    // Emit x402 payment event
    if (wss) {
      broadcast(wss, {
        type: "x402_payment",
        channel: "search",
        amount: "0.0002",
        query,
        resultCount: results.length,
        timestamp: Date.now(),
      });
    }

    res.json({
      results,
      query,
      resultCount: results.length,
      costUSDC: "0.0002",
      agent: "search",
      paymentMethod: x402Initialized ? "x402" : "open",
    });
  } catch (error) {
    console.error("[Search Agent] Error:", error.message);
    res.status(500).json({ error: "Search failed", details: error.message });
  }
});

// Health check
router.get("/health", (_req, res) => {
  res.json({
    agent: "search",
    paymentMethod: x402Initialized ? "x402" : "open",
    searchEngine: "SearXNG",
    pricePerQuery: "$0.0002 USDC",
  });
});

export { router as searchAgentRouter };
