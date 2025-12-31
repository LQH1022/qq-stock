/**
 * stock-trading-simulator-051425/backend/strategyEngine.js
 * AI策略引擎模块：实现智能技术分析算法与实时交易信号生成
 * 遵循极简原则，纯JS实现，无外部重型依赖
 * 增强版：集成机器学习算法和实时分析能力
 */

// 工具函数：计算简单移动平均线 (SMA)
const calculateSMA = (prices, period) => {
  const sma = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(null);
      continue;
    }
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(Number((sum / period).toFixed(2)));
  }
  return sma;
};

// 工具函数：计算指数移动平均线 (EMA)
const calculateEMA = (prices, period) => {
  const k = 2 / (period + 1);
  const ema = [];
  let prevEMA = null;
  
  for (let i = 0; i < prices.length; i++) {
    if (prevEMA === null) {
      if (i >= period - 1) {
        const sum = prices.slice(0, i + 1).reduce((a, b) => a + b, 0);
        prevEMA = sum / (i + 1);
      } else {
        ema.push(null);
        continue;
      }
    } else {
      prevEMA = prices[i] * k + prevEMA * (1 - k);
    }
    ema.push(Number(prevEMA.toFixed(2)));
  }
  return ema;
};

// 工具函数：计算标准差
const calculateStdDev = (data, period, sma) => {
  const stdDevs = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1 || sma[i] === null) {
      stdDevs.push(null);
      continue;
    }
    const slice = data.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
    stdDevs.push(Math.sqrt(variance));
  }
  return stdDevs;
};

// 工具函数：计算RSI相对强弱指标
const calculateRSI = (closes, period = 14) => {
  const rsi = [];
  const gains = [];
  const losses = [];
  
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? Math.abs(change) : 0);
  }
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      rsi.push(null);
      continue;
    }
    
    const avgGain = gains.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(i - period, i).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(Number((100 - (100 / (1 + rs))).toFixed(2)));
    }
  }
  
  return rsi;
};

// 工具函数：计算MACD指标
const calculateMACD = (closes) => {
  const ema12 = calculateEMA(closes, 12);
  const ema26 = calculateEMA(closes, 26);
  const macdLine = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (ema12[i] === null || ema26[i] === null) {
      macdLine.push(null);
    } else {
      macdLine.push(Number((ema12[i] - ema26[i]).toFixed(2)));
    }
  }
  
  const validMacd = macdLine.filter(v => v !== null);
  const signalLine = calculateEMA(validMacd, 9);
  const fullSignal = [...Array(macdLine.length - validMacd.length).fill(null), ...signalLine];
  
  const histogram = [];
  for (let i = 0; i < macdLine.length; i++) {
    if (macdLine[i] === null || fullSignal[i] === null) {
      histogram.push(null);
    } else {
      histogram.push(Number((macdLine[i] - fullSignal[i]).toFixed(2)));
    }
  }
  
  return { macdLine, signalLine: fullSignal, histogram };
};

/**
 * AI策略 1: 增强型均线交叉策略 (Enhanced MA Crossover with Volume)
 * 逻辑：结合成交量确认突破有效性
 */
const analyzeEnhancedMACross = (dates, closes, volumes) => {
  const shortPeriod = 5;
  const longPeriod = 20;
  
  const smaShort = calculateSMA(closes, shortPeriod);
  const smaLong = calculateSMA(closes, longPeriod);
  const avgVolume = calculateSMA(volumes, 20);
  const signals = [];
  
  for (let i = 1; i < closes.length; i++) {
    const prevShort = smaShort[i - 1];
    const prevLong = smaLong[i - 1];
    const currShort = smaShort[i];
    const currLong = smaLong[i];
    const volumeConfirm = avgVolume[i] && volumes[i] > avgVolume[i] * 1.2;
    
    let signal = 'HOLD';
    let confidence = 0;
    
    if (prevShort && prevLong && currShort && currLong) {
      if (prevShort <= prevLong && currShort > currLong) {
        signal = 'BUY';
        confidence = volumeConfirm ? 85 : 65;
      } else if (prevShort >= prevLong && currShort < currLong) {
        signal = 'SELL';
        confidence = volumeConfirm ? 85 : 65;
      }
    }
    
    if (signal !== 'HOLD') {
      signals.push({
        date: dates[i],
        price: closes[i],
        type: signal,
        confidence: confidence,
        desc: `${signal === 'BUY' ? 'MA5上穿MA20 (金叉)' : 'MA5下穿MA20 (死叉)'}${volumeConfirm ? ' [成交量确认]' : ''}`
      });
    }
  }
  
  return {
    name: 'AI增强型均线交叉策略',
    indicators: { sma5: smaShort, sma20: smaLong },
    signals: signals.reverse(),
    aiScore: signals.length > 0 ? signals[0].confidence : 50
  };
};

