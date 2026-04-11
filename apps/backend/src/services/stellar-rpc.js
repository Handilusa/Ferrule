/**
 * Stellar Horizon RPC — Multi-endpoint fallback for Testnet
 * 
 * Provides a resilient Horizon connection that automatically
 * falls back to alternative RPCs if the primary returns 504.
 */
import { Horizon } from "@stellar/stellar-sdk";

const HORIZON_RPCS = [
  "https://horizon-testnet.stellar.org",               // SDF official
  "https://stellar-horizon-testnet-public.nodies.app",  // Nodies (fastest)
  "https://rpc.ankr.com/http/stellar_testnet_horizon",  // Ankr
];

/**
 * Get the default Horizon server (first RPC).
 * Use this for reads (loadAccount, etc.) which rarely 504.
 */
export function getHorizon() {
  return new Horizon.Server(HORIZON_RPCS[0]);
}

/**
 * Submit a transaction with multi-RPC fallback.
 * Tries each RPC in order. Only falls back on 504 (gateway timeout).
 * Returns the submit result on success.
 * 
 * @param {Transaction} tx - Signed Stellar transaction
 * @param {number} maxRetries - Retries per RPC (default 2)
 * @returns {Promise<object>} Horizon submit response
 */
export async function submitWithFallback(tx, maxRetries = 2) {
  let lastError = null;

  for (const rpc of HORIZON_RPCS) {
    const server = new Horizon.Server(rpc);
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await server.submitTransaction(tx);
        console.log(`[Stellar RPC] TX submitted via ${rpc.split("//")[1].split("/")[0]} (attempt ${attempt + 1})`);
        return result;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        if (status === 504) {
          console.warn(`[Stellar RPC] 504 on ${rpc.split("//")[1].split("/")[0]} attempt ${attempt + 1}/${maxRetries}`);
          await new Promise(r => setTimeout(r, (attempt + 1) * 1500));
          continue; // retry same RPC
        }
        // Non-504 error: don't retry, propagate
        throw err;
      }
    }
    // All retries for this RPC exhausted with 504 → try next RPC
    console.warn(`[Stellar RPC] All retries exhausted for ${rpc.split("//")[1].split("/")[0]}, trying next...`);
  }

  // ALL RPCs failed
  console.error(`[Stellar RPC] All ${HORIZON_RPCS.length} RPCs failed after retries.`);
  throw lastError || new Error("All Horizon RPCs unavailable");
}
