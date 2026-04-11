const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const stellarExe = path.join(__dirname, '..', '..', '.cargo', 'bin', 'stellar.exe');
const wasmFile = path.join(__dirname, 'target', 'wasm32-unknown-unknown', 'release', 'agent_registry.wasm');
const deployerSecret = 'SDPOFJUW2BV5BS57Q2ZKYLTLQ3G5G3PLULI2QHA5TPXZSUC2KOFOGOA4';

if (!fs.existsSync(wasmFile)) {
    console.error("WASM FIle missing", wasmFile);
    process.exit(1);
}

console.log("Desplegando agent-registry en Testnet...");

const result = spawnSync(stellarExe, [
    'contract', 'deploy',
    '--wasm', wasmFile,
    '--source', deployerSecret,
    '--rpc-url', 'https://soroban-testnet.stellar.org',
    '--network-passphrase', 'Test SDF Network ; September 2015'
], { encoding: 'utf8' });

console.log("STDOUT:", result.stdout);
console.log("STDERR:", result.stderr);
if (result.error) console.log("ERROR:", result.error);

if (result.stdout && result.stdout.trim().startsWith('C')) {
    const cid = result.stdout.trim();
    console.log("Nuevo Contract ID:", cid);
}
