import express from "express";
import { getAgent, listAgents } from "../services/registry.js";

export const registryRouter = express.Router();

// Get all agents
registryRouter.get("/", async (req, res) => {
  try {
    const agents = await listAgents();
    res.json({ agents });
  } catch (error) {
    console.error("Registry mapping error:", error);
    res.status(500).json({ error: "Failed to list agents from registry" });
  }
});

// Get specific agent (e.g. /api/registry/ferrule.search)
registryRouter.get("/:name", async (req, res) => {
  try {
    const agent = await getAgent(req.params.name);
    if (!agent) {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.json({ agent });
  } catch (error) {
    console.error("Registry mapping error:", error);
    res.status(500).json({ error: "Failed to fetch agent from registry" });
  }
});
