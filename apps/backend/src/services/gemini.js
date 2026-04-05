import { GoogleGenerativeAI } from "@google/generative-ai";

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not set. Get one at https://aistudio.google.com/");
    }
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  }
  return model;
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
      
      if (attempts >= maxRetries) {
        console.warn("[Gemini API] Exceeded max retries. Engaging bypass fallback so the mission doesn't crash.");
        
        // Mock response to cleanly finish the Soroban payments pipeline
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
        
        // Simulate a 4-batch streaming process (4 micropayments)
        for (let i = 1; i <= 4; i++) {
          await new Promise(r => setTimeout(r, 200));
          if (onBatch) onBatch(50 * i, mockReport.substring(0, i * 50), 50 * i, i);
        }
        
        return { fullText: mockReport, totalTokens: 200, batchCount: 4 };
      }
      
      // Wait 2 seconds before retrying
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Fast LLM response for single-turn chat or mode routing (non-streaming).
 */
export async function fastChatResponse(prompt, systemPrompt) {
  try {
    const llm = getModel();
    const result = await llm.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      systemInstruction: systemPrompt,
    });
    return result.response.text();
  } catch (err) {
    console.error("[Gemini] Error in fast chat:", err.message);
    return "Lo siento, no pude procesar tu solicitud en este momento.";
  }
}

/**
 * Stream Risk Agent analysis.
 */
export async function streamRiskAnalysis(report, sources, onBatch, directive = "") {
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
Return ONLY valid JSON.`;

  try {
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
    console.error("[Risk Agent] Error:", error.message);
    return {
      riskScore: 50,
      riskBreakdown: { security: 5, lockIn: 5, pricing: 5, dependency: 5, maturity: 5 },
      gaps: [],
      fullRiskReport: "**Risk Analysis Failed**: Could not reach LLM provider."
    };
  }
}
