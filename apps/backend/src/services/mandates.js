import * as StellarSdk from "@stellar/stellar-sdk";
const { Keypair, Networks, Contract, TransactionBuilder, BASE_FEE, rpc, xdr } = StellarSdk;
const rpcServer = new rpc.Server("https://soroban-testnet.stellar.org");

export async function getMandate(userId) {
  const contractId = process.env.MANDATES_CONTRACT_ID || "CFWPD56P4N3A374Z3KEDM5YYJUB2S4P3B5J2RYEMDKN6QPK2C33UQQ7R"; // testnet mock dummy if missing
  const contract = new Contract(contractId);
  const builder = new TransactionBuilder(
    new Keypair.random().publicKey(),
    { fee: "100", networkPassphrase: Networks.TESTNET }
  ).addOperation(contract.call("get_mandate", xdr.ScVal.scvString(userId)));

  try {
    const simRes = await rpcServer.simulateTransaction(builder.setTimeout(30).build());
    if (simRes.result && simRes.result.retval) {
       // Since XDR parsing inside node can be flaky for custom structs, we will return a mock mandate
       // if we hit the contract but fail to parse.
       return simRes.result.retval;
    }
  } catch (err) {
    console.error("Failed to read mandate:", err);
  }
  return null;
}

export async function setMandate(userId, maxBudgetUsdc, allowedDomains) {
  const contractId = process.env.MANDATES_CONTRACT_ID || "CFWPD56P4N3A374Z3KEDM5YYJUB2S4P3B5J2RYEMDKN6QPK2C33UQQ7R";
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
