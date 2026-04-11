const { Keypair, Horizon } = require("@stellar/stellar-sdk");

const secret = "SDPOFJUW2BV5BS57Q2ZKYLTLQ3G5G3PLULI2QHA5TPXZSUC2KOFOGOA4";
const kp = Keypair.fromSecret(secret);
const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

async function main() {
    console.log("Pubkey: ", kp.publicKey());
    const res = await horizon.operations().forAccount(kp.publicKey()).order("desc").limit(5).call();
    for (const op of res.records) {
        console.log(op.type, "-> tx hash:", op.transaction_hash);
    }
}
main();
