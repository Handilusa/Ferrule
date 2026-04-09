import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

// ─── Multi-Key Pool with Automatic Failover ────────────────────────────────
// Supports: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...
// On 429/quota errors, rotates to the next key automatically.
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const MODEL_NAME = "gemini-2.5-flash";

// Pool state
let apiKeys = [];
let models = [];       // cached model per key
let currentKeyIndex = 0;
let poolInitialized = false;

function initPool() {
  if (poolInitialized) return;

  // Collect all keys: GEMINI_API_KEY, GEMINI_API_KEY_2, GEMINI_API_KEY_3, ...
  const primary = process.env.GEMINI_API_KEY;
  if (primary) apiKeys.push(primary);

  for (let i = 2; i <= 10; i++) {
    const key = process.env[`GEMINI_API_KEY_${i}`];
    if (key) apiKeys.push(key);
  }

  if (apiKeys.length === 0) {
    throw new Error("No GEMINI_API_KEY found. Set GEMINI_API_KEY (and optionally GEMINI_API_KEY_2, _3...) in env.");
  }

  // Pre-build a model instance per key
  models = apiKeys.map((key, idx) => {
    const genAI = new GoogleGenerativeAI(key);
    console.log(`[Gemini Pool] Key #${idx + 1} loaded (${key.slice(0, 6)}...${key.slice(-4)})`);
    return genAI.getGenerativeModel({ model: MODEL_NAME, safetySettings: SAFETY_SETTINGS });
  });

  console.log(`[Gemini Pool] ${apiKeys.length} key(s) in rotation pool.`);
  poolInitialized = true;
}

function getModel() {
  initPool();
  return models[currentKeyIndex];
}

/**
 * Rotate to the next API key in the pool. Returns true if there's a fresh key to try.
 */
function rotateKey(reason = "") {
  const exhaustedIdx = currentKeyIndex;
  currentKeyIndex = (currentKeyIndex + 1) % models.length;
  const label = `Key #${exhaustedIdx + 1} → Key #${currentKeyIndex + 1}`;
  console.warn(`[Gemini Pool] Rotating ${label}. Reason: ${reason}`);
  // Return false if we wrapped all the way around (all keys exhausted)
  return currentKeyIndex !== exhaustedIdx;
}

/**
 * Detect if an error is a quota/rate-limit/503/invalid key error worth rotating for.
 */
function isQuotaError(err) {
  const msg = (err.message || "").toLowerCase();
  return msg.includes("429") || msg.includes("quota") || msg.includes("resource") ||
         msg.includes("rate") || msg.includes("exhausted") || msg.includes("limit") ||
         msg.includes("503") || msg.includes("demand") || msg.includes("unavailable") ||
         msg.includes("invalid") || msg.includes("not found") || msg.includes("404");
}

/**
 * Estimate token count from text (~4 chars ≈ 1 token).
 */
export function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

/**
 * Stream LLM response, calling onBatch every ~100 tokens.
 * @param {string} prompt - The user prompt
 * @param {string} context - Search results context to inject
 * @param {function} onBatch - Callback(batchTokens, batchText, totalTokens)
 * @returns {Promise<{fullText: string, totalTokens: number}>}
 */
