import { Router } from "express";
import { createRequire } from "module";

const _require = createRequire(import.meta.url);
const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Horizon,
  Asset,
  Operation,
} = _require("@stellar/stellar-sdk");

const HORIZON_URL = "https://horizon-testnet.stellar.org";
const FRIENDBOT_URL = "https://friendbot.stellar.org";
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const faucetRouter = Router();

/**
 * POST /api/faucet
 * Body: { publicKey: string }
 * 
 * Streams SSE events with real-time progress:
 *   1. Friendbot → 10,000 XLM
 *   2. Add USDC trustline
 *   3. Path payment: swap XLM → USDC via DEX
 */
faucetRouter.post("/", async (req, res) => {
  const { publicKey } = req.body;

  if (!publicKey || typeof publicKey !== "string" || publicKey.length !== 56) {
    return res.status(400).json({ error: "Invalid publicKey" });
  }

  // SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (step, status, detail, extra = {}) => {
    const payload = JSON.stringify({ step, status, detail, ...extra });
    res.write(`data: ${payload}\n\n`);
  };

  const horizon = new Horizon.Server(HORIZON_URL);
  const usdc = new Asset("USDC", USDC_ISSUER);

  try {
    // ═══════════════════════════════════════════════
    // STEP 1: Friendbot — Claim 10,000 XLM
    // ═══════════════════════════════════════════════
    send("friendbot", "running", "Requesting 10,000 XLM from Stellar Friendbot…");

    let alreadyFunded = false;
    try {
      const fbRes = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
      if (fbRes.ok) {
        send("friendbot", "success", "10,000 XLM credited to wallet", { xlm: "10000" });
      } else {
        const errorText = await fbRes.text();
        // Friendbot returns 400 if already funded — that's OK
        if (errorText.includes("createAccountAlreadyExist") || fbRes.status === 400) {
          alreadyFunded = true;
          send("friendbot", "success", "Wallet already funded with XLM (skipped)", { xlm: "exists" });
        } else {
          throw new Error(`Friendbot error: ${fbRes.status}`);
        }
      }
    } catch (e) {
      if (alreadyFunded) {
        send("friendbot", "success", "Wallet already exists on testnet", { xlm: "exists" });
      } else {
        send("friendbot", "error", `Friendbot failed: ${e.message}`);
        send("done", "error", "Faucet aborted at Step 1");
        return res.end();
      }
    }

    // Small delay for UX
    await sleep(800);

    // ═══════════════════════════════════════════════
    // STEP 2: Add USDC Trustline
    // ═══════════════════════════════════════════════
    send("trustline", "running", "Checking USDC trustline…");

    // Check if trustline already exists
    let hasTrustline = false;
    try {
      const account = await horizon.loadAccount(publicKey);
      hasTrustline = account.balances.some(
        (b) => b.asset_type !== "native" && b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
      );
    } catch (e) {
      send("trustline", "error", `Failed to load account: ${e.message}`);
      send("done", "error", "Faucet aborted at Step 2");
      return res.end();
    }

    if (hasTrustline) {
      send("trustline", "success", "USDC trustline already active (skipped)");
    } else {
      send("trustline", "running", "Submitting USDC trustline transaction…");

      // We need the user's secret key to sign. For testnet faucet,
      // we use a server-side approach: build TX, user signs client-side.
      // But since this is for ANY wallet, we'll use a workaround:
      // The frontend sends the publicKey, and if the user wants full automation,
      // they'll need to have connected via Freighter which can sign.
      // 
      // For the hackathon demo, we'll sign with the orchestrator and
      // create a merge—actually, the user needs to sign trustline for THEIR account.
      // We'll return an unsigned XDR for the frontend to sign.
      
      try {
        const account = await horizon.loadAccount(publicKey);
        const tx = new TransactionBuilder(account, {
          fee: BASE_FEE,
          networkPassphrase: Networks.TESTNET,
        })
          .addOperation(
            Operation.changeTrust({
              asset: usdc,
            })
          )
          .setTimeout(30)
          .build();

        send("trustline", "sign_required", "Trustline transaction ready — requesting wallet signature", {
          xdr: tx.toXDR(),
        });
        
        // The frontend will sign and submit, then call us back.
        // For full server-side flow, we pause here and wait for the confirmation.
        // But with SSE we can't receive data back, so we move on.
        // The frontend handles signing and submitting in parallel.
      } catch (e) {
        send("trustline", "error", `Failed to build trustline TX: ${e.message}`);
        send("done", "error", "Faucet aborted at Step 2");
        return res.end();
      }
    }

    await sleep(500);

    // ═══════════════════════════════════════════════
    // STEP 3: Swap XLM → USDC via Stellar DEX
    // ═══════════════════════════════════════════════
    send("swap", "running", "Preparing XLM → USDC swap via Stellar DEX…");

    try {
      // Query available paths
      send("swap", "running", "Querying DEX for best XLM → USDC path…");

      // Build a strict-send path payment: send 100 XLM, receive minimum USDC
      const xlmToSwap = "100"; // Swap 100 XLM for USDC
      
      // Check available paths on the DEX
      let paths;
      try {
        paths = await horizon
          .strictSendPaths(Asset.native(), xlmToSwap, [usdc])
          .call();
      } catch {
        // If no strict-send paths, that's ok—we'll use a direct path payment
        paths = null;
      }

      let destMin = "0.01"; // Minimum USDC to accept
      if (paths && paths.records && paths.records.length > 0) {
        destMin = paths.records[0].destination_amount;
        send("swap", "running", `DEX route found: ${xlmToSwap} XLM → ~${parseFloat(destMin).toFixed(2)} USDC`);
      } else {
        send("swap", "running", `Using direct path payment: ${xlmToSwap} XLM → USDC`);
      }

      // Build the path payment transaction
      const account = await horizon.loadAccount(publicKey);
      const swapTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: Networks.TESTNET,
      })
        .addOperation(
          Operation.pathPaymentStrictSend({
            sendAsset: Asset.native(),
            sendAmount: xlmToSwap,
            destination: publicKey,
            destAsset: usdc,
            destMin: "0.0000001", // Accept any amount (testnet)
            path: paths?.records?.[0]?.path?.map(p => new Asset(p.asset_code, p.asset_issuer)) || [],
          })
        )
        .setTimeout(30)
        .build();

      send("swap", "sign_required", `Swap transaction ready: ${xlmToSwap} XLM → USDC — requesting signature`, {
        xdr: swapTx.toXDR(),
        xlmAmount: xlmToSwap,
        estimatedUsdc: destMin,
      });

    } catch (e) {
      send("swap", "error", `DEX swap failed: ${e.message}`);
    }

    await sleep(300);
    send("done", "complete", "All faucet steps prepared");
    res.end();

  } catch (e) {
    send("done", "error", `Unexpected error: ${e.message}`);
    res.end();
  }
});

/**
 * POST /api/faucet/submit
 * Body: { signedXdr: string }
 * 
 * Submits a signed transaction to Stellar testnet.
 */
faucetRouter.post("/submit", async (req, res) => {
  const { signedXdr } = req.body;

  if (!signedXdr) {
    return res.status(400).json({ error: "Missing signedXdr" });
  }

  try {
    const horizon = new Horizon.Server(HORIZON_URL);
    const { TransactionBuilder: TB } = _require("@stellar/stellar-sdk");
    const tx = TB.fromXDR(signedXdr, Networks.TESTNET);
    const result = await horizon.submitTransaction(tx);
    
    res.json({
      success: true,
      hash: result.hash,
      ledger: result.ledger,
    });
  } catch (e) {
    const extras = e?.response?.data?.extras;
    res.status(400).json({
      success: false,
      error: e.message,
      resultCodes: extras?.result_codes || null,
    });
  }
});

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
