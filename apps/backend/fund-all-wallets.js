import {
  Horizon, Keypair, TransactionBuilder, Operation,
  Asset, Networks, BASE_FEE
} from "@stellar/stellar-sdk";
import dotenv from "dotenv";
import path from "path";
dotenv.config({ path: "../frontend/.env.local" });

const server   = new Horizon.Server("https://horizon-testnet.stellar.org");
const TESTNET  = Networks.TESTNET;
const USDC     = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5");
const XLM_SWAP = "20";   // XLM a gastar por wallet (~5 USDC aprox en testnet)
const USDC_MIN = "1";    // mínimo USDC que acepto recibir

const wallets = [
  { name: "ORCHESTRATOR", secret: process.env.ORCHESTRATOR_PRIVATE_KEY },
  { name: "SEARCH_AGENT",  secret: process.env.SEARCH_AGENT_PRIVATE_KEY  },
  { name: "LLM_AGENT",     secret: process.env.LLM_AGENT_PRIVATE_KEY     },
];

async function fundWallet({ name, secret }) {
  const kp  = Keypair.fromSecret(secret);
  const pk  = kp.publicKey();
  const acc = await server.loadAccount(pk);

  const hasTrustline = acc.balances.some(b => b.asset_code === "USDC");
  const xlmBalance   = acc.balances.find(b => b.asset_type === "native")?.balance ?? "0";

  console.log(`\n── ${name} (${pk.slice(0,8)}…)`);
  console.log(`   XLM: ${xlmBalance} | USDC trustline: ${hasTrustline ? "✅" : "❌"}`);

  const builder = new TransactionBuilder(acc, {
    fee: BASE_FEE,
    networkPassphrase: TESTNET,
  }).setTimeout(60);

  // 1. Añadir trustline si no existe
  if (!hasTrustline) {
    builder.addOperation(Operation.changeTrust({ asset: USDC }));
    console.log(`   → Añadiendo trustline USDC…`);
  }

  // 2. Buscar ruta XLM → USDC en el DEX de testnet
  let paths = [];
  try {
    const res = await server
      .strictSendPaths(Asset.native(), XLM_SWAP, [USDC])
      .call();
    paths = res.records ?? [];
  } catch (_) { /* sin rutas */ }

  if (paths.length > 0) {
    // Ruta encontrada en DEX → swap real
    builder.addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset:    Asset.native(),
        sendAmount:   XLM_SWAP,
        destAsset:    USDC,
        destMin:      USDC_MIN,
        destination:  pk,           // se queda en la misma wallet
        path:         [],
      })
    );
    console.log(`   → Swap ${XLM_SWAP} XLM → USDC via DEX…`);
  } else {
    console.log(`   ⚠  Sin liquidez en DEX testnet. Usando Circle faucet…`);
    // Si no hay trustline todavía, la submitimos primero antes del faucet
    if (!hasTrustline) {
      const trustTx = builder.build();
      trustTx.sign(kp);
      await server.submitTransaction(trustTx);
      console.log(`   ✅ Trustline USDC añadida`);
    }
    // Circle faucet (fallback automático)
    await requestCircleFaucet(pk);
    return;
  }

  // Submit transacción (trustline + swap en un solo tx)
  const tx = builder.build();
  tx.sign(kp);
  try {
    const result = await server.submitTransaction(tx);
    console.log(`   ✅ TX: ${result.id}`);
    console.log(`   🔗 https://stellar.expert/explorer/testnet/tx/${result.id}`);
  } catch (e) {
    const ops = e?.response?.data?.extras?.result_codes?.operations ?? [];
    console.error(`   ❌ Error: ${JSON.stringify(ops)}`);
    // Si falla el swap por slippage, intentar solo trustline + faucet
    if (!hasTrustline) await addTrustlineOnly(kp, acc);
    await requestCircleFaucet(pk);
  }
}

async function addTrustlineOnly(kp, acc) {
  const tx = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: TESTNET })
    .setTimeout(60)
    .addOperation(Operation.changeTrust({ asset: USDC }))
    .build();
  tx.sign(kp);
  await server.submitTransaction(tx);
  console.log(`   ✅ Trustline USDC añadida (solo trustline)`);
}

async function requestCircleFaucet(publicKey) {
  try {
    const res = await fetch("https://faucet.circle.com/api/requestTokens", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: "stellar", address: publicKey }),
    });
    if (res.ok) {
      console.log(`   ✅ USDC solicitado via Circle faucet para ${publicKey.slice(0,8)}…`);
    } else {
      console.log(`   ⚠  Circle faucet: ${res.status} — ir a https://faucet.circle.com manualmente`);
    }
  } catch {
    console.log(`   ⚠  Circle faucet offline — ir a https://faucet.circle.com manualmente`);
  }
}

// ── MAIN
async function main() {
    console.log("🚀 Fondeando wallets con USDC en Stellar Testnet…\n");
    for (const wallet of wallets) {
      await fundWallet(wallet);
    }

    // ── Balance final
    console.log("\n\n── Balances finales ──");
    for (const { name, secret } of wallets) {
      const kp  = Keypair.fromSecret(secret);
      const acc = await server.loadAccount(kp.publicKey());
      const xlm  = acc.balances.find(b => b.asset_type === "native")?.balance;
      const usdc = acc.balances.find(b => b.asset_code === "USDC")?.balance ?? "0";
      console.log(`${name}: ${xlm} XLM | ${usdc} USDC`);
    }
}
main().catch(console.error);
