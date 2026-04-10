import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../frontend/.env.local") });
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { setupWebSocket } from "./websocket.js";
import { orchestratorRouter } from "./routes/orchestrator.js";
import { llmAgentRouter } from "./routes/llm-agent.js";
import { searchAgentRouter } from "./routes/search-agent.js";
import { riskAgentRouter } from "./routes/risk-agent.js";
import { registryRouter } from "./routes/registry.js";
import { faucetRouter } from "./routes/faucet.js";
import { monitorRouter } from "./routes/monitor.js";
import { explorerRouter } from "./routes/explorer.js";
import { broadcast } from "./websocket.js";
import { registerAgent } from "./services/registry.js";
import { startMonitorCron } from "./services/monitor-cron.js";
import { initBot, getWebhookHandler } from "./services/telegram.js";
import { initHorizonStreams } from "./services/horizon-stream.js";
import { startStatsBroadcast } from "./services/explorer-stats.js";

const PORT = process.env.PORT || 3000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3001";

const app = express();
const server = createServer(app);

// --- Middleware ---
app.use(cors({ origin: [FRONTEND_URL, "http://localhost:3000"], credentials: true }));
app.use(express.json());

// --- Health check ---
app.get("/", (_req, res) => {
  res.json({
    name: "Ferrule",
    tagline: "Pay-Per-Token AI Research Agent on Stellar",
    agents: {
      orchestrator: "/api/orchestrate",
      llm: "/api/llm",
      search: "/api/search",
      risk: "/api/risk"
    },
    status: "operational",
  });
});

app.get('/health', (_, res) => res.json({ ok: true, ts: Date.now() }));

// --- Agent routers ---
app.use("/api/orchestrate", orchestratorRouter);
app.use("/api/llm", llmAgentRouter);
app.use("/api/search", searchAgentRouter);
app.use("/api/risk", riskAgentRouter);
app.use("/api/registry", registryRouter);
app.use("/api/faucet", faucetRouter);
app.use("/api/monitor", monitorRouter);
app.use("/api/explorer", explorerRouter);

// --- Telegram Webhook (Registered immediately to not block startup) ---
// getWebhookHandler gracefully handles requests if bot is null during init
app.post("/api/telegram/webhook", (req, res, next) => {
  const handler = getWebhookHandler();
  return handler(req, res, next);
});

// --- WebSocket for real-time payment events ---
const wss = setupWebSocket(server);

// Make wss available to routers
app.set("wss", wss);
app.set("broadcast", broadcast);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function initBotWithRetry(attempts = 5, delay = 5000) {
  for (let i = 0; i < attempts; i++) {
    try {
      const success = await initBot();
      if (success) {
        console.log('✅ Bot inicializado correctamente en background');
        return;
      }
      throw new Error("initBot devolvió false");
    } catch (err) {
      console.log(`⚠️ Bot init fallido (intento ${i+1}/${attempts}), reintentando en ${delay/1000}s...`);
      await sleep(delay);
      delay *= 2; // backoff exponencial
    }
  }
  console.error('❌ Bot no pudo inicializarse tras todos los intentos');
}

// --- Start ---
server.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🔧 FERRULE — Pay-Per-Token AI on Stellar       ║
║   Server: http://localhost:${PORT}                   ║
║   Agents: Orchestrator + LLM (MPP) + Search (x402)║
╚═══════════════════════════════════════════════════╝
  `);

  // Initializaciones no bloqueantes
  startMonitorCron();
  initBotWithRetry();

  // Explorer: Horizon streams + stats broadcast
  initHorizonStreams(wss);
  startStatsBroadcast(wss);

  // Auto-register agents in Soroban background
  if (process.env.REGISTRY_CONTRACT_ID) {
    console.log("⚙️  Registering Agents to Soroban Ledger...");
    try {
      await registerAgent(
        "ferrule_search",
        "https://ferrule-demo.vercel.app/api/search",
        "0.0001",
        "USDC",
        "x402",
        "Due diligence web search — SaaS, security, compliance"
      );
      await registerAgent(
        "ferrule_llm",
        "https://ferrule-demo.vercel.app/api/llm",
        "0.00001",
        "USDC",
        "mpp",
        "Due diligence token streamer — Architecture parser"
      );
      await registerAgent(
        "ferrule_risk",
        "https://ferrule-demo.vercel.app/api/risk",
        "0.005",
        "USDC",
        "x402",
        "Adversarial risk evaluator & agent coordinator"
      );
    } catch (e) {
      console.error("Agent Registry failed:", e);
    }
  } else {
    console.warn("⚠️ No REGISTRY_CONTRACT_ID provided. Skipping public agent registration.");
  }
});

export { app, server };
// Watch trigger - Soroban channels.js v2
