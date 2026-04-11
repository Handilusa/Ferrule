import { chromium } from 'playwright';
import { createCursor } from 'ghost-cursor';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { exec } from 'child_process';
import { getAudioDurationInSeconds } from 'get-audio-duration';

const execPromise = util.promisify(exec);

// Variables
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ''; // Opcional para pruebas
const VOZ_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel (default en ElevenLabs)
const URL_OBJETIVO = 'http://localhost:3000'; // Ajusta esto
const OUTPUT_DIR = path.resolve('./salida_demo');

// Utilidad para pausar ejecución
const wait = ms => new Promise(res => setTimeout(res, ms));

async function main() {
    console.log('🚀 Iniciando Demo Recorder...');
    
    // Crear directorio de salida si no existe
    if (!fs.existsSync(OUTPUT_DIR)){
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // --- 1. CONFIGURAR GUION (EL SCRIPT) ---
    // Cada paso define lo que dice el audio y la acción que ocurre JUSTO DESPUÉS del audio.
    const scenario = [
        { 
            text: "Evaluating a B2B software vendor takes weeks. PDFs, sales calls, spreadsheets — and at the end, nobody can prove when the decision was made or what data was used. Ferrule does it in minutes. Autonomously. And every decision is permanently sealed on the Stellar blockchain.",
            action: async (page, cursor) => {
                // TODO: Acción inicial. Quizás mover el ratón suavemente por el dashboard principal.
                await cursor.move({ x: 500, y: 300 }); 
            }
        },
        { 
            text: "From the console, I set the parameters. Vendor: Datadog. Budget: 0.25 USDC. And here — AP2 Mandates: only official docs, GitHub, and security databases. These policies are written to a Soroban smart contract before the agent runs a single search.",
            action: async (page, cursor) => {
                // TODO: Ir a la consola y rellenar formulario.
                // await cursor.click('text="Console"');
                // await page.fill('input[placeholder="Vendor name"]', 'Datadog');
                // await page.fill('input[placeholder="Budget"]', '0.25');
                // await cursor.click('text="Official Docs"');
                await cursor.move({ x: 600, y: 400 });
            }
        },
        { 
            text: "I launch the mission. The Search Agent fires its first request — and the server responds: HTTP 402 Payment Required. The agent pays 0.0002 USDC on Stellar. No API key. No registration. Just an on-chain payment — and the service unlocks. That's the x402 protocol.",
            action: async (page, cursor) => {
                // TODO: Hacer click en el botón de Launch / Start Mission.
                // await cursor.click('#launch-mission-btn');
                // TODO: Luego mover el ratón hacia el log de red donde sale el HTTP 402.
                await cursor.move({ x: 800, y: 500 });
            }
        },
        {
            text: "The Orchestrator coordinates three specialized agents: Search, LLM, and Risk. The Risk Agent is specifically instructed to attack the primary report — hunting for vendor lock-in, security gaps, and hidden SLA clauses. Every additional search it triggers is an independent x402 micropayment. Agents pay each other automatically.",
            action: async (page, cursor) => {
                // TODO: Mover el ratón sobre el componente interactivo AgentNetworkViz o AgentTimeline.
                await cursor.move({ x: 400, y: 600 });
            }
        },
        {
            text: "When the mission completes, the SHA-256 hash of the full report is anchored on the Stellar ledger via manageData. Immutable. Cryptographically timestamped. Any auditor can verify it at any point in the future.",
            action: async (page, cursor) => {
                // TODO: Scroll hacia abajo hasta mostrar el hash / link de la transacción.
                // await page.mouse.wheel(0, 500);
                await cursor.move({ x: 450, y: 650 });
            }
        },
        {
            text: "The second module is the Quant Monitor. From the console, I configure a perpetual monitor for XLM/USDC — every hour, 1 USDC delegated to the bot pool. The agent wakes up on its own, computes RSI, EMA, MACD, Fibonacci — all with custom math engine, zero external libraries — and if it detects a relevant trading signal, it pushes the analysis directly to Telegram. No human intervention. Paid per execution via MPP Session on Stellar.",
            action: async (page, cursor) => {
                // TODO: Navegar a la vista de Monitor, rellenar datos.
                // await cursor.click('text="Quant Monitor"');
                await cursor.move({ x: 300, y: 200 });
            }
        },
        {
            text: "Ferrule includes its own block explorer. Every mission, every x402 transaction, every record_mission on Soroban — indexed and navigable.",
            action: async (page, cursor) => {
                // TODO: Click en la vista del Explorer y mostrar TxFeed.
                // await cursor.click('text="Explorer"');
                await cursor.move({ x: 350, y: 250 });
            }
        },
        {
            text: "And here is what separates Ferrule from any generic LLM: the Verify Console. I paste the transaction ID from the Datadog mission. The system extracts the hash from manageData, compares it against the raw report JSON, and mathematically proves whether anyone has tampered with it since the agents generated it. This is what an audit firm would pay for.",
            action: async (page, cursor) => {
                // TODO: Click en Verify, pegar un ID de transacción y hacer click en validar.
                // await cursor.click('text="Verify"'); 
                await cursor.move({ x: 500, y: 400 });
            }
        },
        {
            text: "Ferrule is not just a dApp. It is open infrastructure. Any autonomous agent that speaks x402 can consume Ferrule. No API keys. No registration. No permission required. Due diligence. Autonomous. Paid by micropayments. Verifiable forever. Ferrule — Built on Stellar.",
            action: async (page, cursor) => {
                // TODO: Acción final de cierre. Mover el ratón hacia el centro / logo.
                await cursor.move({ x: 600, y: 300 });
                // await cursor.click('#logo'); // quizás una pequeña animación de click final
            }
        }
    ];

    console.log('🎙️ Paso 1: Generando audios (TTS)...');
    let audiosGenerados = [];

    for (let i = 0; i < scenario.length; i++) {
        const step = scenario[i];
        const audioPath = path.join(OUTPUT_DIR, `audio_${i}.mp3`);
        const durationMs = await generateOrMockAudio(step.text, audioPath);
        
        audiosGenerados.push({ file: audioPath, durationMs });
        console.log(`- Audio ${i} listo (${durationMs}ms)`);
    }

    console.log('\n🎭 Paso 2: Abriendo Playwright para grabar video...');
    const browser = await chromium.launch({ headless: false }); // headless:false para ver qué pasa
    const context = await browser.newContext({
        recordVideo: {
            dir: OUTPUT_DIR,
            size: { width: 1280, height: 720 }
        },
        viewport: { width: 1280, height: 720 }
    });
    const page = await context.newPage();
    const cursor = createCursor(page); // Iniciar ghost-cursor aquí

    try {
        await page.goto(URL_OBJETIVO);
        await wait(2000); // Esperar a que la página cargue inicial

        // Ejecutar el guion actuando en la página
        for (let i = 0; i < scenario.length; i++) {
            const step = scenario[i];
            const audioData = audiosGenerados[i];

            console.log(`   [Action] Esperando audio ${i}: "${step.text}"`);
            // Esperar el tiempo exacto que dura este segmento de audio
            await wait(audioData.durationMs);

            console.log(`   [Action] Ejecutando acción en la página...`);
            await step.action(page, cursor);

            // Una pausa corta y natural tras actuar
            await wait(500); 
        }

        console.log('✅ Grabación finalizada.');
    } catch (e) {
        console.error("Error durante script de playwright:", e);
    } finally {
        await context.close();
        await browser.close();
    }

    // Playwright guarda el video con un nombre aleatorio (.webm). Lo renombramos.
    const files = fs.readdirSync(OUTPUT_DIR);
    const webmFile = files.find(f => f.endsWith('.webm'));
    const finalVideoPath = path.join(OUTPUT_DIR, 'video_limpio.webm');
    
    if (webmFile) {
        fs.renameSync(path.join(OUTPUT_DIR, webmFile), finalVideoPath);
        console.log(`\n🎞️ Video guardado en: ${finalVideoPath}`);
    }

    // --- 3. FINAL: INTENTO COMBINAR AUDIO Y VIDEO CON FFMPEG ---
    console.log('\n✂️ Paso 3: Intentando mezclar Video + Audio...');
    await tryMergeWithFFmpeg(finalVideoPath, audiosGenerados, OUTPUT_DIR);
}

/**
 * Genera el Mp3 llamando a ElevenLabs o simula su duración sin gastar API
 */
async function generateOrMockAudio(text, outputPath) {
    if (!ELEVENLABS_API_KEY) {
        // MOCK: Generamos un archivo dummy para dar un archivo válido (necesario si quisiéramos luego unir)
        // Alternativamente solo devolvemos un tiempo simulado: 100ms por carácter (Aprox)
        const ms = text.length * 90; 
        fs.writeFileSync(outputPath, "Dummy audio content - No key provided");
        return ms;
    }

    // Usar Node Native Fetch (Requiere Node 18+)
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${VOZ_ID}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Accept': 'audio/mpeg',
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            text, model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.5, similarity_boost: 0.5 }
        })
    });

    if (!response.ok) throw new Error(`Error API TTS: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(outputPath, Buffer.from(buffer));
    
    // Leer métricas usando 'get-audio-duration' (que internamente llama a ffprobe)
    try {
        const sec = await getAudioDurationInSeconds(outputPath);
        return Math.ceil(sec * 1000);
    } catch {
        // En caso de que no haya ffprobe, fallback a cálculo empírico
        return text.length * 90;
    }
}

/**
 * Verifica si FFmpeg existe, une los archivos .mp3 (si existen archivos reales) y mezcla
 */
async function tryMergeWithFFmpeg(videoPath, audios, outDir) {
    try {
        await execPromise('ffmpeg -version');
    } catch (e) {
        console.warn(`\n⚠️ FFMPEG NO DETECTADO.`);
        console.log(`Por favor, instala FFmpeg (https://ffmpeg.org/download.html) usando winget o descárgalo.`);
        console.log(`\nManual de unión si descargas FFmpeg:`);
        console.log(`  1. Une los audios: ffmpeg -i "concat:audio_0.mp3|audio_1.mp3" -c copy full_audio.mp3`);
        console.log(`  2. Mezcla todo:    ffmpeg -i video_limpio.webm -i full_audio.mp3 -c:v copy -c:a aac demo_final.mp4\n`);
        return;
    }

    if (!ELEVENLABS_API_KEY) {
        console.log(`⚠️ Como se usó el MOCK de audios, no uniremos todo con FFmpeg. FFMPEG está listo para cuando uses la Key.`);
        return;
    }

    console.log('Mezclando audios... (BETA)');
    // Nota: Esto es un concat simple de FFmpeg. 
    // Para funcionar a la perfección en un entorno real con audios MP3 en Windows, 
    // a veces requiere la utilidad de `concat protocol` o `filter_complex`.
    const inputListPath = path.join(outDir, 'inputs.txt');
    const audiosTxt = audios.map(a => `file '${path.basename(a.file)}'`).join('\n');
    fs.writeFileSync(inputListPath, audiosTxt);

    const fullAudioPath = path.join(outDir, 'full_audio.mp3');
    const finalMp4Path = path.join(outDir, 'demo_final.mp4');

    try {
        // 1. Unir audios
        await execPromise(`ffmpeg -y -f concat -safe 0 -i "${inputListPath}" -c copy "${fullAudioPath}"`);
        // 2. Mezclar con video
        await execPromise(`ffmpeg -y -i "${videoPath}" -i "${fullAudioPath}" -c:v copy -c:a aac "${finalMp4Path}"`);
        console.log(`\n🎉 PROCESO COMPLETO: Demo guardada exitosamente en: ${finalMp4Path}`);
    } catch (e) {
        console.error("Error uniendo con FFmpeg:", e.message);
    }
}

main().catch(console.error);
