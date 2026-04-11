const { Horizon } = require("@stellar/stellar-sdk");

const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");

async function main() {
    const txHash = "651cd223af8929db8600ea27c514bc1a549746bf3a0e879217e392f1e39d557f";
    const res = await horizon.transactions().transaction(txHash).call();
    const resultMetaXdr = res.result_meta_xdr;
    // We can also just fetch effects to get exactly the contract created
    const effects = await horizon.effects().forTransaction(txHash).call();
    for (const eff of effects.records) {
        if (eff.type === "contract_created" || eff.contract) {
            console.log("CONTRACT ID:", eff.contract);
        }
    }
}
main();
