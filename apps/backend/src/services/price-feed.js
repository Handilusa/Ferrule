import * as StellarSdk from "@stellar/stellar-sdk";

const cache = new Map();
const CACHE_TTL = 60_000; // 1 minuto

export async function getPriceData(pair) {
  const now = Date.now();
  if (cache.has(pair) && now - cache.get(pair).ts < CACHE_TTL) {
    return cache.get(pair).data; // devuelve cacheado
  }

  const [base, quote] = pair.split("/"); // e.g. "XLM/USDC"
  const binanceSymbol = `${base.toUpperCase()}USDT`;

  let cgData = null;
  let ohlcv = [];
  
  try {
    cgData = await fetchBinanceTicker(binanceSymbol);
    ohlcv = await fetchBinanceOHLCV(binanceSymbol, "1h", 48); // 48 hours
  } catch (err) {
    console.error("Binance Fetch Error:", err.message);
    // Fallback stub if Binance fails
    cgData = { price: 0, change24h: 0, volume24h: 0, high24h: 0, low24h: 0, marketCap: 0 };
  }
  
  // Horizon DEX price (Stub implementation)
  const dexPrice = await fetchStellarDEX(base, quote).catch(() => null);
  const liquidity = await fetchSoroswap(base, quote).catch(() => null);

  const data = { current: cgData, ohlcv, dexPrice, liquidity };
  cache.set(pair, { data, ts: now });
  return data;
}

async function fetchBinanceTicker(symbol) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error("Binance Request failed");
    const d = await res.json();
    return {
      price: parseFloat(d.lastPrice),
      change24h: parseFloat(d.priceChangePercent),
      volume24h: parseFloat(d.quoteVolume),
      high24h: parseFloat(d.highPrice),
      low24h: parseFloat(d.lowPrice),
      marketCap: 0 // Not available in ticker endpoint, but unused in our risk models
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Binance timeout — please try again');
    throw err;
  }
}

async function fetchBinanceOHLCV(symbol, interval, limit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`, { signal: controller.signal });
    clearTimeout(timeout);
    
    if (!res.ok) throw new Error("Binance OHLCV Request failed");
    const data = await res.json();
    
    // Binance format: [Open time, Open, High, Low, Close, Volume, ...]
    // Our format: [[timestamp, open, high, low, close], ...]
    return data.map(k => [k[0], parseFloat(k[1]), parseFloat(k[2]), parseFloat(k[3]), parseFloat(k[4])]);
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') throw new Error('Binance timeout — please try again');
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
