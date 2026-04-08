// monitor-store.js
import crypto from "crypto";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { Keypair, Asset, TransactionBuilder, Networks, Horizon, Operation } from "@stellar/stellar-sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MONITORS_FILE = path.resolve(__dirname, "../../monitors.json");

let initialMonitors = [];
try {
  if (fs.existsSync(MONITORS_FILE)) {
    initialMonitors = JSON.parse(fs.readFileSync(MONITORS_FILE, "utf-8"));
    console.log(`[Monitor Store] Loaded ${initialMonitors.length} monitors from disk.`);
  }
} catch(e) {
  console.warn("[Monitor Store] Could not load monitors.json:", e.message);
}

const monitors = new Map(initialMonitors);

export function saveMonitors() {
  try {
    fs.writeFileSync(MONITORS_FILE, JSON.stringify(Array.from(monitors.entries())));
  } catch(e) {
    console.error("[Monitor Store] Failed to save:", e.message);
  }
}

/**
 * Creates a new active monitor.
 */
export function createMonitor({ userId, pair, budgetUsdc, telegramChatId, intervalHours }) {
  const id = crypto.randomUUID();
  const monitor = {
    id,
    userId, // mapped to user's wallet address
    pair,
    budgetUsdc,
    spentUsdc: 0,
    telegramChatId,
    intervalHours,
    lastRun: null,
    active: true,
    history: [], // previous signals and timestamps
    signalsCount: 0
  };
  monitors.set(id, monitor);
  saveMonitors();
  return id;
}

export function getMonitor(id) {
  return monitors.get(id);
}

export function getMonitorsByUser(userId) {
  const result = [];
  for (const m of monitors.values()) {
    if (m.userId === userId) {
      result.push(m);
    }
  }
  return result;
}

export function getAllActiveMonitors() {
  const result = [];
  for (const m of monitors.values()) {
    if (m.active) result.push(m);
  }
  return result;
}

export function getDueMonitors() {
  const now = Date.now();
  const result = [];
  for (const m of monitors.values()) {
    if (!m.active) continue;
    // Check if enough time has passed from lastRun
    // intervalHours * 3600000 = ms
    if (!m.lastRun || (now - m.lastRun >= m.intervalHours * 3600000)) {
      result.push(m);
    }
  }
  return result;
}

export async function deactivateMonitor(id) {
  const m = monitors.get(id);
  if (m && m.active) {
    const remaining = m.budgetUsdc - m.spentUsdc;
    
    // Process refund if there's significant budget left
    if (remaining > 0.0001) {
      try {
        console.log(`[Refund] Refunding ${remaining.toFixed(4)} USDC to ${m.userId} for monitor ${m.id}`);
        const platformKeypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY_2);
        const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
        const platformAccount = await horizon.loadAccount(platformKeypair.publicKey());
        
        const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
        const usdcAsset = new Asset("USDC", USDC_ISSUER);

        const tx = new TransactionBuilder(platformAccount, {
          fee: "1000",
          networkPassphrase: Networks.TESTNET
        })
        .addOperation(Operation.payment({
          destination: m.userId,
          asset: usdcAsset,
          amount: parseFloat(remaining.toFixed(4)).toString()
        }))
        .setTimeout(60)
        .build();

        tx.sign(platformKeypair);
        await horizon.submitTransaction(tx);
        console.log(`[Refund] Successfully refunded ${remaining.toFixed(4)} USDC to ${m.userId}`);
      } catch (err) {
        console.error(`[Refund] Failed to refund ${m.userId}:`, err.message);
        // Continue to deactivate even if refund fails (to avoid infinite loops), 
        // though in production we should handle this more robustly.
      }
    }

    // Set spent to budget to reflect we've zeroed out their balance
    m.spentUsdc = m.budgetUsdc;
    m.active = false;
    saveMonitors();
    return true;
  }
  return false;
}
