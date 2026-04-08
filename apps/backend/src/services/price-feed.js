import * as StellarSdk from "@stellar/stellar-sdk";

const cache = new Map();
const CACHE_TTL = 60_000; // 1 minuto

export async function getPriceData(pair) {
  const now = Date.now();
  if (cache.has(pair) && now - cache.get(pair).ts < CACHE_TTL) {
    return cache.get(pair).data; // devuelve cacheado
  }

  const [base, quote] = pair.split("/"); // e.g. "XLM/USDC"
  
  // Clean base for coingecko (xlm -> stellar)
  let coinId = base.toLowerCase();
  if (coinId === "xlm") coinId = "stellar";
  if (coinId === "btc") coinId = "bitcoin";
  if (coinId === "eth") coinId = "ethereum";
  if (coinId === "sol") coinId = "solana";

  let cgData = null;
  let ohlcv = [];
  
  try {
    cgData = await fetchCoinGecko(coinId);
    ohlcv = await fetchOHLCV(coinId, "usd", 1);
  } catch (err) {
    console.error("CoinGecko Fetch Error:", err.message);
    // Fallback stub if CG fails or API key is missing
    cgData = { price: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, marketCap: 0 };
  }
  
  // Horizon DEX price (Stub implementation  // Dex Price e.g. 
  const dexPrice = await fetchStellarDEX(base, quote).catch(() => null);
  const liquidity = await fetchSoroswap(base, quote).catch(() => null);

  const data = { current: cgData, ohlcv, dexPrice, liquidity };
  cache.set(pair, { data, ts: now });
  return data;
}

async function fetchCoinGecko(coinId) {
  const headers = {};
  if (process.env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&community_data=false`,
    { headers }
  );
  if (!res.ok) throw new Error("CG Request failed");
  const d = await res.json();
  return {
    price: d.market_data.current_price.usd,
    change24h: d.market_data.price_change_percentage_24h,
    volume24h: d.market_data.total_volume.usd,
    high24h: d.market_data.high_24h.usd,
    low24h: d.market_data.low_24h.usd,
    marketCap: d.market_data.market_cap.usd
  };
}

async function fetchOHLCV(coinId, currency, days) {
  const headers = {};
  if (process.env.COINGECKO_API_KEY) {
      headers["x-cg-demo-api-key"] = process.env.COINGECKO_API_KEY;
  }
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/${coinId}/ohlc?vs_currency=${currency}&days=${days}`,
    { headers }
  );
  if (!res.ok) throw new Error("CG OHLCV Request failed");
  return res.json(); // [[timestamp, open, high, low, close], ...]
}

async function fetchStellarDEX(base, quote) {
    // In a real implementation this queries horizon server orderbook
    return null; 
}

async function fetchSoroswap(base, quote) {
    return null;
}
