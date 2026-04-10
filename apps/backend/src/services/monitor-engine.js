import { deactivateMonitor, saveMonitors } from "./monitor-store.js";
import { sendMonitorAlert } from "./telegram.js";
import { fastChatResponse, streamRiskAnalysis } from "./gemini.js";
import { recordMission } from "./registry.js";
import { getPriceData } from "./price-feed.js";
import { computeIndicators, buildMarketPrompt, detectSignal } from "./technical-analysis.js";
import { Keypair, Asset, TransactionBuilder, Networks, Horizon, Operation } from "@stellar/stellar-sdk";

// Helper for backend URL
const backendUrl = () => `http://localhost:${process.env.PORT || 3000}`;

const SEARCH_COST = 0.0002;
const LLM_COST = 0.005;

/**
 * Runs one monitoring cycle matching the Double Layer logic.
 */
export async function runMonitorCycle(monitor) {
  try {
    // 1. Budget check
    if (monitor.spentUsdc + SEARCH_COST + LLM_COST > monitor.budgetUsdc) {
      console.log(`[Monitor ${monitor.id}] Budget exhausted.`);
      await deactivateMonitor(monitor.id);
      if (monitor.telegramChatId) {
        // Send a direct message manually about budget
        const { bot } = await import("./telegram.js").catch(() => ({}));
        if (bot) {
           // We'll let the user know via telegram
           // This requires a direct API call or extending telegram.js
        }
      }
      return;
    }

    // 2. x402 Search
    const orchestratorSecret = process.env.ORCHESTRATOR_PRIVATE_KEY;
    const orchestratorKp = Keypair.fromSecret(orchestratorSecret);
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
    const account = await horizon.loadAccount(orchestratorKp.publicKey());
    
    const usdcAsset = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
    const query = `${monitor.pair} price support resistance volatility latest news`;

    const tx = new TransactionBuilder(account, { fee: "1000", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.payment({
        destination: process.env.SEARCH_AGENT_PUBLIC_KEY,
        asset: usdcAsset,
        amount: SEARCH_COST.toString()
      })).setTimeout(30).build();

    tx.sign(orchestratorKp);
    const submitRes = await horizon.submitTransaction(tx);
    const paymentTxId = submitRes.hash;

    const resSearch = await fetch(`${backendUrl()}/api/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Payment": JSON.stringify({ 
           x402Version: 1, 
           scheme: "exact",
           network: "stellar-testnet",
           payload: { transaction: paymentTxId } 
        })
      },
      body: JSON.stringify({ query, maxResults: 3 })
    });
    
    if (!resSearch.ok) throw new Error("Search failed");
    const searchData = await resSearch.json();
    const results = searchData.results || [];
    monitor.spentUsdc += SEARCH_COST;

    const searchContext = results.map(r => `${r.title}\n${r.snippet}`).join("\n\n");

    // 3. Layer 1: Fast Triage
    const systemPromptL1 = `You are a trading signal triage AI. Given the following news/data for the pair ${monitor.pair}, determine if there are significant price movements, new support/resistance breaks, or critical news. Respond ONLY with "YES" or "NO".`;
    const responseL1 = await fastChatResponse(searchContext, systemPromptL1);
    
    monitor.lastRun = Date.now();

    // 4. Layer 2: Deep Risk Analysis
    if (responseL1.trim().toUpperCase().includes("YES")) {
      console.log(`[Monitor ${monitor.id}] Layer 1 detected signal. Running Quant Engine...`);
      
      const priceData = await getPriceData(monitor.pair);
      const indicators = computeIndicators(priceData.ohlcv);
      
      // Mock news mapping
      const news = results.map(r => ({ title: r.title, source: r.url }));
      const quantPrompt = buildMarketPrompt(monitor.pair, priceData, indicators, news);

      const analysis = await streamRiskAnalysis(
        quantPrompt,
        searchContext,
        null, // No previous context needed for monitor tick
        "mode: trading_monitor"
      );
      
      monitor.spentUsdc += LLM_COST;
      
      // 5. Signal Detection
      const signals = detectSignal(indicators, priceData);
      const primarySignal = signals.length > 0 ? signals[0] : { type: "NONE", msg: "Sin señales automáticas detectadas" };
      
      // 6. Telegram Alert
      if (monitor.telegramChatId) {
        await sendMonitorAlert(monitor.telegramChatId, {
          monitorId: monitor.id,
          pair: monitor.pair,
          priceData,
          indicators,
          primarySignal,
          budgetLeft: (monitor.budgetUsdc - monitor.spentUsdc).toFixed(4),
          sha256: paymentTxId, // REAL X402 STELLAR TX
          reportMarkdown: analysis.fullRiskReport
        });
        monitor.signalsCount++;
      }
      
      monitor.history.push({ ts: Date.now(), signal: primarySignal.type, analysis });

      // 7. Record Mission
      await recordMission("ferrule.quant", true); 
    } else {
        console.log(`[Monitor ${monitor.id}] Layer 1 triage skipped Deep Analysis.`);
        monitor.history.push({ ts: Date.now(), signal: "NO_SIGNAL", triage: responseL1 });
    }
    
    // Persist mutated monitor state
    saveMonitors();
  } catch (err) {
    console.error(`[Monitor ${monitor.id}] Cycle failed:`, err);
  }
}