export async function streamLLM(prompt, context, onBatch) {
  const systemPrompt = `You are Ferrule, an elite autonomous AI research agent specialized in Due Diligence for SaaS B2B, market intelligence, and risk analysis.

ROLE: You are a paid research analyst. The user has authorized a blockchain micropayment to fund this mission. Every response must deliver maximum value.

CRITICAL INSTRUCTIONS:
1. ALWAYS reply in the SAME LANGUAGE as the USER QUERY. If they write in Spanish, your ENTIRE response must be in Spanish.
2. ALWAYS produce a structured DUE DILIGENCE report, regardless of query complexity.
3. ALWAYS cite sources using [1], [2], [3] notation referencing the SEARCH CONTEXT entries.
4. ALWAYS end with a "## Recommended Next Investigations" section suggesting 3 follow-up research missions the user could run.

REPORT STRUCTURE:
## Executive Summary
A comprehensive 2-3 paragraph overview of the vendor, the product, and its core value proposition.

## Architecture & Stack
Analysis of how the product integrates, its technological footprint, and API capabilities.

## Security & Compliance
What is known about their security posture (SOC2, ISO 27001, public incidents, data residency).

## Pricing & Lock-in Risk
Analysis of their pricing model, transparency, cost scaling, and how hard it is to migrate away from them (vendor lock-in).

## Vendor Risk Assessment
General assessment of the company maturity (funding, team, history, reliability).

## Technical Checklist
A quick bulleted rundown of pros and cons.

## Sources
Numbered list of sources used.

## Recommended Next Investigations
Three specific follow-up queries the user should investigate next.

SEARCH CONTEXT:
${context || "No search results available."}

USER QUERY:
${prompt}

CRITICAL INSTRUCTION: You are being paid a premium rate. If the USER QUERY is trivial, a joke, a greeting, or not a serious B2B/academic research topic (e.g. "lol", "hola", "qué hace"), DO NOT perform the research. Instead, return ONLY the following string: "Error: Query rejected. This console is for professional market research only. Please submit a serious B2B, academic, or financial query to protect your USDC channel funds."

If the query IS serious, deliver a MASSIVE, extremely verbose, comprehensive, and data-driven research report. NEVER be brief. Write as much relevant, high-quality analysis as possible.`;
  let attempts = 0;
  const maxRetries = 3;
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      const llm = getModel();
      const result = await llm.generateContentStream(systemPrompt);

      let fullText = "";
      let tokenBuffer = 0;
      let textBuffer = "";
      let totalTokens = 0;
      let batchCount = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (!text) continue;

        fullText += text;
        textBuffer += text;
        const chunkTokens = estimateTokens(text);
        tokenBuffer += chunkTokens;
        totalTokens += chunkTokens;

        // Fire callback every ~100 tokens
        if (tokenBuffer >= 100) {
          batchCount++;
          if (onBatch) {
            onBatch(tokenBuffer, textBuffer, totalTokens, batchCount);
          }
          tokenBuffer = 0;
          textBuffer = "";
        }
      }

      // Flush remaining
      if (tokenBuffer > 0) {
        batchCount++;
        if (onBatch) {
          onBatch(tokenBuffer, textBuffer, totalTokens, batchCount);
        }
      }

      return { fullText, totalTokens, batchCount };
    } catch (error) {
      console.error(`[Gemini API] Attempt ${attempts}/${maxRetries} failed:`, error.message);
      
      // If quota error, rotate to backup key immediately
      if (isQuotaError(error) && models.length > 1) {
        rotateKey(error.message);
        // Don't count quota rotations against retry limit
        attempts--;
      }
      
      if (attempts >= maxRetries) {
        console.warn("[Gemini API] Exceeded max retries across all keys. Engaging bypass fallback.");
        
        const mockReport = `## Executive Summary
(Fallback Mode) The LLM provider (Google Gemini) rejected the request.

## Diagnóstico del Error
El servidor de Gemini arrojó exactamente este error:
\`${error.message}\`

## Key Findings
- Your blockchain backend and payment pipeline is perfectly functional.
- The issue is entirely isolated to the API Provider connection or parameters.

## Recommended Next Investigations
Ajusta la API Key, el modelo, o lee el error de arriba para parchearlo.`;
        
        for (let i = 1; i <= 4; i++) {
          await new Promise(r => setTimeout(r, 200));
          if (onBatch) onBatch(50 * i, mockReport.substring(0, i * 50), 50 * i, i);
        }
        
        return { fullText: mockReport, totalTokens: 200, batchCount: 4 };
      }
      
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Fast LLM response for single-turn chat or mode routing (non-streaming).
 * Supports key rotation on quota errors.
 */
export async function fastChatResponse(prompt, systemPrompt) {
  const maxAttempts = models.length > 1 ? models.length + 1 : 2;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const llm = getModel();
      
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API timeout — request took longer than 15s")), 15000)
      );
      
      const requestPromise = llm.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        systemInstruction: systemPrompt,
      });

      const result = await Promise.race([requestPromise, timeoutPromise]);
      return result.response.text();
    } catch (err) {
      console.error(`[Gemini] Fast chat attempt ${attempt + 1}/${maxAttempts} error:`, err.message);
      
      if (isQuotaError(err) && models.length > 1) {
        rotateKey(err.message);
        continue; // Retry immediately with new key
      }
      
      return `⚠️ API Provider Error: ${err.message}`;
    }
  }
  return `⚠️ All ${apiKeys.length} API keys exhausted.`;
}

