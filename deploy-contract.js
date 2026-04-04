const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const stellarExe = path.join(__dirname, '.cargo', 'bin', 'stellar.exe');
const wasmFile = path.join(__dirname, 'contracts', 'channel.wasm');
const deployerSecret = 'SDPOFJUW2BV5BS57Q2ZKYLTLQ3G5G3PLULI2QHA5TPXZSUC2KOFOGOA4';

if (!fs.existsSync(wasmFile)) {
    console.error("WASM FIle missing", wasmFile);
    process.exit(1);
}

console.log("Desplegando en Testnet...");

const result = spawnSync(stellarExe, [
    'contract', 'deploy',
    '--wasm', wasmFile,
    '--source', deployerSecret,
    '--network', 'testnet'
], { encoding: 'utf8' });

console.log("STDOUT:", result.stdout);
console.log("STDERR:", result.stderr);
if (result.error) console.log("ERROR:", result.error);

if (result.stdout && result.stdout.trim().startsWith('C')) {
    const cid = result.stdout.trim();
    console.log("\nGuardando en .env.local: ", cid);
    fs.appendFileSync(path.join(__dirname, 'apps/frontend/.env.local'), `\nONE_WAY_CHANNEL_CONTRACT_ID=${cid}\n`);
    console.log("✅ HECHO");
} else {
    console.log("No recibimos Contract ID válido.");
}
