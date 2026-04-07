import { tavily } from "@tavily/core";

/**
 * Search the web using Tavily API.
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return (default 5)
 * @param {string[]} allowedDomains - Optional list of domains to filter by (from AP2 Mandates)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, maxResults = 5, allowedDomains = []) {
  try {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      console.warn("[Search] TAVILY_API_KEY Missing, falling back to dummy");
      return fallbackDummy(query);
    }
    
    const client = tavily({ apiKey });
    
    const searchOptions = {
      searchDepth: "basic",
      maxResults: maxResults
    };
    
    if (allowedDomains && allowedDomains.length > 0) {
      searchOptions.includeDomains = allowedDomains.map(d => d.replace(/^\*\./, ""));
    }

    const data = await client.search(query, searchOptions);

    if (!data.results || data.results.length === 0) {
      return fallbackDummy(query);
    }

    return data.results.map((r) => ({
      title: r.title || "Untitled",
      url: r.url || "",
      snippet: r.content || "",
    }));
  } catch (error) {
    console.error(`[Search] Error using Tavily: ${error.message}`);
    return fallbackDummy(query);
  }
}

function fallbackDummy(query) {
  return [{
    title: `Web search for: ${query}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    snippet: `Live search unavailable. The AI agent will analyze "${query}" using its training knowledge.`,
  }];
}
