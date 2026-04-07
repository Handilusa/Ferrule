import * as StellarSdk from "@stellar/stellar-sdk";
const { Keypair, Networks, Contract, TransactionBuilder, BASE_FEE, rpc, scValToNative, xdr } = StellarSdk;
const rpcServer = new rpc.Server("https://soroban-testnet.stellar.org");

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
    xdr.ScVal.scvI128(new xdr.Int128Parts({ hi: new xdr.Int64(0, 0), lo: new xdr.Uint64(0, price) })), // price in Int128
    xdr.ScVal.scvSymbol(asset),
    xdr.ScVal.scvSymbol(protocol),
    xdr.ScVal.scvString(description),
    xdr.ScVal.scvString(orchestratorKp.publicKey()), // owner
  ];

  const orchestratorAccount = await rpcServer.getAccount(orchestratorKp.publicKey());

  const invokeTx = new TransactionBuilder(orchestratorAccount, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call("register", ...args))
    .setTimeout(30)
    .build();

  const prepared = await rpcServer.prepareTransaction(invokeTx);
  prepared.sign(orchestratorKp);

  const sendRes = await rpcServer.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    console.error("Registry TX Failed:", sendRes.errorResult);
    return false;
  }

  // Wait for submission
  let result = await rpcServer.getTransaction(sendRes.hash);
  for (let i = 0; i < 20; i++) {
    if (result.status !== "NOT_FOUND") break;
    await new Promise((r) => setTimeout(r, 2000));
    result = await rpcServer.getTransaction(sendRes.hash);
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
    const simRes = await rpcServer.simulateTransaction(builder.setTimeout(30).build());
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
