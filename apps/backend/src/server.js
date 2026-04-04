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
    },
    status: "operational",
  });
});

// --- Agent routers ---
app.use("/api/orchestrate", orchestratorRouter);
app.use("/api/llm", llmAgentRouter);
app.use("/api/search", searchAgentRouter);

// --- WebSocket for real-time payment events ---
const wss = setupWebSocket(server);

// Make wss available to routers
app.set("wss", wss);

// --- Start ---
server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════╗
║   🔧 FERRULE — Pay-Per-Token AI on Stellar       ║
║   Server: http://localhost:${PORT}                   ║
║   Agents: Orchestrator + LLM (MPP) + Search (x402)║
╚═══════════════════════════════════════════════════╝
  `);
});

export { app, server };
// Watch trigger - Soroban channels.js v2
