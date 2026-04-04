import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { Keypair } = _require("@stellar/stellar-sdk");

/**
 * Load Stellar keypairs from environment variables.
 * Each agent has its own wallet for receiving payments.
 */
export function loadWallets() {
  const wallets = {};

  // Orchestrator — funds channels, pays agents
  if (process.env.ORCHESTRATOR_SECRET) {
    wallets.orchestrator = {
      keypair: Keypair.fromSecret(process.env.ORCHESTRATOR_SECRET),
      publicKey: process.env.ORCHESTRATOR_PUBLIC || Keypair.fromSecret(process.env.ORCHESTRATOR_SECRET).publicKey(),
    };
  }

  // LLM Agent — receives MPP Session payments
  if (process.env.LLM_AGENT_SECRET) {
    wallets.llmAgent = {
      keypair: Keypair.fromSecret(process.env.LLM_AGENT_SECRET),
      publicKey: process.env.LLM_AGENT_PUBLIC || Keypair.fromSecret(process.env.LLM_AGENT_SECRET).publicKey(),
    };
  }

  // Search Agent — receives x402 payments
  if (process.env.SEARCH_AGENT_SECRET) {
    wallets.searchAgent = {
      keypair: Keypair.fromSecret(process.env.SEARCH_AGENT_SECRET),
      publicKey: process.env.SEARCH_AGENT_PUBLIC || Keypair.fromSecret(process.env.SEARCH_AGENT_SECRET).publicKey(),
    };
  }

  return wallets;
}

/**
 * Get network passphrase for Stellar testnet/mainnet.
 */
export function getNetworkPassphrase(network = "stellar:testnet") {
  if (network === "stellar:pubnet" || network === "stellar:mainnet") {
    return "Public Global Stellar Network ; September 2015";
  }
  return "Test SDF Network ; September 2015";
}

/**
 * Summarize wallet info for logging (no secrets!).
 */
export function logWallets(wallets) {
  console.log("[Wallets] Loaded:");
  for (const [name, w] of Object.entries(wallets)) {
    console.log(`  ${name}: ${w.publicKey.slice(0, 8)}...${w.publicKey.slice(-4)}`);
  }
}
