import { Router } from "express";
import { streamLLM } from "../services/gemini.js";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);

/**
 * LLM Agent Router — MPP Session Channel protected
 *
 * In the full implementation, this endpoint is gated by MPP Session middleware:
 * each request requires an off-chain cumulative commitment signed with ed25519.
 * The orchestrator (acting as MPP client) auto-handles the 402 challenge flow.
 *
 * For the hackathon demo, we implement:
 * 1. MPP Session middleware (mppx + @stellar/mpp/channel/server)
 * 2. Streaming LLM response via Gemini
 * 3. Token counting per batch (~100 tokens = 1 commitment)
 */

const router = Router();

// --- MPP Session middleware setup ---
// This requires a deployed one-way-channel contract on testnet.
// We wrap the setup in a try-catch so the server starts even without
// MPP configured (graceful degradation for development).
let mppx = null;

async function initMPP() {
  try {
    const { Mppx, Store } = await import("mppx/server");
    const { stellar } = await import("@stellar/mpp/channel/server");
    const { StrKey } = _require("@stellar/stellar-sdk");

    const CHANNEL_CONTRACT = process.env.CHANNEL_CONTRACT;
    const COMMITMENT_PUBKEY = process.env.COMMITMENT_PUBKEY;
    const MPP_SECRET_KEY = process.env.MPP_SECRET_KEY;

    if (!CHANNEL_CONTRACT || !COMMITMENT_PUBKEY || !MPP_SECRET_KEY) {
      console.warn("[LLM Agent] MPP not configured — running in open mode (no payment required)");
      return;
    }

    // Convert raw ed25519 public key (hex) to a Stellar G... address
    const commitmentPublicKeyG = StrKey.encodeEd25519PublicKey(
      Buffer.from(COMMITMENT_PUBKEY, "hex")
    );

    mppx = Mppx.create({
      secretKey: MPP_SECRET_KEY,
      methods: [
        stellar.channel({
          channel: CHANNEL_CONTRACT,
          commitmentKey: commitmentPublicKeyG,
          store: Store.memory(),
          network: process.env.STELLAR_NETWORK || "stellar:testnet",
        }),
      ],
    });

    console.log("[LLM Agent] MPP Session middleware initialized ✓");
    console.log(`[LLM Agent] Channel contract: ${CHANNEL_CONTRACT.slice(0, 8)}...`);
  } catch (err) {
    console.warn(`[LLM Agent] MPP init failed: ${err.message} — running in open mode`);
  }
}

// Initialize MPP on module load
initMPP();

/**
 * Convert Express req to Web Request (needed by mppx).
 */
function toWebRequest(req, port) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) headers.append(key, entry);
    } else {
      headers.set(key, value);
    }
  }
  return new Request(`http://localhost:${port}${req.originalUrl}`, {
    method: req.method,
    headers,
    body: req.method !== "GET" ? JSON.stringify(req.body) : undefined,
  });
}

/**
 * POST /api/llm
 * Body: { prompt: string, context: string }
 * Returns: { text: string, tokens: number, batches: number }
 *
 * When MPP is active, the orchestrator must include
 * valid MPP Session commitment credentials in headers.
 */
router.post("/", async (req, res) => {
  const PORT = process.env.PORT || 3000;

  // --- MPP Payment gate ---
  if (mppx) {
    const webReq = toWebRequest(req, PORT);
    const result = await mppx.channel({
      amount: "0.00001", // 0.00001 USDC per request (~100 tokens)
      description: "LLM token batch (100 tokens)",
    })(webReq);

    if (result.status === 402) {
      const challenge = result.challenge;
      challenge.headers.forEach((value, key) => res.setHeader(key, value));
      return res.status(402).send(await challenge.text());
    }
  }

  // --- Process LLM request ---
  const { prompt, context } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  try {
    const wss = req.app.get("wss");
    const { broadcast } = await import("../websocket.js");

    const { fullText, totalTokens, batchCount } = await streamLLM(
      prompt,
      context || "",
      (batchTokens, batchText, totalTkns, batch) => {
        // Emit each token batch as a real-time event
        if (wss) {
          broadcast(wss, {
            type: "result_chunk",
            text: batchText,
            batchTokens,
            totalTokens: totalTkns,
            batchNumber: batch,
            agent: "llm",
            timestamp: Date.now(),
          });

          // Each batch represents an off-chain commitment
          broadcast(wss, {
            type: "commitment",
            channel: "llm",
            amount: (0.00001 * batch).toFixed(6),
            batchNumber: batch,
            cumulativeTokens: totalTkns,
            timestamp: Date.now(),
          });
        }
      }
    );

    res.json({
      text: fullText,
      tokens: totalTokens,
      batches: batchCount,
      costUSDC: (0.00001 * batchCount).toFixed(6),
      agent: "llm",
      paymentMethod: mppx ? "mpp-session" : "open",
    });
  } catch (error) {
    console.error("[LLM Agent] Error:", error.message);
    res.status(500).json({ error: "LLM processing failed", details: error.message });
  }
});

// Health check
router.get("/health", (_req, res) => {
  res.json({
    agent: "llm",
    paymentMethod: mppx ? "mpp-session" : "open",
    model: "gemini-2.0-flash-lite",
    pricePerBatch: "0.00001 USDC / 100 tokens",
  });
});

export { router as llmAgentRouter };
