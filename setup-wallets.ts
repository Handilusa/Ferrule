import {
    Keypair,
    Networks,
    TransactionBuilder,
    Operation,
    Asset,
    BASE_FEE,
    Horizon
} from '@stellar/stellar-sdk';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carga de variables de entorno (Intenta cargar .env y luego el fallback de .env.local)
dotenv.config();
dotenv.config({ path: path.join(__dirname, 'apps/frontend/.env.local') });

const server = new Horizon.Server('https://horizon-testnet.stellar.org');

const USDC = new Asset(
    'USDC',
    'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
);

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupWallet(secretKey: string, name: string) {
    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    console.log(`\n🔧 Setting up ${name}: ${publicKey}`);

    // PASO 1 — Fondear con XLM via Friendbot
    console.log(`  ⏳ Minting XLM...`);
    try {
        const friendbot = await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);
        if (!friendbot.ok) {
            console.log(`  ⚠️  Friendbot failed (puede que ya tenga XLM)`);
        } else {
            console.log(`  ✅ XLM funded`);
        }
    } catch (e) {
        console.log(`  ⚠️  Error de red al llamar a Friendbot`);
    }
    await sleep(3000); // esperar a que el ledger confirme

    // PASO 2 — Trustline USDC
    console.log(`  ⏳ Setting USDC trustline...`);
    try {
        const account = await server.loadAccount(publicKey);
        const hasTrustline = account.balances.some(
            b => b.asset_type !== 'native' && (b as any).asset_code === 'USDC' && (b as any).asset_issuer === USDC.issuer
        );

        if (!hasTrustline) {
            const trustlineTx = new TransactionBuilder(account, {
                fee: BASE_FEE,
                networkPassphrase: Networks.TESTNET
            })
                .addOperation(Operation.changeTrust({ asset: USDC }))
                .setTimeout(30)
                .build();

            trustlineTx.sign(keypair);
            await server.submitTransaction(trustlineTx);
            console.log(`  ✅ USDC trustline set`);
        } else {
            console.log(`  ✅ USDC trustline ya existía`);
        }
    } catch (e: any) {
        console.log(`  ❌ Error setting trustline: ${e?.response?.title || 'Unknown'}`);
    }
    await sleep(3000);

    // PASO 3 — Swap XLM → USDC via SDEX
    console.log(`  ⏳ Swapping 100 XLM → USDC...`);
    try {
        const accountRefreshed = await server.loadAccount(publicKey);
        const swapTx = new TransactionBuilder(accountRefreshed, {
            fee: BASE_FEE,
            networkPassphrase: Networks.TESTNET
        })
            .addOperation(Operation.pathPaymentStrictSend({
                sendAsset: Asset.native(),  // XLM
                sendAmount: '100',           // cuánto XLM gastas
                destination: publicKey,       // te lo envías a ti mismo
                destAsset: USDC,
                destMin: '1',             // mínimo USDC a recibir
                path: []               // Stellar busca el path solo
            }))
            .setTimeout(30)
            .build();

        swapTx.sign(keypair);
        const result = await server.submitTransaction(swapTx);
        console.log(`  ✅ Swap done: ${result.hash}`);
    } catch (e: any) {
        if (e?.response?.data?.extras?.result_codes?.operations?.includes("op_no_path") || e?.response?.data?.extras?.result_codes?.operations?.includes("op_under_dest_min")) {
            console.log(`  ⚠️  Swap falló (problema de liquidez en testnet o op_no_path). No se obtuvieron USDC.`);
        } else {
            console.log(`  ❌ Swap error: ${e?.response?.data?.extras?.result_codes?.operations || 'Unknown'}`);
        }
    }
    await sleep(2000);

    // Verificar saldos finales
    try {
        const finalAccount = await server.loadAccount(publicKey);
        const xlm = finalAccount.balances.find(b => b.asset_type === 'native');
        const usdc = finalAccount.balances.find(
            b => 'asset_code' in b && b.asset_code === 'USDC'
        );
        console.log(`  💰 XLM:  ${xlm?.balance}`);
        console.log(`  💰 USDC: ${usdc?.balance || '0'}`);
    } catch (e) {
        console.log(`  ❌ Error final fetching balances`);
    }
}

// --- MAIN ---
async function main() {
    // Lectura de variables con fallbacks para usar las llaves del .env.local
    const orchestratorStr = process.env.ORCHESTRATOR_SECRET || process.env.STELLAR_SECRET_KEY_2;
    const llmStr = process.env.LLM_AGENT_SECRET || process.env.STELLAR_SECRET_KEY_3;
    let searchStr = process.env.SEARCH_AGENT_SECRET || process.env.STELLAR_SECRET_KEY_4;
    let riskStr = process.env.RISK_AGENT_SECRET || process.env.STELLAR_SECRET_KEY_5;

    if (!searchStr) {
        const kp = Keypair.random();
        searchStr = kp.secret();
        console.log(`\n🔑 Nueva clave temporal generada para Search Agent:`);
        console.log(`Public: ${kp.publicKey()}`);
        console.log(`Secret: ${searchStr}`);
    }

    if (!riskStr) {
        const kp = Keypair.random();
        riskStr = kp.secret();
        console.log(`\n🔑 Nueva clave temporal generada para Risk Agent:`);
        console.log(`Public: ${kp.publicKey()}`);
        console.log(`Secret: ${riskStr}`);
    }

    const wallets = [
        { name: 'Orchestrator', secret: orchestratorStr! },
        { name: 'LLM Agent', secret: llmStr! },
        { name: 'Search Agent', secret: searchStr! },
        { name: 'Risk Agent', secret: riskStr! },
    ];

    console.log("=========================================");
    console.log("   INICIANDO SETUP Y SWAP A USDC");
    console.log("=========================================");

    for (const wallet of wallets) {
        if (!wallet.secret) {
            console.log(`\n⏭️  Skipping ${wallet.name} (No secret key found)`);
            continue;
        }
        await setupWallet(wallet.secret, wallet.name);
    }

    console.log('\n🎉 All wallets ready!');
    console.log('⚠️ Si el swap falla con op_no_path es problema de liquidez en testnet — en ese caso usa el faucet de Circle para fondear.');
}

main().catch(console.error);
