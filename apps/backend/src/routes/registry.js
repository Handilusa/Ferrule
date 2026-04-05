import express from "express";

export const registryRouter = express.Router();

const CONTRACT_ID = process.env.REGISTRY_CONTRACT_ID || "CAIDRIF26CKCJYTN6ZDH5HLQEJZL53YWK352OOVY56JV67MD4JKX5E5O";

// Registered agents — mirrors what server.js auto-registers on-chain
const REGISTERED_AGENTS = [
  {
    name: "ferrule.search",
    url: "https://meridian-demo.vercel.app/api/search",
    price: "0.0001",
    asset: "USDC",
    protocol: "x402",
    description: "Due diligence web search — SaaS, security, compliance",
    contract: CONTRACT_ID,
    explorer: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
  },
  {
    name: "ferrule.llm",
    url: "https://meridian-demo.vercel.app/api/llm",
    price: "0.00001",
    asset: "USDC",
    protocol: "mpp",
    description: "Due diligence token streamer — Architecture parser",
    contract: CONTRACT_ID,
    explorer: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
  },
  {
    name: "ferrule.risk",
    url: "https://meridian-demo.vercel.app/api/risk",
    price: "0.005",
    asset: "USDC",
    protocol: "x402",
    description: "Adversarial risk evaluator & agent coordinator",
    contract: CONTRACT_ID,
    explorer: `https://stellar.expert/explorer/testnet/contract/${CONTRACT_ID}`,
  },
];

// GET /api/registry — list all public agents
registryRouter.get("/", (req, res) => {
  res.json({
    registry_contract: CONTRACT_ID,
    network: "testnet",
    agents: REGISTERED_AGENTS,
  });
});

// GET /api/registry/:name — get specific agent
registryRouter.get("/:name", (req, res) => {
  const agent = REGISTERED_AGENTS.find((a) => a.name === req.params.name);
  if (!agent) {
    return res.status(404).json({ error: "Agent not found in registry" });
  }
  res.json({ agent });
});
