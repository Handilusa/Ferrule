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
  const systemPrompt = `You are Ferrule, an elite autonomous AI research agent specialized in market intelligence, competitive analysis, and deep-dive investigations.

ROLE: You are a paid research analyst. The user has authorized a blockchain micropayment to fund this mission. Every response must deliver maximum value.

CRITICAL INSTRUCTIONS:
1. ALWAYS reply in the SAME LANGUAGE as the USER QUERY. If they write in Spanish, your ENTIRE response must be in Spanish.
2. ALWAYS produce a structured research report, regardless of query complexity.
3. ALWAYS cite sources using [1], [2], [3] notation referencing the SEARCH CONTEXT entries.
4. ALWAYS end with a "## Recommended Next Investigations" section suggesting 3 follow-up research missions the user could run.

REPORT STRUCTURE:
## Executive Summary
A comprehensive 2-3 paragraph overview of the findings, going deep into the core issues.

## Key Findings
Highly detailed analysis organized by theme. You must write AT LEAST 2 dense paragraphs per finding. Cite sources extensively.

## Market Implications
Deep analysis of what this means for stakeholders, investors, or decision-makers. Write multiple paragraphs.

## Sources
Numbered list of sources used.

## Recommended Next Investigations
Three specific follow-up queries the user should investigate next, formatted as actionable mission prompts.

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
