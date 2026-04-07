const SEARX_URLS = [
  "https://search.ononoki.org",
  "https://searx.be",
  "https://searx.tiekoetter.com",
  "https://search.mdosch.de",
  "https://search.bus-hit.me"
];

/**
 * Search the web using a public SearXNG instance.
 * @param {string} query - Search query
 * @param {number} maxResults - Maximum results to return (default 5)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, maxResults = 5) {
  const SEARX_URL = SEARX_URLS[Math.floor(Math.random() * SEARX_URLS.length)];
  try {
    const params = new URLSearchParams({
      q: query,
      format: "json",
      engines: "google,duckduckgo,bing",
      language: "en",
    });

    const response = await fetch(`${SEARX_URL}/search?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    if (!response.ok) {
      console.warn(`[Search] SearXNG (${SEARX_URL}) returned ${response.status}, using Wikipedia fallback`);
      return fetchWikipediaFallback(query);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return fetchWikipediaFallback(query);
    }

    return data.results.slice(0, maxResults).map((r) => ({
      title: r.title || "Untitled",
      url: r.url || "",
      snippet: r.content || r.description || "",
    }));
  } catch (error) {
    console.error(`[Search] Error: ${error.message}`);
    return fetchWikipediaFallback(query);
  }
}

async function fetchWikipediaFallback(query) {
  try {
    // Attempt to grab wikipedia summary if SearX fails
    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`;
    const res = await fetch(wikiUrl);
    const data = await res.json();
    if (data.query && data.query.search && data.query.search.length > 0) {
      return data.query.search.slice(0, 3).map(s => ({
        title: s.title,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(s.title)}`,
        snippet: s.snippet.replace(/<[^>]*>/g, '')
      }));
    }
  } catch(e) {}
  
  return [{
    title: `Web search for: ${query}`,
    url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    snippet: `Live search unavailable. The AI agent will analyze "${query}" using its training knowledge.`,
  }];
}
