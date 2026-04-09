import * as StellarSdk from "@stellar/stellar-sdk";

const cache = new Map();
const CACHE_TTL = 60_000; // 1 minuto

export async function getPriceData(pair) {
  const now = Date.now();
  if (cache.has(pair) && now - cache.get(pair).ts < CACHE_TTL) {
    return cache.get(pair).data; // devuelve cacheado
  }

  const [base, quote] = pair.split("/"); // e.g. "XLM/USDC"
  const kucoinSymbol = `${base.toUpperCase()}-USDT`;

  let cgData = null;
  let ohlcv = [];
  
  try {
    cgData = await fetchKucoinTicker(kucoinSymbol);
    ohlcv = await fetchKucoinOHLCV(kucoinSymbol, "1hour"); // 48 hours is default? Wait, I will need to handle how many items
  } catch (err) {
    console.error("KuCoin Fetch Error:", err.message);
    // Fallback stub if KuCoin fails
    cgData = { price: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, marketCap: 0 };
  }
  
  // Horizon DEX price (Stub implementation)
  const dexPrice = await fetchStellarDEX(base, quote).catch(() => null);
  const liquidity = await fetchSoroswap(base, quote).catch(() => null);

  const data = { current: cgData, ohlcv, dexPrice, liquidity };
  cache.set(pair, { data, ts: now });
  return data;
}

async function fetchKucoinTicker(symbol) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const res = await fetch(`https://api.kucoin.com/api/v1/market/stats?symbol=${symbol}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error("KuCoin Request failed");
    const d = await res.json();
    return {
      price: parseFloat(d.data.last),
      change24h: parseFloat(d.data.changeRate) * 100, // KuCoin gives 0.0141, we need 1.41
      volume24h: parseFloat(d.data.volValue),
      high24h: parseFloat(d.data.high),
      low24h: parseFloat(d.data.low),
      marketCap: 0 // Not available in ticker endpoint, but unused in our risk models
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('KuCoin timeout — please try again');
    throw err;
  }
}

async function fetchKucoinOHLCV(symbol, type) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const res = await fetch(`https://api.kucoin.com/api/v1/market/candles?type=${type}&symbol=${symbol}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error("KuCoin OHLCV Request failed");
    const data = await res.json();
    
    // KuCoin format: [time, open, close, high, low, amount, volume]
    // Time is in seconds string, descending order.
    // Our format: [[timestampMs, open, high, low, close], ...]
    if (!data.data) return [];
    
    const mapped = data.data.map(k => [
      parseInt(k[0]) * 1000, 
      parseFloat(k[1]), // open
      parseFloat(k[3]), // high
      parseFloat(k[4]), // low
      parseFloat(k[2])  // close
    ]);
    
    // Reverse because KuCoin gives newest at index 0, we need newest at the end
    // Slice to 48 hours for indicator computation stability
    return mapped.slice(0, 48).reverse();
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('KuCoin timeout — please try again');
    throw err;
  }
}

async function fetchStellarDEX(base, quote) {
    // In a real implementation this queries horizon server orderbook
    return null; 
}

async function fetchSoroswap(base, quote) {
    return null;
}
