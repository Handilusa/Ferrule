/**
 * Horizon Stream Service — SSE streams for Explorer real-time data
 * 
 * Three parallel streams:
 *  1. streamLedgers()      — ledger closed every ~5s
 *  2. streamOperations()   — filters by Platform Wallet, Ferrule-tagged only
 *  3. streamContracts()    — invocations to agent-registry & risk-mandates
 * 
 * All streams auto-reconnect on drop (Horizon Testnet is flaky).
 */

import { Horizon, Keypair } from "@stellar/stellar-sdk";
import { broadcast } from "../websocket.js";
import { updateStatsFromLedger, updateStatsFromOperation } from "./explorer-stats.js";

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const horizon = new Horizon.Server(HORIZON_URL);

// Circular buffers
const ledgerBuffer = [];        // last 20 ledgers
const operationBuffer = [];     // last 100 operations
const agentOpBuffer = [];       // last 50 contract ops
const MAX_LEDGERS = 20;
const MAX_OPS = 100;
const MAX_AGENT_OPS = 50;

// Track close handles for cleanup
let ledgerClose = null;
let opsClose = null;

export function getLedgerBuffer() { return ledgerBuffer; }
export function getOperationBuffer() { return operationBuffer; }
export function getAgentOpBuffer() { return agentOpBuffer; }

/**
 * Classify an operation into a Ferrule operation type.
 * Returns null if it's not Ferrule-related (should be filtered out).
 */
function classifyOperation(op) {
  // manageData with FRL_ prefix → anchoring
  if (op.type === "manage_data" && op.name && op.name.startsWith("FRL_")) {
    return { opType: "ANC", label: "Report Anchored", detail: op.name };
  }

  // Payment in USDC with small amounts → x402
  if (op.type === "payment" && op.asset_code === "USDC") {
    const amount = parseFloat(op.amount);
    if (amount <= 0.001) {
      return { opType: "x402", label: "x402 Payment", detail: `${op.amount} USDC` };
    }
    // Larger payments are budget funding — still track
    return { opType: "MPP", label: "MPP Budget", detail: `${op.amount} USDC` };
  }

  // Soroban contract invocations
  if (op.type === "invoke_host_function") {
    const contractId = op.source_account || "";
    const registryId = process.env.REGISTRY_CONTRACT_ID || "";
    const mandatesId = process.env.MANDATES_CONTRACT_ID || "";

    if (registryId && contractId === registryId) {
      // Try to detect record_mission vs register
      const fn = op.function || "";
      if (fn.includes("record_mission")) {
        return { opType: "SLA", label: "Mission Recorded", detail: "record_mission" };
      }
      return { opType: "SLA", label: "Registry Call", detail: fn || "invoke" };
    }
    if (mandatesId && contractId === mandatesId) {
      return { opType: "MANDATE", label: "Mandate Update", detail: "risk-mandates" };
    }
    // Generic Soroban call from platform
    return { opType: "SLA", label: "Contract Call", detail: "invokeHostFunction" };
  }

  // createAccount ops for agent wallet funding — skip
  if (op.type === "create_account") return null;

  // changeTrust — skip
  if (op.type === "change_trust") return null;

  return null;
}

/**
 * Stream ledgers in real-time from Horizon.
 * Auto-reconnects on error.
 */
function streamLedgers(wss) {
  console.log("[Explorer] Starting ledger stream...");

  function start() {
    ledgerClose = horizon.ledgers()
      .cursor("now")
      .stream({
        onmessage: (ledger) => {
          const ledgerData = {
            sequence: ledger.sequence,
            closed_at: ledger.closed_at,
            operation_count: ledger.operation_count,
            tx_count: ledger.successful_transaction_count,
            failed_tx_count: ledger.failed_transaction_count,
            base_fee: ledger.base_fee_in_stroops,
            total_coins: ledger.total_coins,
          };

          // Push to buffer
          ledgerBuffer.push(ledgerData);
          if (ledgerBuffer.length > MAX_LEDGERS) ledgerBuffer.shift();

          // Update stats
          updateStatsFromLedger(ledgerData);

          // Broadcast to frontend
          if (wss) {
            broadcast(wss, {
              type: "explorer:ledger",
              ...ledgerData,
              timestamp: Date.now(),
            });
          }
        },
        onerror: (err) => {
          console.warn("[Explorer] Ledger stream error, reconnecting in 3s...", err?.message || "");
          if (ledgerClose) {
            try { ledgerClose(); } catch (_) {}
            ledgerClose = null;
          }
          setTimeout(() => start(), 3000);
        },
      });
  }

  start();
}

/**
 * Stream operations for Platform Wallet — Ferrule-tagged only.
 * Auto-reconnects on error.
 */
function streamOperations(wss, platformPublicKey) {
  console.log(`[Explorer] Starting ops stream for ${platformPublicKey.slice(0, 8)}...`);

  function start() {
    opsClose = horizon.operations()
      .forAccount(platformPublicKey)
      .cursor("now")
      .stream({
        onmessage: (op) => {
          const classification = classifyOperation(op);
          if (!classification) return; // Not Ferrule-related, skip

          const opData = {
            id: op.id,
            type: op.type,
            created_at: op.created_at,
            transaction_hash: op.transaction_hash,
            source_account: op.source_account,
            ferruleType: classification.opType,
            ferruleLabel: classification.label,
            ferruleDetail: classification.detail,
          };

          // Push to operation buffer
          operationBuffer.push(opData);
          if (operationBuffer.length > MAX_OPS) operationBuffer.shift();

          // Push to agent op buffer for classified ops
          agentOpBuffer.push(opData);
          if (agentOpBuffer.length > MAX_AGENT_OPS) agentOpBuffer.shift();

          // Update stats
          updateStatsFromOperation(opData);

          // Broadcast operation
          if (wss) {
            broadcast(wss, {
              type: "explorer:operation",
              ...opData,
              timestamp: Date.now(),
            });

            // Also broadcast as agent_op for the right-column feed
            broadcast(wss, {
              type: "explorer:agent_op",
              ...opData,
              timestamp: Date.now(),
            });
          }
        },
        onerror: (err) => {
          console.warn("[Explorer] Ops stream error, reconnecting in 3s...", err?.message || "");
          if (opsClose) {
            try { opsClose(); } catch (_) {}
            opsClose = null;
          }
          setTimeout(() => start(), 3000);
        },
      });
  }

  start();
}

/**
 * Initialize all Horizon streams.
 * Called once from server.js at startup.
 */
export function initHorizonStreams(wss) {
  // Derive platform public key from secret — NEVER expose secret
  const platformSecret = process.env.STELLAR_SECRET_KEY_2;
  if (!platformSecret) {
    console.warn("[Explorer] No STELLAR_SECRET_KEY_2 — skipping operation/contract streams.");
    // Still stream ledgers (public data)
    streamLedgers(wss);
    return;
  }

  const platformPublicKey = Keypair.fromSecret(platformSecret).publicKey();
  console.log(`[Explorer] Platform Wallet: ${platformPublicKey.slice(0, 8)}...${platformPublicKey.slice(-4)}`);

  // Start all three streams in parallel
  streamLedgers(wss);
  streamOperations(wss, platformPublicKey);
}

/**
 * Cleanup — stop all streams on shutdown.
 */
export function stopHorizonStreams() {
  if (ledgerClose) { try { ledgerClose(); } catch(_) {} }
  if (opsClose) { try { opsClose(); } catch(_) {} }
}
