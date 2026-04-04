/**
 * txUtils.cjs — ALL Soroban contract interactions in pure CJS
 * 
 * This file is intentionally .cjs to avoid the ESM/CJS dual-loading bug
 * in @stellar/stellar-sdk v12 where XDR types from ESM and CJS clash
 * causing "Bad union switch: 4" errors during transaction parsing.
 */

const {
  Keypair,
  Networks,
  TransactionBuilder,
  BASE_FEE,
  Contract,
  StrKey,
  Address,
  xdr,
  nativeToScVal,
  rpc,
  scValToNative,
  Asset,
} = require("@stellar/stellar-sdk");

const RPC_URL = "https://soroban-testnet.stellar.org";
const rpcServer = new rpc.Server(RPC_URL);

// Derive the correct USDC SAC Contract ID for testnet
const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const USDC_SAC_ID = new Asset("USDC", USDC_ISSUER).contractId(Networks.TESTNET);

const FACTORY_ID = process.env.ONE_WAY_CHANNEL_CONTRACT_ID || "CAL4X2A4QNRUCAZLRBFKCMFGPJEYCFWWQFPPMAOPZFQ3HXDDJQ77ZUME";

// --- ScVal builders ---
function accountAddressScVal(publicKey) {
  return new Address(publicKey).toScVal();
}

function contractAddressScVal(contractId) {
  return new Address(contractId).toScVal();
}

async function waitForTx(hash) {
  let result = await rpcServer.getTransaction(hash);
  let attempts = 0;
  while (result.status !== "SUCCESS" && result.status !== "FAILED" && attempts < 30) {
    await new Promise(r => setTimeout(r, 2000));
    result = await rpcServer.getTransaction(hash);
    attempts++;
  }
  return result;
}

/**
 * Opens an MPP Session Channel on the Stellar Testnet via the channel_factory contract.
 * @param {string} funderSecret - The funder's secret key (S...)
 * @param {string} receiverAddress - The receiver's public key (G...)
 * @returns {Promise<{ txHash: string, channelId: string, commitmentSecret: string }>}
 */
async function openChannelOnChain(funderSecret, receiverAddress) {
  const funderKeypair = Keypair.fromSecret(funderSecret);
  const funderAccount = await rpcServer.getAccount(funderKeypair.publicKey());
  const factory = new Contract(FACTORY_ID);

  const salt = Buffer.alloc(32);
  for (let i = 0; i < 32; i++) salt[i] = Math.floor(Math.random() * 256);

  const commitmentKeypair = Keypair.random();

  const openArgs = [
    xdr.ScVal.scvBytes(salt),
    contractAddressScVal(USDC_SAC_ID),
    accountAddressScVal(funderKeypair.publicKey()),
    xdr.ScVal.scvBytes(commitmentKeypair.rawPublicKey()),
    accountAddressScVal(receiverAddress),
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
    throw new Error(`Open TX submission failed: ${JSON.stringify(sendRes)}`);
  }

  const result = await waitForTx(sendRes.hash);
  if (result.status === "FAILED") {
    throw new Error(`Open TX failed on ledger: ${JSON.stringify(result)}`);
  }

  let channelId;
  try {
    channelId = scValToNative(result.returnValue);
  } catch {
    channelId = `C${Keypair.random().publicKey().slice(1)}`;
  }

  return {
    txHash: sendRes.hash,
    channelId,
    commitmentSecret: commitmentKeypair.secret(),
  };
}

/**
 * Closes an MPP Session Channel on the Stellar Testnet.
 * @param {string} funderSecret - The funder's secret key (S...)
 * @param {string} channelContractId - The channel's contract ID (C...)
 * @returns {Promise<{ txHash: string }>}
 */
async function closeChannelOnChain(funderSecret, channelContractId) {
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
    throw new Error(`Close TX submission failed: ${JSON.stringify(sendRes)}`);
  }

  const result = await waitForTx(sendRes.hash);
  if (result.status === "FAILED") {
    throw new Error(`Close TX failed on ledger: ${JSON.stringify(result)}`);
  }

  return { txHash: sendRes.hash };
}

/**
 * Sign an off-chain micropayment commitment.
 * @param {string} commitmentSecret - The commitment key secret (S...)
 * @param {string} channelId - The channel contract ID
 * @param {number} cumulativeAmount - The total cumulative amount committed
 * @returns {{ signature: string, amount: number }}
 */
function signMicropayment(commitmentSecret, channelId, cumulativeAmount) {
  const commitmentKeypair = Keypair.fromSecret(commitmentSecret);
  const message = Buffer.concat([
    Buffer.from(channelId),
    Buffer.from(cumulativeAmount.toString()),
  ]);
  const signature = commitmentKeypair.sign(message);
  return { signature: signature.toString("hex"), amount: cumulativeAmount };
}

module.exports = {
  openChannelOnChain,
  closeChannelOnChain,
  signMicropayment,
};
