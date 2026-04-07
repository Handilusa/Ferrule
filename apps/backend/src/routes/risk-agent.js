import { Router } from "express";
import { streamRiskAnalysis } from "../services/gemini.js";
import { Keypair, Asset, TransactionBuilder, Networks, Horizon, Operation } from "@stellar/stellar-sdk";

const router = Router();

router.post("/", async (req, res) => {
  const { report, sources, directive = "", sessionId } = req.body;
  if (report == null || sources == null) {
    return res.status(400).json({ error: `Missing report or sources. Received report length: ${report?.length}, sources length: ${sources?.length}` });
  }

  const wss = req.app.get("wss");
  if (wss && sessionId) {
    req.app.get("broadcast")(wss, {
      type: "agent_status",
      agent: "risk",
      status: "working",
      detail: "Analyzing preliminary report for risk gaps...",
      sessionId,
      timestamp: Date.now(),
    });
  }

  try {
    let analysis = await streamRiskAnalysis(report, sources, null, directive);
    const gaps = analysis.gaps || [];

    let additionalSources = [];
    let riskSearches = 0;
    
    // Auto-spawn search if there are critical gaps
    if (gaps.length > 0) {
      if (wss && sessionId) {
         req.app.get("broadcast")(wss, {
          type: "agent_status",
          agent: "risk",
          status: "gap_detected",
          detail: `Gaps detected: ${gaps.length}. Triggering autonomous x402 search.`,
          sessionId,
          timestamp: Date.now(),
        });
      }

      // We combine gaps into one query to avoid too many searches
      const gapQuery = gaps.join(" ");
      const searchUrl = `http://localhost:${process.env.PORT || 3000}/api/search`;
      
      const firstTry = await fetch(searchUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: gapQuery, maxResults: 3 })
      });
      
      let reqHeaders = { "Content-Type": "application/json" };
      let paymentTxId = null;

      if (firstTry.status === 402) {
         // Create the payment on chain using the Risk Agent's own wallet
         const riskSecret = process.env.RISK_AGENT_PRIVATE_KEY;
         if (!riskSecret) throw new Error("Missing RISK_AGENT_PRIVATE_KEY");
         const riskKp = Keypair.fromSecret(riskSecret);
         
         const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
         const account = await horizon.loadAccount(riskKp.publicKey());
         const usdcAsset = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
         
         const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
           .addOperation(Operation.payment({
             destination: process.env.SEARCH_AGENT_PUBLIC_KEY,
             asset: usdcAsset,
             amount: "0.0002"
           })).setTimeout(30).build();

         tx.sign(riskKp);
         const submitRes = await horizon.submitTransaction(tx);
         paymentTxId = submitRes.hash;
         
         reqHeaders["Authorization"] = `L402 test_macaroon:${paymentTxId}`;
      }

      if (wss && sessionId) {
         req.app.get("broadcast")(wss, {
          type: "agent_status",
          agent: "risk",
          status: "re_searching",
          detail: "Executing autonomous agent-to-agent x402 payment...",
          sessionId,
          timestamp: Date.now(),
        });
      }

      const resSearch = await fetch(searchUrl, {
        method: "POST",
        headers: reqHeaders,
        body: JSON.stringify({ query: gapQuery, maxResults: 3 })
      });
      
      const searchData = await resSearch.json();
      additionalSources = searchData.results || [];
      riskSearches = 1;

       if (wss && sessionId && paymentTxId) {
          req.app.get("broadcast")(wss, {
            type: "x402_payment",
            channel: "risk",
            amount: "0.0002",
            query: gapQuery,
            resultCount: additionalSources.length,
            searchNumber: 1, // Only 1 gap search for simplicity
            sessionId,
            timestamp: Date.now(),
          });
          
          req.app.get("broadcast")(wss, {
            type: "onchain_tx",
            txType: "x402_payment_risk",
            agent: "risk",
            txId: paymentTxId,
            amountUSDC: "0.0002",
            sessionId,
            timestamp: Date.now()
          });
       }

      if (additionalSources.length > 0) {
        // Re-analyze with new sources
        const newSourcesText = additionalSources
           .map((r, i) => `[GAP SOURCE ${i + 1}] ${r.title}\n    URL: ${r.url}\n    ${r.snippet}`)
           .join("\n\n");
           
        analysis = await streamRiskAnalysis(report, sources + "\n\n" + newSourcesText, null, directive);
      }
    }

    if (wss && sessionId) {
       req.app.get("broadcast")(wss, {
        type: "agent_status",
        agent: "risk",
        status: "complete",
        detail: "Risk analysis complete.",
        sessionId,
        timestamp: Date.now(),
      });
    }

    return res.json({
       riskScore: analysis.riskScore,
       riskBreakdown: analysis.riskBreakdown,
       gaps: analysis.gaps,
       fullRiskReport: analysis.fullRiskReport,
       additionalSources,
       riskSearches
    });

  } catch (error) {
    console.error("[Risk Agent] Route error:", error);
    return res.status(500).json({ error: error.message });
  }
});

export { router as riskAgentRouter };
