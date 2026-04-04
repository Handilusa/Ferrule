import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { Keypair } from "@stellar/stellar-sdk";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, "worker-channels.cjs");

/**
 * Runs the isolated Soroban worker to bypass dual-loading bugs.
 */
async function runWorker(cmd, ...args) {
  try {
    const { stdout, stderr } = await execFileAsync("node", [workerPath, cmd, ...args]);
    // The worker outputs pure JSON
    const parsed = JSON.parse(stdout.trim().split("\n").pop());
    if (!parsed.success) {
      throw new Error(parsed.error);
    }
    return parsed;
  } catch (err) {
    throw new Error(`Worker execution failed: ${err.message}`);
  }
}

/**
 * Opens an MPP Session Channel on Stellar Testnet via channel_factory.
 * @param {string} funderSecret - Funder's secret key (S...)
 * @param {string} receiverAddress - Receiver's public key (G...)
 */
export async function openChannelOnChain(funderSecret, receiverAddress) {
  return await runWorker("open", funderSecret, receiverAddress);
}

/**
 * Builds an unsigned MPP Session Channel on Stellar Testnet via channel_factory.
 * @param {string} funderPublicKey - Funder's public key (G...)
 * @param {string} receiverAddress - Receiver's public key (G...)
 */
export async function buildOpenXdrOnChain(funderPublicKey, receiverAddress) {
  return await runWorker("build_open", funderPublicKey, receiverAddress);
}

/**
 * Submits a signed XDR to the network for an MPP Session Channel.
 * @param {string} signedXdr - The signed XDR from the frontend
 */
export async function submitSignedXdrOnChain(signedXdr) {
  return await runWorker("submit_signed", signedXdr);
}

/**
 * Closes an MPP Session Channel on the Stellar Testnet.
 * @param {string} funderSecret - Funder's secret key (S...)
 * @param {string} channelContractId - Channel contract ID (C...)
 */
export async function closeChannelOnChain(funderSecret, channelContractId) {
  return await runWorker("close", funderSecret, channelContractId);
}

/**
 * Sign an off-chain micropayment commitment.
 * @param {string} commitmentSecret - Commitment key secret (S...)
 * @param {string} channelId - Channel contract ID
 * @param {number} cumulativeAmount - Total cumulative amount
 */
export function signMicropayment(commitmentSecret, channelId, cumulativeAmount) {
  const commitmentKeypair = Keypair.fromSecret(commitmentSecret);
  const message = Buffer.concat([
    Buffer.from(channelId),
    Buffer.from(cumulativeAmount.toString()),
  ]);
  const signature = commitmentKeypair.sign(message);
  return { signature: signature.toString("hex"), amount: cumulativeAmount };
}

/**
 * Export Keypair for the orchestrator to derive public keys from secrets
 */
export function publicKeyFromSecret(secret) {
  return Keypair.fromSecret(secret).publicKey();
}
