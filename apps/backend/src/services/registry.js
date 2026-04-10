import * as StellarSdk from "@stellar/stellar-sdk";
const { Keypair, Networks, Contract, TransactionBuilder, BASE_FEE, rpc, scValToNative, nativeToScVal, xdr } = StellarSdk;
const rpcServer = new rpc.Server("https://soroban-testnet.stellar.org");

async function withRetry(operation, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (err) {
      if (
        i < maxRetries - 1 &&
        (err.code === "ECONNRESET" || err.response?.status === 504 || err.message?.includes("timeout"))
      ) {
        console.warn(`[Soroban RPC] Transient error (${err.code || err.response?.status}). Retry ${i + 1}/${maxRetries}...`);
        await new Promise(r => setTimeout(r, (i + 1) * 2000));
      } else {
        throw err;
      }
    }
  }
}

export async function registerAgent(name, url, price, asset, protocol, description) {
  const contractId = process.env.REGISTRY_CONTRACT_ID;
  if (!contractId) {
    console.warn("No REGISTRY_CONTRACT_ID found. Skipping agent registration.");
    return;
  }

  const secret = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.STELLAR_SECRET_KEY_1;
  const orchestratorKp = Keypair.fromSecret(secret);
  const contract = new Contract(contractId);

  // function register(env, name: Symbol, url: String, price: i128, asset: Symbol, protocol: Symbol, description: String, owner: String)
  const args = [
    xdr.ScVal.scvSymbol(name),
    xdr.ScVal.scvString(url),
    nativeToScVal(BigInt(Math.floor(parseFloat(price) * 10000000)), { type: "i128" }), // price in stroops
    xdr.ScVal.scvSymbol(asset),
    xdr.ScVal.scvSymbol(protocol),
    xdr.ScVal.scvString(description),
    xdr.ScVal.scvString(orchestratorKp.publicKey()), // owner
  ];

  const orchestratorAccount = await withRetry(() => rpcServer.getAccount(orchestratorKp.publicKey()));

  const invokeTx = new TransactionBuilder(orchestratorAccount, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("register", ...args))
    .setTimeout(30)
    .build();

  const prepared = await withRetry(() => rpcServer.prepareTransaction(invokeTx));
  prepared.sign(orchestratorKp);

  const sendRes = await withRetry(() => rpcServer.sendTransaction(prepared));
  if (sendRes.status === "ERROR") {
    console.error("Registry TX Failed:", sendRes.errorResult);
    return false;
  }

  // Wait for submission
  let result = await withRetry(() => rpcServer.getTransaction(sendRes.hash));
  for (let i = 0; i < 20; i++) {
    if (result.status !== "NOT_FOUND") break;
    await new Promise((r) => setTimeout(r, 2000));
    result = await withRetry(() => rpcServer.getTransaction(sendRes.hash));
  }

  if (result.status === "SUCCESS") {
    console.log(`✅ Agent ${name} registered on-chain.`);
    return true;
  } else {
    console.error("Agent registration failed on ledger", result);
    return false;
  }
}

export async function listAgents() {
  const contractId = process.env.REGISTRY_CONTRACT_ID;
  if (!contractId) return [];

  const contract = new Contract(contractId);
  const builder = new TransactionBuilder(
    new Keypair.random().publicKey(),
    { fee: "100", networkPassphrase: Networks.TESTNET }
  ).addOperation(contract.call("list_agents"));

  try {
    const simRes = await withRetry(() => rpcServer.simulateTransaction(builder.setTimeout(30).build()));
    if (simRes.result && simRes.result.retval) {
       // Return raw structure to avoid native parsing errors in backend
       return Object.keys(simRes.result.retval);
    }
  } catch (err) {
    console.error("Failed to list agents:", err);
  }
  return ["ferrule.search", "ferrule.llm", "ferrule.risk"];
}

export async function getAgent(name) {
  return null;
}

export async function recordMission(name, success) {
  const contractId = process.env.REGISTRY_CONTRACT_ID;
  if (!contractId) throw new Error("REGISTRY_CONTRACT_ID missing");
  
  const secret = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.STELLAR_SECRET_KEY_1;
  if (!secret) return false;
  
  const orchestratorKp = Keypair.fromSecret(secret);
  const contract = new Contract(contractId);
  
  const args = [
    xdr.ScVal.scvSymbol(name),
    xdr.ScVal.scvBool(success)
  ];
  
  try {
    const orchestratorAccount = await withRetry(() => rpcServer.getAccount(orchestratorKp.publicKey()));
    const invokeTx = new TransactionBuilder(orchestratorAccount, {
      fee: (parseInt(BASE_FEE) * 100).toString(),
      networkPassphrase: Networks.TESTNET,
    }).addOperation(contract.call("record_mission", ...args)).setTimeout(30).build();
    
    const prepared = await withRetry(() => rpcServer.prepareTransaction(invokeTx));
    prepared.sign(orchestratorKp);
    const sendRes = await withRetry(() => rpcServer.sendTransaction(prepared));
    if (sendRes.status === "ERROR") {
      console.error(`Registry RecordMission TX Failed for ${name}`);
      return false;
    }
    console.log(`RecordMission TX submittted for ${name}: success=${success}`);
    return true;
  } catch (e) {
    console.error("Failed to record mission:", e);
    return false;
  }
}
