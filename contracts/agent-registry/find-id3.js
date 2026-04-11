const fetch = require("node-fetch");
async function main() {
   const res = await fetch("https://soroban-testnet.stellar.org", {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify({
           jsonrpc: "2.0",
           id: 1,
           method: "getTransaction",
           params: ["651cd223af8929db8600ea27c514bc1a549746bf3a0e879217e392f1e39d557f"]
       })
   });
   const data = await res.json();
   console.log(JSON.stringify(data, null, 2));
}
main();
