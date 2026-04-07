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

    // Small delay for UX and ledger propagation
    await sleep(1500);

    // ═══════════════════════════════════════════════
    // STEP 2: Add USDC Trustline
    // ═══════════════════════════════════════════════
    send("trustline", "running", "Checking USDC trustline status…");

    let hasTrustline = false;
    let accountExists = false;
    let account = null;

    try {
      account = await horizon.loadAccount(publicKey);
      accountExists = true;
      hasTrustline = account.balances.some(
        (b) => b.asset_type !== "native" && b.asset_code === "USDC" && b.asset_issuer === USDC_ISSUER
      );
    } catch (e) {
      if (e.response && e.response.status === 404) {
        // Account not found yet — definitely no trustline
        accountExists = false;
        hasTrustline = false;
        send("trustline", "running", "Account created but not yet visible on Horizon…");
      } else {
        send("trustline", "error", `Failed to check trustline: ${e.message}`);
        send("done", "error", "Faucet aborted at Step 2");
        return res.end();
      }
    }

    if (hasTrustline) {
      send("trustline", "success", "USDC trustline already active (skipped)");
    } else {
      send("trustline", "running", "Preparing USDC trustline transaction…");
      
      try {
        // If account didn't exist yet, we must retry loading it or use a default one-time check
        if (!accountExists) {
          // Wait a bit more for Friendbot account creation to propagate
          await sleep(2000);
          account = await horizon.loadAccount(publicKey);
        }

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

        send("trustline", "sign_required", "Trustline ready — Signature required", {
          xdr: tx.toXDR(),
        });
      } catch (e) {
        send("trustline", "error", `Failed to build trustline TX: ${e.message}. Pro-tip: Try again in 5s.`);
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
      // Reload account if needed to ensure we have the correct sequence number
      if (!account) {
        try {
          account = await horizon.loadAccount(publicKey);
        } catch (e) {
          // If still 404, we have a major propagation issue
          send("swap", "error", "Account not found on ledger yet. Please wait a few seconds and try again.");
          send("done", "error", "Faucet aborted at Step 3");
          return res.end();
        }
      }

      // Query available paths
      send("swap", "running", "Querying DEX for best XLM → USDC path…");

      // Build a strict-send path payment: send 100 XLM, receive minimum USDC
      const xlmToSwap = "100"; // Swap 100 XLM for USDC

      let paths;
      try {
        paths = await horizon
          .strictSendPaths(Asset.native(), xlmToSwap, [usdc])
          .call();
      } catch (e) {
        paths = null;
      }

      let destMin = "0.01"; // Default min
      if (paths && paths.records && paths.records.length > 0) {
        destMin = paths.records[0].destination_amount;
        send("swap", "running", `Best route: ${xlmToSwap} XLM → ~${parseFloat(destMin).toFixed(2)} USDC`);
      } else {
        send("swap", "running", `Using direct path: ${xlmToSwap} XLM → USDC`);
      }

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
            destMin: "0.0000001",
            path: paths?.records?.[0]?.path?.map(p => new Asset(p.asset_code, p.asset_issuer)) || [],
          })
        )
        .setTimeout(30)
        .build();

      send("swap", "sign_required", `Swap ready: ${xlmToSwap} XLM → USDC — Signature required`, {
        xdr: swapTx.toXDR(),
        xlmAmount: xlmToSwap,
        estimatedUsdc: destMin,
      });

    } catch (e) {
      send("swap", "error", `DEX swap preparation failed: ${e.message}`);
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
