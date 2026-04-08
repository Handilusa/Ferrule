export function computeIndicators(ohlcv) {
  if (!ohlcv || ohlcv.length === 0) {
      return { rsi: 50, ema9: 0, ema21: 0, support: 0, resistance: 0, trend: "neutral", volumeSpike: false };
  }

  const closes = ohlcv.map(c => c[4]);
  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);

  return {
    rsi: computeRSI(closes, 14),
    ema9: computeEMA(closes, 9),
    ema21: computeEMA(closes, 21),
    atr: computeATR(highs, lows, closes, 14),
    support: Math.min(...lows.slice(-20)),         // mínimo de las últimas 20 velas
    resistance: Math.max(...highs.slice(-20)),     // máximo de las últimas 20 velas
    trend: detectTrend(closes),                    // "bullish" | "bearish" | "sideways"
    volumeSpike: detectVolumeSpike(ohlcv)
  }
}

function computeRSI(closes, period = 14) {
  if (closes.length <= period) return 50;
  
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = gains / (losses === 0 ? 1 : losses);
  return 100 - (100 / (1 + rs));
}

function computeEMA(closes, period) {
  if (closes.length < period) return closes[closes.length - 1];
  
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function detectTrend(closes) {
  if (closes.length < 21) return "sideways";
  
  const recent = closes.slice(-9);
  const early = closes.slice(-21, -9);
  const recentAvg = recent.reduce((a,b) => a+b) / recent.length;
  const earlyAvg = early.reduce((a,b) => a+b) / early.length;
  
  if (recentAvg > earlyAvg * 1.03) return "bullish";
  if (recentAvg < earlyAvg * 0.97) return "bearish";
  return "sideways";
}

function detectVolumeSpike(ohlcv) {
   // Optional implementation
   return false;
}

function computeATR(highs, lows, closes, period) {
  if (closes.length < period + 1) return 0;
  let trSum = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trSum += Math.max(hl, hc, lc);
  }
  return trSum / period;
}

export function buildMarketPrompt(pair, priceData, indicators, news) {
  return `
Eres un analista quant senior de derivados perpetuos. NO eres un evaluador de proveedores.

Par: ${pair} | Precio: $${priceData.current.price}
RSI(14): ${indicators.rsi.toFixed(1)}
EMA 9/21: ${indicators.ema9.toFixed(4)} / ${indicators.ema21.toFixed(4)}
ATR(14): ${indicators.atr.toFixed(4)}
Soporte: ${indicators.support.toFixed(4)} | Resistencia: ${indicators.resistance.toFixed(4)}

Genera SOLO esto en markdown Telegram:
1. 🎯 Bias direccional (LONG/SHORT/NEUTRAL) con confianza %
2. 📍 Entrada óptima
3. 🛑 Stop Loss (basado en ATR x1.5)
4. 🎯 Take Profit R/R 1:2 y 1:3
5. 💡 Confluencias clave
  `.trim();
}

export function rsiSignal(rsi) {
  if (rsi < 30) return "⚡ SOBREVENTA — posible rebote";
  if (rsi > 70) return "🔴 SOBRECOMPRA — posible corrección";
  return "🟡 zona neutral";
}

export function detectSignal(indicators, priceData) {
  const signals = [];

  // RSI extremo
  if (indicators.rsi < 32) 
    signals.push({ type: "RSI_OVERSOLD", strength: "HIGH", 
      msg: `RSI en ${indicators.rsi.toFixed(1)} — zona de sobreventa histórica` });
  if (indicators.rsi > 68) 
    signals.push({ type: "RSI_OVERBOUGHT", strength: "HIGH",
      msg: `RSI en ${indicators.rsi.toFixed(1)} — zona de sobrecompra` });

  // Cruce de EMAs
  if (indicators.ema21 > 0 && Math.abs(indicators.ema9 - indicators.ema21) / indicators.ema21 < 0.005)
    signals.push({ type: "EMA_CROSS_IMMINENT", strength: "MEDIUM",
      msg: `EMA9 y EMA21 convergiendo — posible cruce inminente` });

  // Precio cerca de soporte/resistencia (±2%)
  if (indicators.support > 0 && indicators.resistance > 0) {
      const nearSupport = (priceData.current.price - indicators.support) / indicators.support < 0.02;
      const nearResistance = (indicators.resistance - priceData.current.price) / indicators.resistance < 0.02;
      if (nearSupport) signals.push({ type: "NEAR_SUPPORT", strength: "HIGH",
        msg: `Precio a ${((priceData.current.price - indicators.support) / indicators.support * 100).toFixed(1)}% del soporte $${indicators.support.toFixed(4)}` });
      if (nearResistance) signals.push({ type: "NEAR_RESISTANCE", strength: "MEDIUM",
        msg: `Precio a ${((indicators.resistance - priceData.current.price) / indicators.resistance * 100).toFixed(1)}% de resistencia $${indicators.resistance.toFixed(4)}` });
  }

  return signals;
}
