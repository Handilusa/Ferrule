import { Keypair } from "@stellar/stellar-sdk";
import fs from "fs";

async function main() {
  const orchestrator  = Keypair.random();
  const searchAgent   = Keypair.random();
  const llmAgent      = Keypair.random();

  let out = "---- WALLETS ----\n\n";
  
  // Fund con Friendbot (XLM gratis testnet)
  for (const kp of [orchestrator, searchAgent, llmAgent]) {
    try {
        await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
        out += `Funded: ${kp.publicKey()}\nSecret: ${kp.secret()}\n\n`;
    } catch(e) {
        out += `Failed to fund: ${kp.publicKey()}\nSecret: ${kp.secret()}\n\n`;
    }
  }
  fs.writeFileSync("wallets.txt", out);
  console.log("Written to wallets.txt");
}

main().catch(console.error);
