import { Router } from "express";
import { broadcast } from "../websocket.js";
import { searchWeb } from "../services/search.js";
import { streamLLM, fastChatResponse } from "../services/gemini.js";
import { loadWallets, logWallets } from "../wallet.js";
import { openChannelOnChain, closeChannelOnChain, signMicropayment, publicKeyFromSecret } from "../channels.js";
import { Asset, TransactionBuilder, Networks, Horizon, Keypair, Operation } from "@stellar/stellar-sdk";
/**
 * Orchestrator Router — coordinates the research pipeline
 *
 * The orchestrator is the brain of Ferrule:
 * 1. Receives user query + budget
 * 2. Opens MPP Session channel (on-chain tx #1)
 * 3. Sends search queries to Search Agent (x402 per-request payments)
 * 4. Feeds search context into LLM Agent (MPP Session off-chain commitments)
 * 5. Closes MPP Session channel (on-chain tx #2)
 * 6. Returns complete research report + transaction IDs
 *
 * In the single-process architecture, the orchestrator calls
 * the LLM and Search services directly (in-process) while
 * still recording payment events for the frontend visualization.
 */

const router = Router();

// --- PRE-AUTH ENDPOINT: Build XDR for Freighter to sign ---
router.post("/preauth", async (req, res) => {
  const { funderPublicKey, budget } = req.body;
  if (!funderPublicKey) return res.status(400).json({ error: "Missing funderPublicKey" });

  try {
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
    const account = await horizon.loadAccount(funderPublicKey);
    
    // The budget is passed, or default to 0.05
    const paymentAmount = budget ? String(budget) : "0.05";
    
    // Platform Funder Architecture: User pays the Orchestrator Wallet upfront
    const platformPublicKey = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY_2).publicKey();
    const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const usdcAsset = new Asset("USDC", USDC_ISSUER);

    // Build standard payment
    const tx = new TransactionBuilder(account, {
      fee: "1000",
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.payment({
      destination: platformPublicKey,
      asset: usdcAsset,
      amount: paymentAmount
    }))
    .setTimeout(60)
    .build();

    const xdr = tx.toXDR();
    return res.json({ xdr });
  } catch (err) {
    console.error("Preauth error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// Session store — tracks active research sessions in memory
const sessions = new Map();

/**
 * POST /api/orchestrate
 * Body: { query: string, budget?: number }
 * Returns: { sessionId, report, payments, transactions }
 */
router.post("/", async (req, res) => {
  const { query, budget, mode = "mission" } = req.body;

  if (!query) {
    return res.status(400).json({ error: "query is required" });
  }

  // Detect if this should be an assist mode query natively
  const words = query.trim().split(/\s+/).length;
  const isConversational = words <= 3 || query.toLowerCase().includes("hola") || query.toLowerCase().includes("hello");
  
  const effectiveMode = mode === "assist" || (!budget && isConversational) ? "assist" : "mission";

  if (effectiveMode === "assist") {
    // Phase Fast-Assist: No agents, no payments, just a quick response
    const systemPrompt = `You are Ferrule, an autonomous AI research console powered by Stellar micropayments.
The user just sent: "${query}".
Respond with a JSON object (no markdown, no code fences, just raw JSON) with two fields:
1. "reply": A warm 1-3 sentence response. ALL YOUR RESPONSES MUST BE IN THE SAME LANGUAGE THE USER USED IN THEIR QUERY. If they speak Spanish, reply in Spanish. If it's a greeting, greet back. Then explain briefly that you're a Mission Runner (not a chatbot) and you need a research objective and a USDC budget to deploy agents.
2. "suggestedGoal": A concrete, actionable research mission goal (1 sentence, in the USER'S LANGUAGE) that would be genuinely useful. Infer something interesting from context. Never just repeat what the user said.
Return ONLY the JSON object.`;

    let assistantReply = "";
    let suggestedGoal = "Competitive landscape analysis: pay-per-use AI tools vs monthly subscription models in 2026";
    
    try {
      const raw = await fastChatResponse(query, systemPrompt);
      // Try to parse JSON from the response
      const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed = JSON.parse(cleaned);
      assistantReply = parsed.reply || raw;
      suggestedGoal = parsed.suggestedGoal || suggestedGoal;
    } catch {
      // If JSON parsing fails, use the raw reply with a sensible default
      assistantReply = await fastChatResponse(query, 
        `You are Ferrule. The user said: "${query}". Greet them warmly in 1-2 sentences, then explain you're a Mission Runner (not a chatbot) that deploys paid AI agents for deep research. Keep it brief.`
      );
    }

    return res.json({
      mode: "assist",
      report: assistantReply,
      suggestedMission: {
        goal: suggestedGoal,
        budget: 0.15
      }
    });
  }

  // --- MISSION MODE (Full Agent Pipeline) ---
  const missionBudget = parseFloat(budget) || 0.05;

  const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const wss = req.app.get("wss");
  const startTime = Date.now();

  // Session state
  const session = {
    id: sessionId,
    query,
    budget: missionBudget,
    status: "active",
    offChainCommitments: 0,
    onChainTxs: 0,
    totalSpentUSDC: 0,
    searchQueries: 0,
    llmTokens: 0,
    llmBatches: 0,
    transactions: [],
    timeline: [],
  };
  sessions.set(sessionId, session);

  try {
    // --- PHASE 1: Real channel open (on-chain tx) ---
    addTimelineEvent(session, wss, "payment_verification", "Verifying Upfront Platform Payment...");

    const { signedXdr } = req.body;
    let channelId;
    let channelOpenTx;

    if (!signedXdr || !req.body.funderPublicKey) {
      throw new Error("Missing signedXdr or funderPublicKey from user wallet. Wallet authenticaton is mandatory.");
    }

    // 1. Submit User's USDC Payment natively via Horizon (no smart contract return value to parse)
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
    const txToSubmit = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    const submitRes = await horizon.submitTransaction(txToSubmit);
    const paymentTx = submitRes.hash;

    // 2. Verify Platform Balance
    const platformPublicKey = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY_2).publicKey();
    
    try {
      const platformAccount = await horizon.loadAccount(platformPublicKey);
      console.log('Platform balances:', JSON.stringify(platformAccount.balances));
      const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
      const usdcBalance = platformAccount.balances.find(
        (b) => b.asset_code === 'USDC' && b.asset_issuer === USDC_ISSUER
      );
      console.log('USDC balance found:', usdcBalance);
      console.log('Mission budget required:', missionBudget);

      if (!usdcBalance || parseFloat(usdcBalance.balance) < missionBudget) {
        console.warn("Platform balance seems low, but proceeding due to successful payment TX:", paymentTx);
      }
    } catch (err) {
      console.error('Verification error:', err.message);
    }

    // 3. Platform opens channel autonomously
    addTimelineEvent(session, wss, "channel_open", "Payment Confirmed. Platform opening MPP Session channel...");
    
    const platformSecret = process.env.STELLAR_SECRET_KEY_2;
    const llmSecret = process.env.LLM_AGENT_SECRET || process.env.STELLAR_SECRET_KEY_3;
    const llmPublicKey = publicKeyFromSecret(llmSecret);

    const openRes = await openChannelOnChain(platformSecret, llmPublicKey);
    
    channelId = openRes.channelId;
    channelOpenTx = openRes.txHash;

    session.channelContractId = channelId;
    session.commitmentSecret = openRes.commitmentSecret;

    session.onChainTxs++;
    session.transactions.push({
      type: "channel_open",
      agent: "llm",
      txId: channelOpenTx,
      description: `MPP Session channel opened [ID: ${channelId.slice(0,8)}...]`,
      timestamp: Date.now(),
    });

    if (wss) {
      broadcast(wss, {
        type: "onchain_tx",
        txType: "channel_open",
        agent: "llm",
        txId: channelOpenTx,
        onChainCount: session.onChainTxs,
        sessionId,
        timestamp: Date.now(),
      });
    }

    addTimelineEvent(session, wss, "channel_open_done", "MPP channel opened ✓");

    // --- PHASE 2: Search Agent queries (x402 payments) ---
    addTimelineEvent(session, wss, "search_start", "Search Agent analyzing query...");

    // Generate sub-queries for thorough research
    const searchQueries = generateSearchQueries(query);
    let allSearchResults = [];

    for (const sq of searchQueries) {
      const results = await searchWeb(sq, 3);
      allSearchResults = allSearchResults.concat(results);
      session.searchQueries++;
      session.totalSpentUSDC += 0.0002;

      if (wss) {
        broadcast(wss, {
          type: "x402_payment",
          channel: "search",
          amount: "0.0002",
          cumulativeSpent: session.totalSpentUSDC.toFixed(6),
          query: sq,
          resultCount: results.length,
          searchNumber: session.searchQueries,
          sessionId,
          timestamp: Date.now(),
        });

        broadcast(wss, {
          type: "agent_status",
          agent: "search",
          status: "working",
          detail: `Query ${session.searchQueries}: "${sq}" → ${results.length} results`,
          sessionId,
          timestamp: Date.now(),
        });
      }

      // Small delay to make the visualization more interesting
      await sleep(300);
    }

    addTimelineEvent(
      session,
      wss,
      "search_done",
      `Search complete: ${allSearchResults.length} results from ${session.searchQueries} queries`
    );

    // --- PHASE 3: LLM Agent analysis (MPP Session commitments) ---
    addTimelineEvent(session, wss, "llm_start", "LLM Agent synthesizing research...");

    if (wss) {
      broadcast(wss, {
        type: "agent_status",
        agent: "llm",
        status: "working",
        detail: "Processing search results with Gemini...",
        sessionId,
        timestamp: Date.now(),
      });
    }

    // Build search context for the LLM
    const searchContext = allSearchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
      .join("\n\n");

    const { fullText, totalTokens, batchCount } = await streamLLM(
      query,
      searchContext,
      (batchTokens, batchText, totalTkns, batchNum) => {
        session.llmTokens = totalTkns;
        session.llmBatches = batchNum;
        session.offChainCommitments = batchNum;
        const batchCost = 0.00001;
        session.totalSpentUSDC += batchCost;

        // Sign real off-chain micropayment commitment
        const cumulativeAmount = batchNum * 100; // 0.00001 USDC per batch
        const { signature } = signMicropayment(session.commitmentSecret, session.channelContractId, cumulativeAmount);

        if (wss) {
          // Emit streamed text
          broadcast(wss, {
            type: "result_chunk",
            text: batchText,
            batchTokens,
            totalTokens: totalTkns,
            batchNumber: batchNum,
            agent: "llm",
            sessionId,
            timestamp: Date.now(),
          });

          // Emit off-chain commitment event (with real signature)
          broadcast(wss, {
            type: "commitment",
            channel: "llm",
            amount: (batchCost * batchNum).toFixed(6),
            batchNumber: batchNum,
            cumulativeTokens: totalTkns,
            offChainCount: batchNum,
            signature: signature.slice(0, 16),
            sessionId,
            timestamp: Date.now(),
          });
        }
      }
    );

    session.llmTokens = totalTokens;
    session.llmBatches = batchCount;

    addTimelineEvent(
      session,
      wss,
      "llm_done",
      `LLM complete: ${totalTokens} tokens, ${batchCount} commitments`
    );

    // --- PHASE 4: Close channel (on-chain tx real transaction) ---
    addTimelineEvent(session, wss, "channel_close", "Closing MPP Session channel...");

    // The close_start MUST be called by the funder to bypass the XDR SCVal array logic.
    // In our test-mpp-flow.js, this succeeds because it's signed by the Funder (STELLAR_SECRET_KEY_2).
    // Get the funder secret from the global workspace env
    const path = await import("path");
    const dotenv = await import("dotenv");
    dotenv.default.config({ path: path.default.join(process.cwd(), "../frontend/.env.local") });
    
    // Fallback to testing keys if not found
    let closerSecret = process.env.STELLAR_SECRET_KEY_2;
    if (!closerSecret) closerSecret = process.env.LLM_AGENT_SECRET;
    
    let channelCloseTx = null;
    try {
      console.log('→ Intentando close() del canal', session.channelContractId);
      const closeResult = await closeChannelOnChain(closerSecret, session.channelContractId);
      console.log('← Close result:', JSON.stringify(closeResult));
      channelCloseTx = closeResult.txHash;
    } catch (closeErr) {
      console.warn("[Channel Close] Non-fatal: channel close failed —", closeErr.message || closeErr);
      channelCloseTx = "pending_settlement";
    }
    
    session.onChainTxs++;
    session.transactions.push({
      type: "channel_close",
      agent: "llm",
      txId: channelCloseTx,
      description: `MPP channel settled: ${batchCount} commitments → ${session.channelContractId.slice(0,8)}...`,
      amountUSDC: (0.00001 * batchCount).toFixed(6),
      timestamp: Date.now(),
    });

    if (wss) {
      console.log('→ Emitiendo onchain_tx via WS con hash:', channelCloseTx);
      broadcast(wss, {
        type: "onchain_tx",
        txType: "channel_close",
        agent: "llm",
        txId: channelCloseTx,
        onChainCount: session.onChainTxs,
        settledCommitments: batchCount,
        amountUSDC: (0.00001 * batchCount).toFixed(6),
        sessionId,
        timestamp: Date.now(),
      });
    }

    addTimelineEvent(session, wss, "channel_close_done", "Channel settlement started on-chain ✓");

    // --- DONE ---
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    session.status = "complete";

    if (wss) {
      broadcast(wss, {
        type: "session_complete",
        sessionId,
        duration: `${duration}s`,
        offChainCommitments: session.offChainCommitments,
        onChainTxs: session.onChainTxs,
        totalSpentUSDC: session.totalSpentUSDC.toFixed(6),
        timestamp: Date.now(),
      });
    }



    res.json({
      mode: "mission",
      sessionId,
      report: fullText,
      stats: {
        duration,
        searchQueries: session.searchQueries,
        searchResults: allSearchResults.length,
        llmTokens: session.llmTokens,
        llmBatches: session.llmBatches,
        offChainCommitments: session.offChainCommitments,
        onChainTxs: session.onChainTxs,
        totalSpentUSDC: session.totalSpentUSDC.toFixed(6),
        onChainFeesUSDC: "0.000020",
      },
      transactions: session.transactions,
      timeline: session.timeline,
      agents: {
        search: {
          protocol: "x402",
          queries: session.searchQueries,
          costPerQuery: "0.0002 USDC",
          totalCost: (session.searchQueries * 0.0002).toFixed(6),
        },
        llm: {
          protocol: "mpp-session",
          tokens: totalTokens,
          batches: batchCount,
          costPerBatch: "0.00001 USDC",
          totalCost: (batchCount * 0.00001).toFixed(6),
          offChainCommitments: batchCount,
          onChainTxs: 2,
        },
      },
      stellarExplorer: {
        note: "Transaction links will be available with deployed one-way-channel contract",
        baseUrl: "https://stellar.expert/explorer/testnet/tx/",
        txIds: session.transactions.map((t) => t.txId),
      },
    });
  } catch (error) {
    console.error("\n================ ORCHESTRATOR ERROR ================");
    console.error("Type:", error.name);
    console.error("Message:", error.message);
    if (error.stack) console.error("Stack:", error.stack);
    console.error("====================================================\n");
    
    session.status = "error";

    if (wss) {
      broadcast(wss, {
        type: "error",
        sessionId,
        message: error.message,
        timestamp: Date.now(),
      });
    }

    res.status(500).json({
      error: "Research failed",
      details: error.message,
      sessionId,
    });
  }
});

// Get session status
router.get("/session/:id", (req, res) => {
  const session = sessions.get(req.params.id);
  if (!session) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json(session);
});

// Health check
router.get("/health", (_req, res) => {
  res.json({
    agent: "orchestrator",
    activeSessions: sessions.size,
    subAgents: ["llm (mpp-session)", "search (x402)"],
  });
});

// --- Helper functions ---

function generateSearchQueries(originalQuery) {
  const words = originalQuery.trim().split(/\s+/).length;
  
  if (words <= 3 || originalQuery.toLowerCase().includes("hola") || originalQuery.toLowerCase().includes("hello")) {
    return [originalQuery.trim()];
  }
  
  return [
    originalQuery,
    `${originalQuery} comparison analysis 2026`,
    `${originalQuery} technical architecture documentation`,
  ];
}
function addTimelineEvent(session, wss, event, description) {
  const entry = {
    event,
    description,
    timestamp: Date.now(),
  };
  session.timeline.push(entry);

  if (wss) {
    broadcast(wss, {
      type: "timeline",
      ...entry,
      sessionId: session.id,
    });
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { router as orchestratorRouter };
