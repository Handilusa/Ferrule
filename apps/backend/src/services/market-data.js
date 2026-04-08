import ccxt from 'ccxt';
import { RSI, MACD, EMA, ADX, BollingerBands, ATR, VWAP } from 'technicalindicators';

const exchange = new ccxt.binance({ enableRateLimit: true });

export async function fetchMarketData(pairStr, tf = '4h') {
  // Swap USDC to USDT for Binance liquidity fallback
  let symbol = pairStr.replace('USDC', 'USDT');
  
  let candles;
  try {
     candles = await exchange.fetchOHLCV(symbol, tf, undefined, 200);
  } catch (err) {
     symbol = pairStr;
     try {
       candles = await exchange.fetchOHLCV(symbol, tf, undefined, 200);
     } catch (e) {
       console.error(`Error fetching OHLCV for ${pairStr}: ${e.message}`);
       throw new Error(`No se pudo obtener datos del par ${pairStr}`);
     }
  }

  // Candles: [timestamp, open, high, low, close, volume]
  const highs = candles.map(c => c[2]);
  const lows = candles.map(c => c[3]);
  const closes = candles.map(c => c[4]);
  const volumes = candles.map(c => c[5]);
  
  const currentPrice = closes[closes.length - 1];
  const oldPrice = closes[closes.length - Math.min(closes.length, 7)]; 
  const change24h = ((currentPrice - oldPrice) / oldPrice * 100).toFixed(2);
  
  const volume24h = volumes.slice(-6).reduce((a, b) => a + b, 0);

  const rsiCalc = RSI.calculate({ values: closes, period: 14 });
  const macdCalc = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
  const ema50Calc = EMA.calculate({ values: closes, period: 50 });
  const ema200Calc = EMA.calculate({ values: closes, period: 200 });
  const adxCalc = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const bbCalc = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const atrCalc = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const vwapCalc = VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });

  const rsi = rsiCalc[rsiCalc.length - 1] || 50;
  const macd = macdCalc[macdCalc.length - 1] || { MACD: 0, signal: 0, histogram: 0 };
  const ema50 = ema50Calc[ema50Calc.length - 1] || currentPrice;
  const ema200 = ema200Calc[ema200Calc.length - 1] || currentPrice;
  const adxVal = adxCalc[adxCalc.length - 1]?.adx || 0;
  const bb = bbCalc[bbCalc.length - 1] || { upper: 0, middle: 0, lower: 0 };
  const atr = atrCalc[atrCalc.length - 1] || 0;
  const vwap = vwapCalc[vwapCalc.length - 1] || currentPrice;

  // Simple OBV Trend approximation
  let obvTrend = "Neutral";
  if (closes[closes.length - 1] > closes[closes.length - 2]) obvTrend = "Alcista";
  else if (closes[closes.length - 1] < closes[closes.length - 2]) obvTrend = "Bajista";

  return {
    pair: pairStr,
    tf,
    price: currentPrice,
    change24h,
    volume: volume24h.toFixed(2),
    rsi: rsi.toFixed(2),
    macd: {
        MACD: macd.MACD ? macd.MACD.toFixed(5) : 0,
        signal: macd.signal ? macd.signal.toFixed(5) : 0,
        histogram: macd.histogram ? macd.histogram.toFixed(5) : 0
    },
    ema50: ema50.toFixed(5),
    ema200: ema200.toFixed(5),
    adx: adxVal.toFixed(2),
    bb: {
        upper: bb.upper ? bb.upper.toFixed(5) : 0,
        middle: bb.middle ? bb.middle.toFixed(5) : 0,
        lower: bb.lower ? bb.lower.toFixed(5) : 0
    },
    atr: atr.toFixed(5),
    vwap: vwap.toFixed(5),
    obvTrend,
    candlePattern: "ninguno detectado"
  };
}
