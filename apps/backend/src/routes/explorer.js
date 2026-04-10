/**
 * Explorer REST Routes
 * 
 * GET /api/explorer/stats    → current stats snapshot
 * GET /api/explorer/agents   → agent leaderboard from Soroban registry
 * GET /api/explorer/ledgers  → paginated ledger history (proxy to Horizon)
 * GET /api/explorer/operations → paginated ops for Platform Wallet
 */

import { Router } from "express";
import { Horizon, Keypair } from "@stellar/stellar-sdk";
import * as StellarSdk from "@stellar/stellar-sdk";
import { getExplorerStats } from "../services/explorer-stats.js";
import { getLedgerBuffer, getOperationBuffer, getAgentOpBuffer, classifyOperation } from "../services/horizon-stream.js";

const { Networks, Contract, TransactionBuilder, rpc, xdr, scValToNative } = StellarSdk;

const router = Router();
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const horizon = new Horizon.Server(HORIZON_URL);
const rpcServer = new rpc.Server("https://soroban-testnet.stellar.org");

// --- Stats ---
router.get("/stats", (_req, res) => {
  try {
    const stats = getExplorerStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Agent Leaderboard ---
router.get("/agents", async (_req, res) => {
  const contractId = process.env.REGISTRY_CONTRACT_ID;
  if (!contractId) {
    return res.json([]);
  }

  try {
    const contract = new Contract(contractId);
    const secret = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.STELLAR_SECRET_KEY_1;
    const kp = Keypair.fromSecret(secret);
    const account = await rpcServer.getAccount(kp.publicKey());

    // Get agent list
    const listTx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("list_agents"))
      .setTimeout(30)
      .build();

    const simList = await rpcServer.simulateTransaction(listTx);
    let agentNames = ["ferrule_search", "ferrule_llm", "ferrule_risk"];
    
    if (simList.result?.retval) {
      try {
        agentNames = scValToNative(simList.result.retval);
      } catch (_) {
        // fallback to defaults
      }
    }

    // Get details for each agent
    const agents = [];
    for (const name of agentNames) {
      try {
        const freshAccount = await rpcServer.getAccount(kp.publicKey());
        const getTx = new TransactionBuilder(freshAccount, {
          fee: "100",
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(contract.call("get_agent", xdr.ScVal.scvSymbol(name)))
          .setTimeout(30)
          .build();

        const simGet = await rpcServer.simulateTransaction(getTx);
        if (simGet.result?.retval) {
          const entry = scValToNative(simGet.result.retval);
          const totalMissions = Number(entry.total_missions || 0);
          const successMissions = Number(entry.successful_missions || 0);
          const successRate = totalMissions > 0 ? ((successMissions / totalMissions) * 100).toFixed(1) : "100.0";
          const price = Number(entry.price || 0) / 1e7;
          const usdcEarned = (price * totalMissions).toFixed(4);

          agents.push({
            name: String(entry.name || name),
            total_missions: totalMissions,
            successful_missions: successMissions,
            success_rate: parseFloat(successRate),
            usdc_earned: usdcEarned,
            status: "active",
            protocol: String(entry.protocol || "x402"),
            price: price.toFixed(7),
            url: String(entry.url || ""),
            description: String(entry.description || ""),
          });
        }
      } catch (err) {
        agents.push({
          name,
          total_missions: 0,
          successful_missions: 0,
          success_rate: 100,
          usdc_earned: "0.0000",
          status: "active",
          protocol: "x402",
          price: "0.0002",
        });
      }
    }

    res.json(agents);
  } catch (err) {
    console.error("[Explorer] Agent fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Paginated Ledgers ---
router.get("/ledgers", async (req, res) => {
  const { cursor, limit = 50, order = "desc" } = req.query;

  try {
    let query = horizon.ledgers().limit(parseInt(limit)).order(order);
    if (cursor) query = query.cursor(cursor);
    
    const records = await query.call();
    const ledgers = records.records.map((l) => ({
      sequence: l.sequence,
      closed_at: l.closed_at,
      operation_count: l.operation_count,
      tx_count: l.successful_transaction_count,
      failed_tx_count: l.failed_transaction_count,
      base_fee: l.base_fee_in_stroops,
      hash: l.hash,
      prev_hash: l.prev_hash,
    }));

    res.json({
      ledgers,
      next_cursor: records.records.length > 0 ? records.records[records.records.length - 1].paging_token : null,
    });
  } catch (err) {
    console.error("[Explorer] Ledger fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Paginated Operations ---
router.get("/operations", async (req, res) => {
  const { cursor, limit = 50, order = "desc" } = req.query;
  const platformSecret = process.env.STELLAR_SECRET_KEY_2;
  if (!platformSecret) {
    return res.status(400).json({ error: "Platform wallet not configured" });
  }

  const platformPublicKey = Keypair.fromSecret(platformSecret).publicKey();

  try {
    let query = horizon.operations()
      .forAccount(platformPublicKey)
      .limit(parseInt(limit))
      .order(order);
    if (cursor) query = query.cursor(cursor);

    const records = await query.call();
    
    // Apply Ferrule classification and filter out non-Ferrule ops
    const ops = records.records
      .map((op) => {
        const classification = classifyOperation(op);
        if (!classification) return null; // Not Ferrule-related
        return {
          id: op.id,
          type: op.type,
          created_at: op.created_at,
          transaction_hash: op.transaction_hash,
          source_account: op.source_account,
          ferruleType: classification.opType,
          ferruleLabel: classification.label,
          ferruleDetail: classification.detail,
          ...(op.asset_code && { asset_code: op.asset_code }),
          ...(op.amount && { amount: op.amount }),
          ...(op.to && { to: op.to }),
          ...(op.from && { from: op.from }),
          ...(op.name && { name: op.name }),
        };
      })
      .filter(Boolean);

    res.json({
      operations: ops,
      next_cursor: records.records.length > 0 ? records.records[records.records.length - 1].paging_token : null,
    });
  } catch (err) {
    console.error("[Explorer] Operations fetch error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export const explorerRouter = router;
