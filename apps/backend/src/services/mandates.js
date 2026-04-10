import * as StellarSdk from "@stellar/stellar-sdk";
const { Keypair, Networks, Contract, TransactionBuilder, BASE_FEE, rpc, xdr } = StellarSdk;
const rpcServer = new rpc.Server("https://soroban-testnet.stellar.org");

export async function getMandate(userId) {
  const contractId = process.env.MANDATES_CONTRACT_ID;
  if (!contractId) throw new Error("MANDATES_CONTRACT_ID missing");
  
  const randomKp = Keypair.random();
  const dummyAccount = new StellarSdk.Account(randomKp.publicKey(), "0");
  const contract = new Contract(contractId);
  const builder = new TransactionBuilder(
    dummyAccount,
    { fee: "100", networkPassphrase: Networks.TESTNET }
  ).addOperation(contract.call("get_mandate", xdr.ScVal.scvString(userId)));

  try {
    const simRes = await rpcServer.simulateTransaction(builder.setTimeout(30).build());
    if (simRes.result && simRes.result.retval) {
       const map = simRes.result.retval.obj()?.map();
       if (!map) return null;
       
       let maxBudget = 0;
       let allowedDomains = [];
       
       for (let i = 0; i < map.length; i++) {
         const entry = map[i];
         const key = entry.key().sym().toString();
         if (key === "max_budget_usdc" || key === "maxBudgetUsdc") {
           // simple parse of i128 lower parts
           maxBudget = Number(entry.val().i128().lo().low) / 1e7; 
         }
         if (key === "allowed_domains") {
           const strVal = entry.val().str();
           if (strVal) {
             const str = typeof strVal === 'string' ? strVal : strVal.toString('utf8');
             allowedDomains = str.split(",").map(s => s.trim()).filter(Boolean);
           }
         }
       }
       return { maxBudget, allowedDomains };
    }
  } catch (err) {
    console.error("Failed to read mandate:", err);
  }
  return null;
}

export async function setMandate(userId, maxBudgetUsdc, allowedDomains) {
  const contractId = process.env.MANDATES_CONTRACT_ID;
  if (!contractId) throw new Error("MANDATES_CONTRACT_ID missing");
  const secret = process.env.ORCHESTRATOR_PRIVATE_KEY || process.env.STELLAR_SECRET_KEY_1;
  if (!secret) return false;
  
  const orchestratorKp = Keypair.fromSecret(secret);
  const contract = new Contract(contractId);
  
  const args = [
    xdr.ScVal.scvString(userId),
    xdr.ScVal.scvI128(new xdr.Int128Parts({ 
      hi: new xdr.Int64(0, 0), 
      lo: new xdr.Uint64(0, Math.floor(maxBudgetUsdc * 1e7)) // precision conversion
    })),
    xdr.ScVal.scvString(allowedDomains)
  ];

  try {
    const orchestratorAccount = await rpcServer.getAccount(orchestratorKp.publicKey());
    const invokeTx = new TransactionBuilder(orchestratorAccount, {
      fee: (parseInt(BASE_FEE) * 100).toString(),
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(contract.call("set_mandate", ...args))
      .setTimeout(30)
      .build();

    const prepared = await rpcServer.prepareTransaction(invokeTx);
    prepared.sign(orchestratorKp);

    const sendRes = await rpcServer.sendTransaction(prepared);
    if (sendRes.status === "ERROR") return false;
    
    return true;
  } catch (err) {
    console.error("Failed to set mandate via TX:", err);
    return false;
  }
}
