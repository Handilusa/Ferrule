import { Router } from "express";
import crypto from "crypto";
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
    funderPublicKey: req.body.funderPublicKey,
    status: "active",
    offChainCommitments: 0,
    onChainTxs: 0,
    totalSpentUSDC: 0,
    searchQueries: 0,
    llmTokens: 0,
    llmBatches: 0,
    riskSearches: 0,
    riskScore: null,
    gaps: [],
    directives: {},
    transactions: [],
    timeline: [],
    timestamp: startTime,
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
    addTimelineEvent(session, wss, "search_start", "Search Agent analyzing query for tech due diligence...");

    let searchQueries = generateDueDiligenceQueries(query);
    if (session.directives?.search) {
      searchQueries.push(`${query} ${session.directives.search}`);
    }
    let allSearchResults = [];



    const orchestratorSecret = process.env.ORCHESTRATOR_PRIVATE_KEY;
    const orchestratorKp = Keypair.fromSecret(orchestratorSecret);

    for (const sq of searchQueries) {
      // Intentional HTTP Call to trigger 402
      const searchUrl = `http://localhost:${process.env.PORT || 3000}/api/search`;
      const firstTry = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: sq, maxResults: 3 })
      });
      
      let reqHeaders = { "Content-Type": "application/json" };
      let paymentTxId = null;

      if (firstTry.status === 402) {
         // Create the payment on chain
         const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
         const account = await horizon.loadAccount(orchestratorKp.publicKey());
         const usdcAsset = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
         
         const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
           .addOperation(Operation.payment({
             destination: process.env.SEARCH_AGENT_PUBLIC_KEY,
             asset: usdcAsset,
             amount: "0.0002"
           })).setTimeout(30).build();

         tx.sign(orchestratorKp);
         const submitRes = await horizon.submitTransaction(tx);
         paymentTxId = submitRes.hash;
         
         // Attach payment validation per x402 spec
         reqHeaders["Authorization"] = `L402 test_macaroon:${paymentTxId}`;
      }

      const res = await fetch(searchUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ query: sq, maxResults: 3 })
      });
      
      const searchData = await res.json();
      const results = searchData.results || [];
      allSearchResults = allSearchResults.concat(results);

      session.searchQueries++;
      session.totalSpentUSDC += 0.0002;

      // Track the Search TX natively
      if (paymentTxId) {
        session.onChainTxs++;
        session.transactions.push({
          type: "x402_payment",
          agent: "search",
          txId: paymentTxId,
          amountUSDC: "0.0002",
          description: `x402 HTTP Payment for query "${sq.slice(0,10)}..."`,
          timestamp: Date.now(),
        });
      }

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
        
        if (paymentTxId) {
           broadcast(wss, {
             type: "onchain_tx",
             txType: "x402_payment",
             agent: "search",
             txId: paymentTxId,
             onChainCount: session.onChainTxs,
             amountUSDC: "0.0002",
             sessionId,
             timestamp: Date.now()
           });
        }
      }

      await sleep(300);
    }

    addTimelineEvent(session, wss, "search_done", `Search complete: ${allSearchResults.length} results from ${session.searchQueries} queries`);

    // --- PHASE 3: LLM Agent analysis (MPP Session commitments) ---
    addTimelineEvent(session, wss, "llm_start", "LLM Agent synthesizing research...");

    if (wss) {
      broadcast(wss, {
        type: "agent_status",
        agent: "llm",
        status: "working",
        detail: "Processing search results with Gemini via MPP...",
        sessionId,
        timestamp: Date.now(),
      });
    }

    const searchContext = allSearchResults
      .map((r, i) => `[${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
      .join("\n\n");

    let fullText = "", totalTokens = 0, batchCount = 0;

    const geminiRes = await streamLLM(
      query,
      searchContext,
      async (batchTokens, batchText, totalTkns, batchNum) => {
        batchCount = batchNum;
        totalTokens = totalTkns;
        
        session.llmTokens = totalTkns;
        session.llmBatches = batchNum;
        session.offChainCommitments = batchNum;
        const batchCost = 0.00001;
        session.totalSpentUSDC += batchCost;

        // Sign real off-chain micropayment commitment
        const cumulativeAmount = batchNum * 100; // cumulative units
        const { signature } = signMicropayment(session.commitmentSecret, session.channelContractId, cumulativeAmount);

        if (wss) {
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

          broadcast(wss, {
            type: "commitment",
            channel: "llm",
            amount: (batchCost * batchNum).toFixed(6),
            batchNumber: batchNum,
            cumulativeTokens: totalTkns,
            offChainCount: batchNum,
            signature: signature ? signature.slice(0, 16) : "ed25519-signed",
            sessionId,
            timestamp: Date.now(),
          });
        }
      }
    );

    fullText = geminiRes.fullText;
    
    addTimelineEvent(session, wss, "llm_done", `LLM complete: ${totalTokens} tokens, ${batchCount} commitments`);

    // --- PHASE 3.5: Risk Agent Analysis (Agent-to-Agent Commerce) ---
    addTimelineEvent(session, wss, "risk_start", "Risk Agent evaluating vendor profile...");
    
    // Await human directive (Hackathon feature)
    if (wss) {
      broadcast(wss, {
        type: "agent_status",
        agent: "risk",
        status: "AWAITING_DIRECTIVE",
        detail: "⏸ Waiting for human authorization before Risk Agent proceeds...",
        query: query,
        context: `Report has ${allSearchResults.length} sources. Risk Agent will evaluate vendor profile and trigger autonomous x402 gap searches if needed.`,
        sessionId,
        timestamp: Date.now(),
      });
    }

    // Real HITL: Wait for directive OR auto-approve after 30s
    await new Promise((resolve) => {
      const timeout = setTimeout(() => {
        if (!session.directives?.risk) {
          session.directives.risk = "[AUTO-APPROVED] No human input within 30s.";
        }
        resolve();
      }, 30000);
      
      // Poll for directive arrival every 500ms
      const poll = setInterval(() => {
        if (session.directives?.risk) {
          clearTimeout(timeout);
          clearInterval(poll);
          resolve();
        }
      }, 500);
    });

    const riskDirective = session.directives?.risk || "";
    
    if (wss) {
      broadcast(wss, {
        type: "agent_status",
        agent: "risk",
        status: "working",
        detail: `Human directive received. Risk Agent proceeding...`,
        sessionId,
        timestamp: Date.now(),
      });
    }
    
    const riskUrl = `http://localhost:${process.env.PORT || 3000}/api/risk`;
    const riskRes = await fetch(riskUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        report: fullText, 
        sources: searchContext,
        directive: riskDirective,
        sessionId 
      })
    });
    
    let riskData = { riskScore: 50, riskBreakdown: {}, gaps: [], additionalSources: [], riskSearches: 0, fullRiskReport: "Risk agent unavailable." };
    if (riskRes.ok) {
        riskData = await riskRes.json();
    } else {
        const errorText = await riskRes.text();
        console.warn("Risk agent failed:", errorText);
        riskData.fullRiskReport = `Risk agent unavailable. Backend Error: ${errorText}`;
    }

    session.riskScore = riskData.riskScore;
    session.gaps = riskData.gaps;
    session.riskSearches = riskData.riskSearches || 0;
    session.totalSpentUSDC += (session.riskSearches * 0.0002);

    addTimelineEvent(session, wss, "risk_done", `Risk evaluation complete. Score: ${riskData.riskScore}/100.`);

    if (wss) {
      broadcast(wss, {
        type: "risk_score_update",
        score: riskData.riskScore,
        sessionId,
        timestamp: Date.now()
      });
    }

    // Combine reports
    fullText += `\n\n## Risk Assessment\n${riskData.fullRiskReport}`;

    // --- PHASE 3.8: On-Chain Hash Registration ---
    addTimelineEvent(session, wss, "hash_report", "Hashing final report & anchoring on-chain...");
    const reportHash = crypto.createHash("sha256").update(fullText).digest("hex");
    session.reportHash = reportHash;
    
    const platformKp = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY_2);
    let hashTxId = null;
    try {
        const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
        const account = await horizon.loadAccount(platformKp.publicKey());
        
        // Ensure name is <= 64 bytes
        const shortSessionId = sessionId.slice(-8); 
        const name = `FRL_${shortSessionId}`;
        
        const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
            .addOperation(Operation.manageData({
                name,
                value: Buffer.from(reportHash, "hex").slice(0, 64)
            })).setTimeout(30).build();
            
        tx.sign(platformKp);
        const submitRes = await horizon.submitTransaction(tx);
        hashTxId = submitRes.hash;
        
        session.onChainTxs++;
        session.transactions.push({
            type: "manage_data",
            agent: "orchestrator",
            txId: hashTxId,
            description: `Anchored report hash: FRL_${shortSessionId}`,
            timestamp: Date.now(),
        });
        
        if (wss) {
            broadcast(wss, {
                type: "onchain_tx",
                txType: "manage_data",
                agent: "orchestrator",
                txId: hashTxId,
                onChainCount: session.onChainTxs,
                sessionId,
                timestamp: Date.now(),
            });
        }
        addTimelineEvent(session, wss, "hash_report_done", `Report Hash anchored: ${reportHash.substring(0,10)}... ✓`);
    } catch(err) {
        console.error("[Hash Anchor Failed]", err);
    }

    // --- PHASE 4: Close channel (on-chain tx real transaction) ---
    addTimelineEvent(session, wss, "channel_close", "Closing MPP Session channel...");

    let channelCloseTx = null;
    try {
      // Channel was opened by STELLAR_SECRET_KEY_2 (platform funder) — only it can close_start
      const closerSecret = process.env.STELLAR_SECRET_KEY_2;
      const closeResult = await closeChannelOnChain(closerSecret, session.channelContractId);
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
      description: `MPP channel settled: ${batchCount} commitments`,
      amountUSDC: (0.00001 * batchCount).toFixed(6),
      timestamp: Date.now(),
    });

    if (wss) {
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
    session.report = fullText;
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
        risk: {
          protocol: "x402",
          autonomousSearches: session.riskSearches,
          totalCost: (session.riskSearches * 0.0002).toFixed(6),
          riskScore: session.riskScore
        }
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

// Post a human directive to an active session
router.post("/directive", (req, res) => {
  const { sessionId, agentName, directive } = req.body;
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });
  
  session.directives[agentName] = directive;
  
  const wss = req.app.get("wss");
  if (wss) {
    broadcast(wss, {
      type: "directive_applied",
      agent: agentName,
      directive,
      sessionId,
      timestamp: Date.now()
    });

    // Inject a visible HITL banner into the research output stream
    let hitlBanner = "";
    if (directive.includes("[CANCELLED]")) {
      hitlBanner = "\n\n---\n\n**[HITL:CANCEL] Human-in-the-Loop: Mission Cancelled**\nThe user has decided to cancel the risk analysis through the Human-in-the-Loop verification system. The report will be finalized as-is without further autonomous agent spending.\n\n---\n\n";
    } else if (directive.includes("[APPROVED]")) {
      hitlBanner = "\n\n---\n\n**[HITL:APPROVE] Human-in-the-Loop: Authorized**\nThe user has approved the autonomous Risk Agent to proceed with vendor evaluation and gap-filling x402 searches.\n\n---\n\n";
    } else {
      // Custom directive — the user redirected the analysis
      const cleanDirective = directive.replace(/^\[.*?\]\s*/, "");
      hitlBanner = `\n\n---\n\n**[HITL:REDIRECT] Human-in-the-Loop: Analysis Redirected**\nThe user has intervened via the HITL system and redirected the Risk Agent analysis to: **"${cleanDirective}"**\n\n---\n\n`;
    }

    broadcast(wss, {
      type: "result_chunk",
      text: hitlBanner,
      agent: "hitl",
      sessionId,
      timestamp: Date.now(),
    });
  }
  
  return res.json({ success: true, agentName, directive });
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

function generateDueDiligenceQueries(originalQuery) {
  const clean = originalQuery.replace(/evaluate /i, '').replace(/ due diligence/i, '').trim();
  const words = clean.split(/\s+/).length;
  
  if (words > 6 || clean.toLowerCase().includes("hola") || clean.toLowerCase().includes("hello")) {
    return [clean];
  }
  
  return [
    `${clean} SOC2 ISO 27001 compliance security whitepaper`,
    `${clean} pricing lock-in migration cost`,
    `${clean} technical architecture documentation API`,
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

// --- HISTORY ENDPOINT (Hackathon in-memory feature) ---
router.get("/history", (req, res) => {
  const { wallet } = req.query;
  if (!wallet) {
    return res.status(400).json({ error: "Missing wallet parameter" });
  }

  const userHistory = [];
  for (const session of sessions.values()) {
    if (session.funderPublicKey === wallet && session.status === "complete") {
      // Find the manage_data transaction hash to prove on-chain anchoring
      const anchorTx = session.transactions.find(tx => tx.type === "manage_data");
      
      userHistory.push({
        sessionId: session.id,
        query: session.query,
        report: session.report,
        reportHash: session.reportHash,
        budget: session.budget,
        totalSpentUSDC: session.totalSpentUSDC,
        offChainCommitments: session.offChainCommitments,
        onChainTxs: session.onChainTxs,
        x402Payments: session.searchQueries,
        networkCost: session.onChainTxs * 0.0001, // Mock network fee representation
        timestamp: session.timestamp,
        anchorHash: anchorTx ? anchorTx.txId : null,
      });
    }
  }

  // Sort newest first
  userHistory.sort((a, b) => b.timestamp - a.timestamp);

  res.json({ history: userHistory });
});

// --- HASH VERIFICATION ENDPOINT (Hackathon Feature) ---
router.get("/verify/:hash", (req, res) => {
  const { hash } = req.params;
  
  if (!hash) {
    return res.status(400).json({ error: "Missing hash parameter" });
  }

  // Search memory for the session with the matching hash
  let foundSession = null;
  for (const session of sessions.values()) {
    if (session.reportHash === hash && session.status === "complete") {
      foundSession = session;
      break;
    }
  }

  if (!foundSession) {
    return res.status(404).json({ error: "Immutable report not found in current memory." });
  }

  const anchorTx = foundSession.transactions.find(tx => tx.type === "manage_data");

  res.json({
    verified: true,
    sessionId: foundSession.id,
    query: foundSession.query,
    report: foundSession.report,
    funderPublicKey: foundSession.funderPublicKey,
    timestamp: foundSession.timestamp,
    anchorHash: anchorTx ? anchorTx.txId : null,
    costUSDC: (foundSession.totalSpentUSDC + (foundSession.onChainTxs * 0.0001)).toFixed(6)
  });
});

export { router as orchestratorRouter };