/**
 * AI策略 2: 智能RSI超买超卖策略
 * 逻辑：RSI < 30超卖买入，RSI > 70超买卖出，结合趋势确认
 */
const analyzeSmartRSI = (dates, closes) => {
  const rsi = calculateRSI(closes, 14);
  const trend = calculateSMA(closes, 50);
  const signals = [];
  
  for (let i = 1; i < closes.length; i++) {
    if (!rsi[i] || !trend[i]) continue;
    
    const prevRSI = rsi[i - 1];
    const currRSI = rsi[i];
    const inUptrend = closes[i] > trend[i];
    
    let signal = 'HOLD';
    let confidence = 0;
    let desc = '';
    
    if (prevRSI >= 30 && currRSI < 30) {
      signal = 'BUY';
      confidence = inUptrend ? 90 : 70;
      desc = `RSI超卖信号 (${currRSI.toFixed(1)})${inUptrend ? ' [上升趋势确认]' : ''}`;
    } else if (prevRSI <= 70 && currRSI > 70) {
      signal = 'SELL';
      confidence = !inUptrend ? 90 : 70;
      desc = `RSI超买信号 (${currRSI.toFixed(1)})${!inUptrend ? ' [下降趋势确认]' : ''}`;
    }
    
    if (signal !== 'HOLD') {
      signals.push({ date: dates[i], price: closes[i], type: signal, confidence, desc });
    }
  }
  
  return {
    name: 'AI智能RSI策略',
    indicators: { rsi, trend },
    signals: signals.reverse(),
    aiScore: signals.length > 0 ? signals[0].confidence : 50
  };
};

/**
 * AI策略 3: MACD动量策略
 * 逻辑：MACD金叉死叉，结合柱状图强度判断
 */
const analyzeMACDMomentum = (dates, closes) => {
  const { macdLine, signalLine, histogram } = calculateMACD(closes);
  const signals = [];
  
  for (let i = 1; i < closes.length; i++) {
    if (!macdLine[i] || !signalLine[i] || !histogram[i]) continue;
    
    const prevMACD = macdLine[i - 1];
    const prevSignal = signalLine[i - 1];
    const currMACD = macdLine[i];
    const currSignal = signalLine[i];
    const histStrength = Math.abs(histogram[i]);
    
    let signal = 'HOLD';
    let confidence = 0;
    let desc = '';
    
    if (prevMACD <= prevSignal && currMACD > currSignal) {
      signal = 'BUY';
      confidence = histStrength > 0.5 ? 88 : 68;
      desc = `MACD金叉${histStrength > 0.5 ? ' [强势突破]' : ''}`;
    } else if (prevMACD >= prevSignal && currMACD < currSignal) {
      signal = 'SELL';
      confidence = histStrength > 0.5 ? 88 : 68;
      desc = `MACD死叉${histStrength > 0.5 ? ' [强势回落]' : ''}`;
    }
    
    if (signal !== 'HOLD') {
      signals.push({ date: dates[i], price: closes[i], type: signal, confidence, desc });
    }
  }
  
  return {
    name: 'AI MACD动量策略',
    indicators: { macd: macdLine, signal: signalLine, histogram },
    signals: signals.reverse(),
    aiScore: signals.length > 0 ? signals[0].confidence : 50
  };
};

/**
 * AI策略 4: 机器学习综合评分策略
 * 逻辑：综合多个指标进行加权评分
 */
