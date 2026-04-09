export function computeIndicators(ohlcv) {
  if (!ohlcv || ohlcv.length === 0) {
      return { 
          rsi: 50, ema9: 0, ema21: 0, atr: 0, support: 0, resistance: 0, trend: "neutral", 
          macd: { macd: 0, signal: 0, hist: 0, label: 'neutral' }, obv: { value: 0, label: 'neutral' },
          fibs: [], adx: { value: 0, label: 'neutral' }
      };
  }

  const closes = ohlcv.map(c => c[4]);
  const highs = ohlcv.map(c => c[2]);
  const lows = ohlcv.map(c => c[3]);
  const volumes = ohlcv.map(c => c[5] || 0);

  const ema9 = computeEMA(closes, 9);
  const ema21 = computeEMA(closes, 21);
  const trend = ema9 > ema21 ? '📈 bullish' : ema9 < ema21 ? '📉 bearish' : '➡️ sideways';

  return {
    rsi: computeRSI(closes, 14),
    ema9,
    ema21,
    atr: computeATR(highs, lows, closes, 14),
    support: Math.min(...lows.slice(-20)),         
    resistance: Math.max(...highs.slice(-20)),     
    trend,
    macd: computeMACD(closes),
    obv: computeOBV(closes, volumes),
    fibs: computeFibs(highs, lows),
    adx: computeADX(highs, lows, closes, 14),
    volumeSpike: false
  };
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

function computeMACD(closes) {
    if (closes.length < 26) return { macd: 0, signal: 0, hist: 0, label: 'neutral' };
    
    const getEmaSeries = (data, p) => {
        let ema = data.slice(0, p).reduce((a,b)=>a+b)/p;
        const res = Array(p-1).fill(0);
        res.push(ema);
        for(let i=p; i<data.length; i++){
            ema = data[i]*(2/(p+1)) + ema*(1 - (2/(p+1)));
            res.push(ema);
        }
        return res;
    };
    
    const ema12 = getEmaSeries(closes, 12);
    const ema26 = getEmaSeries(closes, 26);
    const macdSeries = closes.map((_, i) => ema12[i] - ema26[i]);
    const validMacd = macdSeries.slice(25);
    
    const signalSeries = getEmaSeries(validMacd, 9);
    const macd = macdSeries[macdSeries.length - 1];
    const signal = signalSeries[signalSeries.length - 1];
    const hist = macd - signal;
    
    let label = 'neutral';
    if (hist > 0 && hist > (macdSeries[macdSeries.length-2] - (signalSeries[signalSeries.length-2] || 0))) {
        label = '📈 bullish momentum accelerating';
    } else if (hist < 0 && hist < (macdSeries[macdSeries.length-2] - (signalSeries[signalSeries.length-2] || 0))) {
        label = '📉 bearish momentum accelerating';
    } else if (hist > 0) {
        label = '✅ positive momentum';
    } else {
        label = '⚠️ negative momentum';
    }
    
    return { macd, signal, hist, label };
}

function computeOBV(closes, volumes) {
    if(closes.length < 2) return { value: 0, label: 'neutral' };
    let obv = [0];
    for(let i=1; i<closes.length; i++){
        if (closes[i] > closes[i-1]) obv.push(obv[i-1] + volumes[i]);
        else if (closes[i] < closes[i-1]) obv.push(obv[i-1] - volumes[i]);
        else obv.push(obv[i-1]);
    }
    const currentPriceUp = closes[closes.length-1] > closes[closes.length-2];
    const currentObvUp = obv[obv.length-1] > obv[obv.length-2];
    
    let label = 'neutral';
    if (currentPriceUp && currentObvUp) label = '✅ breakout confirmed by volume';
    else if (currentPriceUp && !currentObvUp) label = '⚠️ bearish volume divergence';
    else if (!currentPriceUp && !currentObvUp) label = '📉 downtrend confirmed';
    else if (!currentPriceUp && currentObvUp) label = '🟢 bullish volume divergence';
    
    return { value: obv[obv.length-1], label };
}

function computeFibs(highs, lows) {
    if(highs.length === 0) return [];
    const high = Math.max(...highs.slice(-200));
    const low = Math.min(...lows.slice(-200));
    const fibStrs = [0.236, 0.382, 0.5, 0.618, 0.786];
    return fibStrs.map(f => low + (high - low) * f);
}

function computeADX(highs, lows, closes, period = 14) {
    if (closes.length < period * 2) return { value: 20, label: 'neutral' };
    const tr = []; const pDM = []; const nDM = [];
    for(let i=1; i<closes.length; i++){
        const hl = highs[i] - lows[i];
        const hc = Math.abs(highs[i] - closes[i-1]);
        const lc = Math.abs(lows[i] - closes[i-1]);
        tr.push(Math.max(hl, hc, lc));
        
        const upMove = highs[i] - highs[i-1];
        const downMove = lows[i-1] - lows[i];
        
        if (upMove > downMove && upMove > 0) pDM.push(upMove); else pDM.push(0);
        if (downMove > upMove && downMove > 0) nDM.push(downMove); else nDM.push(0);
    }
    const wildersSM = (arr, p) => {
        let sum = arr.slice(0, p).reduce((a,b)=>a+b);
        const res = [sum];
        for(let i=p; i<arr.length; i++){
            sum = sum - (sum/p) + arr[i];
            res.push(sum);
        }
        return res;
    };
    const smoothedTR = wildersSM(tr, period);
    const smoothedPDM = wildersSM(pDM, period);
    const smoothedNDM = wildersSM(nDM, period);
    
    const dx = smoothedPDM.map((pDI, i) => {
        const trVal = smoothedTR[i];
        if (trVal === 0) return 0;
        const pDIVal = (pDI / trVal) * 100;
        const nDIVal = (smoothedNDM[i] / trVal) * 100;
        if (pDIVal + nDIVal === 0) return 0;
        return Math.abs(pDIVal - nDIVal) / (pDIVal + nDIVal) * 100;
    });
    
    // Smooth DX to get ADX
    const adxSmoothed = wildersSM(dx, period);
    const adxVal = adxSmoothed[adxSmoothed.length - 1] / period; 
    
    let label = adxVal > 25 ? '💪 strong trend' : '😴 sideways/weak trend — unreliable signals';
    return { value: adxVal, label };
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
  const fibStr = indicators.fibs && indicators.fibs.length > 0 ? 
                 `Fib 38.2%: $${indicators.fibs[1].toFixed(2)} | 61.8%: $${indicators.fibs[3].toFixed(2)}` : '';

  return `
You are a senior quantitative analyst for perpetual derivatives. You are NOT evaluating providers.

Pair: ${pair} | Price: $${priceData.current.price}
RSI(14): ${indicators.rsi.toFixed(1)} (${rsiSignal(indicators.rsi)})
EMA 9/21: ${indicators.ema9.toFixed(4)} / ${indicators.ema21.toFixed(4)} (${indicators.trend})
MACD (12,26,9): Hist ${indicators.macd.hist.toFixed(2)} (${indicators.macd.label})
OBV: ${indicators.obv.label}
ADX(14): ${indicators.adx.value.toFixed(1)} (${indicators.adx.label})
ATR(14): ${indicators.atr.toFixed(4)}
Support: ${indicators.support.toFixed(4)} | Resistance: ${indicators.resistance.toFixed(4)}
${fibStr}

Generate ONLY this in Telegram Markdown:
1. 🎯 Directional Bias (LONG/SHORT/NEUTRAL) with % confidence
2. 📍 Optimal Entry (specific price)
3. 🛑 Stop Loss (based on ATR x1.5)
4. 🎯 Take Profit R/R 1:2 and 1:3
5. 💡 Key Confluences
  `.trim();
}

export function rsiSignal(rsi) {
  if (rsi >= 70) return '🔴 overbought';
  if (rsi >= 60) return '🟠 near overbought';
  if (rsi <= 30) return '🟢 oversold';
  if (rsi <= 40) return '🟡 near oversold';
  return '⚪ neutral';
}

export function detectSignal(indicators, priceData) {
  const signals = [];

  if (indicators.rsi < 32) 
    signals.push({ type: "RSI_OVERSOLD", strength: "HIGH", msg: `RSI at ${indicators.rsi.toFixed(1)} — extreme oversold` });
  if (indicators.rsi > 68) 
    signals.push({ type: "RSI_OVERBOUGHT", strength: "HIGH", msg: `RSI at ${indicators.rsi.toFixed(1)} — overbought zone` });

  if (indicators.ema21 > 0 && Math.abs(indicators.ema9 - indicators.ema21) / indicators.ema21 < 0.005)
    signals.push({ type: "EMA_CROSS_IMMINENT", strength: "MEDIUM", msg: `EMA9 and EMA21 converging — potential cross` });

  if (indicators.support > 0 && indicators.resistance > 0) {
      const nearSupport = (priceData.current.price - indicators.support) / indicators.support < 0.02;
      const nearResistance = (indicators.resistance - priceData.current.price) / indicators.resistance < 0.02;
      if (nearSupport) signals.push({ type: "NEAR_SUPPORT", strength: "HIGH",
        msg: `Price within ${((priceData.current.price - indicators.support) / indicators.support * 100).toFixed(1)}% of support $${indicators.support.toFixed(4)}` });
      if (nearResistance) signals.push({ type: "NEAR_RESISTANCE", strength: "MEDIUM",
        msg: `Price within ${((indicators.resistance - priceData.current.price) / indicators.resistance * 100).toFixed(1)}% of resistance $${indicators.resistance.toFixed(4)}` });
  }

  return signals;
}
