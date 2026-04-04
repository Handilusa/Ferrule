/**
 * worker-channels.cjs
 * 
 * Este es un EJECUTABLE INDEPENDIENTE de Node.js.
 * Resuelve el bug "Bad union switch: 4" al correr en su propio proceso de memoria,
 * interactuando con el ledger real de Soroban y devolviendo un JSON puro a channels.js.
 */

const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  Address,
  xdr,
  nativeToScVal,
  rpc,
  scValToNative,
  Asset,
} = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const rpcServer = new rpc.Server(RPC_URL);

const command = process.argv[2];

// Constants
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_SAC_ID = new Asset("USDC", USDC_ISSUER).contractId(Networks.TESTNET);
const FACTORY_ID = process.env.ONE_WAY_CHANNEL_CONTRACT_ID || "CAL4X2A4QNRUCAZLRBFKCMFGPJEYCFWWQFPPMAOPZFQ3HXDDJQ77ZUME";

async function waitForTx(hash) {
  let result = await rpcServer.getTransaction(hash);
  let attempts = 0;
  while (result.status !== "SUCCESS" && result.status !== "FAILED" && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    result = await rpcServer.getTransaction(hash);
    attempts++;
  }
  return result;
}

async function doOpen() {
  const funderSecret = process.argv[3];
  const receiverPublicKey = process.argv[4];

  const funderKeypair = Keypair.fromSecret(funderSecret);
  const funderAccount = await rpcServer.getAccount(funderKeypair.publicKey());
  const factory = new Contract(FACTORY_ID);

  const salt = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) salt[i] = Math.floor(Math.random() * 256);

  const commitmentKeypair = Keypair.random();

  const openArgs = [
    xdr.ScVal.scvBytes(salt),
    new Address(USDC_SAC_ID).toScVal(),
    new Address(funderKeypair.publicKey()).toScVal(),
    xdr.ScVal.scvBytes(commitmentKeypair.rawPublicKey()),
    new Address(receiverPublicKey).toScVal(),
    nativeToScVal(0, { type: "i128" }),
    nativeToScVal(100, { type: "u32" }),
  ];

  const invokeOpen = factory.call("open", ...openArgs);

  const tx = new TransactionBuilder(funderAccount, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(invokeOpen)
    .setTimeout(30)
    .build();

  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(funderKeypair);

  const sendRes = await rpcServer.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    throw new Error(`Open TX Failed JSON-RPC: ${JSON.stringify(sendRes.errorResult)}`);
  }

  const result = await waitForTx(sendRes.hash);
  if (result.status === "FAILED") {
    throw new Error(`Open TX Failed on Ledger`);
  }

  /* ScValToNative safe execution inside worker! */
  const channelId = scValToNative(result.returnValue);

  // Return strictly JSON
  console.log(JSON.stringify({
    success: true,
    txHash: sendRes.hash,
    channelId,
    commitmentSecret: commitmentKeypair.secret()
  }));
}

async function doClose() {
  const funderSecret = process.argv[3];
  const channelContractId = process.argv[4];

  const funderKeypair = Keypair.fromSecret(funderSecret);
  const funderAccount = await rpcServer.getAccount(funderKeypair.publicKey());
  const channel = new Contract(channelContractId);

  const invokeClose = channel.call("close_start");

  const tx = new TransactionBuilder(funderAccount, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(invokeClose)
    .setTimeout(30)
    .build();

  const prepared = await rpcServer.prepareTransaction(tx);
  prepared.sign(funderKeypair);

  const sendRes = await rpcServer.sendTransaction(prepared);
  if (sendRes.status === "ERROR") {
    throw new Error(`Close TX Failed JSON-RPC: ${JSON.stringify(sendRes.errorResult)}`);
  }

  const result = await waitForTx(sendRes.hash);
  if (result.status === "FAILED") {
    throw new Error(`Close TX Failed on Ledger`);
  }

  console.log(JSON.stringify({
    success: true,
    txHash: sendRes.hash
  }));
}

async function doBuildOpenXdr() {
  const funderPublicKey = process.argv[3];
  const receiverPublicKey = process.argv[4];

  const funderAccount = await rpcServer.getAccount(funderPublicKey);
  const factory = new Contract(FACTORY_ID);

  const salt = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) salt[i] = Math.floor(Math.random() * 256);

  const commitmentKeypair = Keypair.random();

  const openArgs = [
    xdr.ScVal.scvBytes(salt),
    new Address(USDC_SAC_ID).toScVal(),
    new Address(funderPublicKey).toScVal(),
    xdr.ScVal.scvBytes(commitmentKeypair.rawPublicKey()),
    new Address(receiverPublicKey).toScVal(),
    nativeToScVal(0, { type: "i128" }),
    nativeToScVal(100, { type: "u32" }),
  ];

  const invokeOpen = factory.call("open", ...openArgs);

  const tx = new TransactionBuilder(funderAccount, {
    fee: (parseInt(BASE_FEE) * 100).toString(),
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(invokeOpen)
    .setTimeout(60) // Give the user 60 seconds to sign in Freighter
    .build();

  const prepared = await rpcServer.prepareTransaction(tx);

  console.log(JSON.stringify({
    success: true,
    xdr: prepared.toXDR(),
    commitmentSecret: commitmentKeypair.secret()
  }));
}

async function doSubmitSigned() {
  const signedXdr = process.argv[3];
  const tx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  
  const sendRes = await rpcServer.sendTransaction(tx);
  if (sendRes.status === "ERROR") {
    throw new Error(`Submit TX Failed JSON-RPC: ${JSON.stringify(sendRes.errorResult)}`);
  }

  const result = await waitForTx(sendRes.hash);
  if (result.status === "FAILED") {
    throw new Error(`Submit TX Failed on Ledger`);
  }

  const channelId = scValToNative(result.returnValue);

  console.log(JSON.stringify({
    success: true,
    txHash: sendRes.hash,
    channelId
  }));
}

async function main() {
  try {
    if (command === "open") await doOpen();
    else if (command === "close") await doClose();
    else if (command === "build_open") await doBuildOpenXdr();
    else if (command === "submit_signed") await doSubmitSigned();
    else throw new Error("Unknown command: " + command);
  } catch (error) {
    console.log(JSON.stringify({ success: false, error: error.message }));
  }
}

main();
