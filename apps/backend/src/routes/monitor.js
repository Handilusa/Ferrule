import { Router } from "express";
import { Keypair, Asset, TransactionBuilder, Networks, Horizon, Operation } from "@stellar/stellar-sdk";
import { createMonitor, getMonitor, getMonitorsByUser, deactivateMonitor } from "../services/monitor-store.js";
import { generateDeepLinkCode, users } from "../services/telegram.js";

const router = Router();

// 1. Preauth (same pattern as orchestrator, build XDR for budget payment)
router.post("/preauth", async (req, res) => {
  const { funderPublicKey, budget } = req.body;
  if (!funderPublicKey) return res.status(400).json({ error: "Missing funderPublicKey" });

  try {
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
    const account = await horizon.loadAccount(funderPublicKey);
    
    const paymentAmount = budget ? String(budget) : "0.20";
    
    // Platform Wallet
    const platformPublicKey = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY_2).publicKey();
    const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
    const usdcAsset = new Asset("USDC", USDC_ISSUER);

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

    return res.json({ xdr: tx.toXDR() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Activate monitor
router.post("/", async (req, res) => {
  const { signedXdr, funderPublicKey, pair, budgetUsdc, intervalHours } = req.body;
  if (!signedXdr || !funderPublicKey || !pair) {
     return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // Submit channel payment Native
    const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
    const txToSubmit = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
    await horizon.submitTransaction(txToSubmit);

    // Look for matching telegramChatId
    let telegramChatId = null;
    for (const [chatId, wallet] of users.entries()) {
       if (wallet === funderPublicKey) {
           telegramChatId = chatId;
           break;
       }
    }

    const mId = createMonitor({
        userId: funderPublicKey,
        pair,
        budgetUsdc: parseFloat(budgetUsdc),
        intervalHours: parseFloat(intervalHours) || 1, // Demo 1 hour (but cron runs every minute)
        telegramChatId
    });

    return res.json({ success: true, monitorId: mId });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
});

// 3. User Active Monitors
router.get("/user/:wallet", (req, res) => {
  const monitors = getMonitorsByUser(req.params.wallet);
  res.json({ monitors });
});

// 4. Deactivate
router.delete("/:id", async (req, res) => {
  const success = await deactivateMonitor(req.params.id);
  res.json({ success });
});

// 5. Generate Link Code
router.get("/telegram-link", (req, res) => {
   const { wallet } = req.query;
   if (!wallet) return res.status(400).json({ error: "wallet query param required" });
   
   // Check if already linked
   let isLinked = false;
   for (const linkedWallet of users.values()) {
        if (linkedWallet === wallet) isLinked = true;
   }
   
   if (isLinked) {
       return res.json({ linked: true });
   }
   
   const code = generateDeepLinkCode(wallet);
   res.json({ linked: false, code });
});

export { router as monitorRouter };
