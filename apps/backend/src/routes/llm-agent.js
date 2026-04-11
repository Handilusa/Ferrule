import { Router } from "express";
import { streamLLM } from "../services/gemini.js";
import { Mppx, stellar, Store } from "@stellar/mpp/channel/server";

const router = Router();

// --- MPP Channel middleware setup (lazy init — ESM imports hoist before dotenv) ---
let mppx = null;
let mppInitialized = false;

function initMPP() {
  if (mppInitialized) return;
  mppInitialized = true;

  const CHANNEL_CONTRACT = process.env.ONE_WAY_CHANNEL_CONTRACT_ID;
  const COMMITMENT_PUBKEY = process.env.ORCHESTRATOR_PUBLIC_KEY;
  const MPP_SECRET_KEY = process.env.LLM_AGENT_PRIVATE_KEY;

  try {
    if (CHANNEL_CONTRACT && COMMITMENT_PUBKEY && MPP_SECRET_KEY) {
      mppx = Mppx.create({
        secretKey: MPP_SECRET_KEY,
        methods: [
          stellar.channel({
            channel: CHANNEL_CONTRACT,
            commitmentKey: COMMITMENT_PUBKEY,
            store: Store.memory(),
            network: "stellar:testnet",
          }),
        ],
      });
      console.log("[LLM Agent] MPP Channel middleware initialized ✓");
      console.log(`[LLM Agent] Channel: ${CHANNEL_CONTRACT.slice(0, 8)}...`);
    } else {
      console.warn("[LLM Agent] MPP not configured — running in open mode");
    }
  } catch (err) {
    console.warn(`[LLM Agent] MPP init failed: ${err.message} — running in open mode`);
  }
}

/**
 * Convert Express req to Web Request (needed by mppx)
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
 */
router.post("/", async (req, res) => {
  const PORT = process.env.PORT || 3000;

  // Lazy init MPP (env vars available now)
  initMPP();

  // --- MPP Payment gate ---
  if (mppx) {
    try {
      const webReq = toWebRequest(req, PORT);
      const result = await mppx.channel({
        amount: "0.00001",
        description: "LLM token batch (100 tokens)",
      })(webReq);

      if (result.status === 402) {
        const challenge = result.challenge;
        challenge.headers.forEach((value, key) => res.setHeader(key, value));
        return res.status(402).send(await challenge.text());
      }
    } catch (err) {
      console.warn("[LLM Agent] MPP check failed:", err.message);
      // Continue without payment in dev
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
      paymentMethod: mppx ? "mpp-channel" : "open",
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
    paymentMethod: mppx ? "mpp-channel" : "open",
    model: "gemini-2.5-flash-lite",
    pricePerBatch: "0.00001 USDC / 100 tokens",
  });
});

export { router as llmAgentRouter };