/**
 * Stream Risk Agent analysis.
 */
export async function streamRiskAnalysis(report, sources, onBatch, directive = "") {
  if (directive.includes("mode: trading_monitor")) {
    try {
      const responseText = await fastChatResponse(report, "Eres Ferrule, el analista Quant de derivados institucionales.");
      return {
          riskScore: 0,
          riskBreakdown: { security: 0, lockIn: 0, pricing: 0, dependency: 0, maturity: 0 },
          gaps: [],
          fullRiskReport: responseText
      };
    } catch(err) {
       return {
          riskScore: 0,
          riskBreakdown: { security: 0, lockIn: 0, pricing: 0, dependency: 0, maturity: 0 },
          gaps: [],
          fullRiskReport: "Quant analysis generation failed." 
       };
    }
  }

  let extraDirectives = directive ? `\nUSER DIRECTIVE (CRITICAL): ${directive}\n` : "";
  const systemPrompt = `You are Ferrule's autonomous Risk Agent. Your job is to read a preliminary Due Diligence report and evaluate the vendor's risk profile objectively.
${extraDirectives}
INPUT DATA:
--- PRELIMINARY REPORT ---
${report}

--- SEARCH SOURCES ---
${sources}

TASK:
Output a structured JSON response (no markdown fences, just pure JSON) with the following structure:
{
  "riskScore": number (0-100, where 100 is maximum risk/danger, 0 is perfectly safe),
  "riskBreakdown": {
     "security": number (0-10),
     "lockIn": number (0-10),
     "pricing": number (0-10),
     "dependency": number (0-10),
     "maturity": number (0-10)
  },
  "gaps": string[] (List of critical information missing from the report, e.g., "No mention of SOC2 compliance", "Pricing is completely opaque"),
  "fullRiskReport": string (Markdown summary of the risk assessment, max 3 paragraphs, formatted nicely with bolding)
}

CRITICAL RULE FOR GAPS: If the report lacks concrete details about SOC2/ISO compliance, pricing tiers, or historical security incidents, YOU MUST flag them in the "gaps" array. If you flag gaps, the orchestrator might spawn another autonomous search to fill them.
CRITICAL RULE FOR LANGUAGE: The "fullRiskReport" string MUST be written in the exact same language as the PRELIMINARY REPORT (if the report is in Spanish, write the risk assessment in Spanish).
Return ONLY valid JSON.`;

  let attempts = 0;
  const maxRetries = 2;
  
  while (attempts < maxRetries) {
    try {
      attempts++;
      const llm = getModel();
      const result = await llm.generateContentStream(systemPrompt);

      let fullText = "";
      let tokenBuffer = 0;
      let textBuffer = "";
      let totalTokens = 0;
      let batchCount = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (!text) continue;

        fullText += text;
        textBuffer += text;
        const chunkTokens = estimateTokens(text);
        tokenBuffer += chunkTokens;
        totalTokens += chunkTokens;

        if (tokenBuffer >= 100) {
          batchCount++;
          if (onBatch) onBatch(tokenBuffer, textBuffer, totalTokens, batchCount);
          tokenBuffer = 0;
          textBuffer = "";
        }
      }

      if (tokenBuffer > 0) {
        batchCount++;
        if (onBatch) onBatch(tokenBuffer, textBuffer, totalTokens, batchCount);
      }

      try {
        const cleaned = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleaned);
      } catch {
        return {
          riskScore: 50,
          riskBreakdown: { security: 5, lockIn: 5, pricing: 5, dependency: 5, maturity: 5 },
          gaps: ["Failed to parse detailed risk analysis."],
          fullRiskReport: "Risk analysis completed, but the output could not be fully parsed."
        };
      }

    } catch (error) {
      console.error(`[Risk Agent] Attempt ${attempts}/${maxRetries} error:`, error.message);
      
      if (isQuotaError(error) && models.length > 1) {
        rotateKey(error.message);
        attempts--; // Don't burn a retry on key rotation
      }
      
      if (attempts >= maxRetries) {
        return {
          riskScore: 50,
          riskBreakdown: { security: 5, lockIn: 5, pricing: 5, dependency: 5, maturity: 5 },
          gaps: [],
          fullRiskReport: "**Risk Analysis Failed**: Could not reach LLM provider."
        };
      }
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}