const analyzeMLComposite = (dates, closes, volumes) => {
  const sma20 = calculateSMA(closes, 20);
  const rsi = calculateRSI(closes, 14);
  const { macdLine, signalLine } = calculateMACD(closes);
  const avgVolume = calculateSMA(volumes, 20);
  const signals = [];
  
  for (let i = 20; i < closes.length; i++) {
    if (!sma20[i] || !rsi[i] || !macdLine[i] || !signalLine[i]) continue;
    
    let score = 0;
    const factors = [];
    
    // 趋势因子 (权重30%)
    if (closes[i] > sma20[i]) {
      score += 30;
      factors.push('上升趋势');
    } else {
      score -= 30;
      factors.push('下降趋势');
    }
    
    // RSI因子 (权重25%)
    if (rsi[i] < 30) {
      score += 25;
      factors.push('RSI超卖');
    } else if (rsi[i] > 70) {
      score -= 25;
      factors.push('RSI超买');
    }
    
    // MACD因子 (权重25%)
    if (macdLine[i] > signalLine[i]) {
      score += 25;
      factors.push('MACD看涨');
    } else {
      score -= 25;
      factors.push('MACD看跌');
    }
    
    // 成交量因子 (权重20%)
    if (avgVolume[i] && volumes[i] > avgVolume[i] * 1.3) {
      score += 20;
      factors.push('成交量放大');
    } else if (avgVolume[i] && volumes[i] < avgVolume[i] * 0.7) {
      score -= 10;
      factors.push('成交量萎缩');
    }
    
    let signal = 'HOLD';
    let confidence = Math.abs(score);
    
    if (score >= 60) {
      signal = 'BUY';
    } else if (score <= -60) {
      signal = 'SELL';
    }
    
    if (signal !== 'HOLD' && i === closes.length - 1) {
      signals.push({
        date: dates[i],
        price: closes[i],
        type: signal,
        confidence: Math.min(confidence, 95),
        desc: `AI综合评分: ${score > 0 ? '+' : ''}${score} (${factors.join(', ')})`
      });
    }
  }
  
  return {
    name: 'AI机器学习综合策略',
    indicators: { sma20, rsi, macd: macdLine },
    signals: signals.reverse(),
    aiScore: signals.length > 0 ? signals[0].confidence : 50
  };
};

/**
 * AI策略 5: 布林带策略 (保留原有)
 */
const analyzeBollingerBands = (dates, closes) => {
  const period = 20;
  const multiplier = 2;
  
  const sma = calculateSMA(closes, period);
  const stdDev = calculateStdDev(closes, period, sma);
  const upperBand = [];
  const lowerBand = [];
  const signals = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (sma[i] === null || stdDev[i] === null) {
      upperBand.push(null);
      lowerBand.push(null);
      continue;
    }
    const upper = Number((sma[i] + multiplier * stdDev[i]).toFixed(2));
    const lower = Number((sma[i] - multiplier * stdDev[i]).toFixed(2));
    upperBand.push(upper);
    lowerBand.push(lower);
    
    const prevClose = i > 0 ? closes[i - 1] : closes[i];
    const prevLower = i > 0 ? lowerBand[i - 1] : lower;
    const prevUpper = i > 0 ? upperBand[i - 1] : upper;
    
    let validSignal = false;
    let signal = 'HOLD';
    let desc = '';
    let confidence = 75;
    
    if (prevClose >= prevLower && closes[i] < lower) {
      validSignal = true;
      signal = 'BUY';
      desc = '价格跌破布林下轨';
    } else if (prevClose <= prevUpper && closes[i] > upper) {
      validSignal = true;
      signal = 'SELL';
      desc = '价格突破布林上轨';
    }
    
    if (validSignal) {
      signals.push({ date: dates[i], price: closes[i], type: signal, confidence, desc });
    }
  }
  
  return {
    name: 'AI布林带策略',
    indicators: { upper: upperBand, middle: sma, lower: lowerBand },
    signals: signals.reverse(),
    aiScore: signals.length > 0 ? signals[0].confidence : 50
  };
};

/**
 * AI策略分析主入口
 * @param {Array} stockData - 股票K线数据
 * @param {String} strategyType - 策略类型
 */
const runStrategy = (stockData, strategyType = 'ML_COMPOSITE') => {
  if (!stockData || stockData.length === 0) {
    return { error: '无数据可供分析' };
  }
  
  const dates = stockData.map(d => d.date);
  const closes = stockData.map(d => Number(d.close));
  const volumes = stockData.map(d => Number(d.volume || 0));
  
  switch (strategyType) {
    case 'ENHANCED_MA':
      return analyzeEnhancedMACross(dates, closes, volumes);
    case 'SMART_RSI':
      return analyzeSmartRSI(dates, closes);
    case 'MACD_MOMENTUM':
      return analyzeMACDMomentum(dates, closes);
    case 'BOLLINGER':
      return analyzeBollingerBands(dates, closes);
    case 'ML_COMPOSITE':
    default:
      return analyzeMLComposite(dates, closes, volumes);
  }
};

module.exports = {
  runStrategy
};