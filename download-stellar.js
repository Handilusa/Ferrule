const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function followRedirects(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': 'NodeJS' } }, res => {
            if (res.statusCode === 301 || res.statusCode === 302) return followRedirects(res.headers.location).then(resolve).catch(reject);
            resolve(res);
        }).on('error', reject);
    });
}
async function fetchJSON(url) {
    const res = await followRedirects(url);
    return new Promise((resolve, reject) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(JSON.parse(data)));
        res.on('error', reject);
    });
}
async function download(url, dest) {
    process.stdout.write(`⬇️  Descargando ${path.basename(dest)}... `);
    const res = await followRedirects(url);
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => {
            file.close(() => {
                console.log(`✅ (${(fs.statSync(dest).size / 1024 / 1024).toFixed(1)} MB)`);
                resolve();
            });
        });
        file.on('error', reject);
    });
}

async function main() {
    const cargoDir = path.join(__dirname, '.cargo', 'bin');
    fs.mkdirSync(cargoDir, { recursive: true });

    const stellarExe = path.join(cargoDir, 'stellar.exe');

    // ── PASO 1: Descargar stellar-cli ──────────────────────────────────────
    if (!fs.existsSync(stellarExe)) {
        console.log('\n📡 Buscando stellar-cli para Windows x86_64...');
        const release = await fetchJSON('https://api.github.com/repos/stellar/stellar-cli/releases/latest');
        const asset = release.assets.find(a => a.name.includes('x86_64-pc-windows') && a.name.endsWith('.exe'));
        if (!asset) {
            console.log('Assets disponibles:'); release.assets.forEach(a => console.log(' -', a.name));
            throw new Error('No se encontró el .exe para Windows-x86_64');
        }
        await download(asset.browser_download_url, stellarExe);
    } else {
        console.log(`\n✅ stellar.exe ya está en ${stellarExe}`);
    }

    // Verificar que funciona
    const versionResult = spawnSync(stellarExe, ['--version'], { encoding: 'utf8' });
    if (versionResult.error) throw new Error('stellar.exe no se puede ejecutar: ' + versionResult.error.message);
    console.log(`🌟 ${versionResult.stdout.trim()}`);

    // ── PASO 2: Clonar one-way-channel ────────────────────────────────────
    const contractDir = path.join(__dirname, 'contracts', 'one-way-channel');
    if (!fs.existsSync(contractDir)) {
        console.log('\n📥 Clonando stellar-experimental/one-way-channel...');
        fs.mkdirSync(path.join(__dirname, 'contracts'), { recursive: true });
        execSync(`git clone https://github.com/stellar-experimental/one-way-channel "${contractDir}"`, { stdio: 'inherit' });
        console.log('✅ Repo clonado.');
    } else {
        console.log('\n✅ contracts/one-way-channel ya existe, usando el existente.');
    }

    // ── PASO 3: Compilar el contrato ──────────────────────────────────────
    console.log('\n⚙️  Compilando el contrato Soroban (puede tardar 2-5 min la primera vez)...');
    const env = {
        ...process.env,
        CARGO_HOME: path.join(__dirname, '.cargo'),
        RUSTUP_HOME: path.join(__dirname, '.rustup'),
        PATH: `${cargoDir};${process.env.PATH}`
    };

    const buildResult = spawnSync(stellarExe, ['contract', 'build'], {
        cwd: contractDir, env, encoding: 'utf8', stdio: 'inherit'
    });

    if (buildResult.status !== 0) {
        // Fallback: compilar directo con cargo
        console.log('⚠️  stellar contract build falló, intentando cargo build directamente...');
        const cargoExe = path.join(cargoDir, 'cargo.exe');
        const cargoResult = spawnSync(cargoExe, ['build', '--target', 'wasm32-unknown-unknown', '--release'], {
            cwd: contractDir, env, encoding: 'utf8', stdio: 'inherit'
        });
        if (cargoResult.status !== 0) {
            throw new Error('Compilación fallida tanto con stellar como con cargo.');
        }
    }
    console.log('\n✅ Contrato compilado con éxito!');

    // ── PASO 4: Encontrar el .wasm ────────────────────────────────────────
    function findWasm(dir) {
        if (!fs.existsSync(dir)) return [];
        const results = [];
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (fs.statSync(full).isDirectory()) results.push(...findWasm(full));
            else if (name.endsWith('.wasm') && !name.includes('.d.wasm')) results.push(full);
        }
        return results;
    }
    const wasms = findWasm(contractDir);
    if (!wasms.length) throw new Error('No se encontró ningún .wasm. Revisar logs de compilación arriba.');
    const wasmFile = wasms[0];
    console.log(`\n📄 WASM: ${wasmFile}`);

    // ── PASO 5: Deploy en Testnet ─────────────────────────────────────────
    require('dotenv').config();
    require('dotenv').config({ path: path.join(__dirname, 'apps/frontend/.env.local') });
    const deployerSecret = process.env.ORCHESTRATOR_SECRET || process.env.STELLAR_SECRET_KEY_2;

    if (!deployerSecret) {
        console.log('\n⚠️  Falta la secret key del deployer (ORCHESTRATOR_SECRET o STELLAR_SECRET_KEY_2).');
        console.log(`Ejecuta manualmente:\n"${stellarExe}" contract deploy --wasm "${wasmFile}" --source <SECRET_KEY> --network testnet`);
        return;
    }

    console.log('\n🚀 Desplegando contrato en Stellar Testnet...');
    const deployResult = spawnSync(
        stellarExe,
        ['contract', 'deploy', '--wasm', wasmFile, '--source', deployerSecret, '--network', 'testnet'],
        { env, encoding: 'utf8' }
    );

    if (deployResult.error || deployResult.status !== 0) {
        console.error('❌ Error al desplegar:');
        console.error(deployResult.stderr || deployResult.error?.message);
        return;
    }

    const contractId = (deployResult.stdout || '').trim();
    console.log(`\n🎉 ¡CONTRATO DESPLEGADO EN TESTNET!`);
    console.log(`📄 CONTRACT_ID: ${contractId}`);
    console.log(`\n🔗 Ver en Stellar Expert:`);
    console.log(`https://stellar.expert/explorer/testnet/contract/${contractId}`);
    console.log(`\n➕ Agrega esto a tu apps/frontend/.env.local:`);
    console.log(`ONE_WAY_CHANNEL_CONTRACT_ID=${contractId}`);
}

main().catch(err => { console.error('\n❌ Error fatal:', err.message); process.exit(1); });
