/**
 * stock-trading-simulator-051425/backend/stockDataGenerator.js
 * 股票数据生成器模块
 * 负责生成模拟的股票K线历史数据和实时价格波动
 * 采用简化的随机漫步模型模拟市场行为
 */

// 预置的模拟股票列表
const STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.', basePrice: 175.00, volatility: 0.022 },
  { symbol: 'TSLA', name: 'Tesla, Inc.', basePrice: 240.00, volatility: 0.035 },
  { symbol: 'NVDA', name: 'NVIDIA Corp.', basePrice: 460.00, volatility: 0.028 },
  { symbol: 'MSFT', name: 'Microsoft Corp.', basePrice: 370.00, volatility: 0.015 },
  { symbol: 'AMZN', name: 'Amazon.com', basePrice: 145.00, volatility: 0.018 },
  { symbol: 'GOOGL', name: 'Alphabet Inc.', basePrice: 135.00, volatility: 0.016 },
  { symbol: 'META', name: 'Meta Platforms', basePrice: 320.00, volatility: 0.025 }
];

/**
 * 格式化日期为 YYYY-MM-DD (本地时间)
 */
const formatDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * 生成单日K线数据
 * @param {Number} prevClose 前一日收盘价
 * @param {Number} volatility 波动率
 * @param {Date} date 当前日期对象
 */
const generateCandle = (prevClose, volatility, date) => {
  // 模拟开盘跳空：Open通常接近PrevClose，但有微小随机偏差
  const gap = (Math.random() - 0.5) * volatility * 0.2;
  const open = Number((prevClose * (1 + gap)).toFixed(2));

  // 模拟当日涨跌幅
  const changePercent = (Math.random() - 0.5) * volatility * 2; // 扩大一点日内波动
  let close = Number((open * (1 + changePercent)).toFixed(2));

  // 确保价格不为负
  if (close <= 0.01) close = 0.01;

  // 基于Open和Close计算High和Low
  // High至少是Open和Close中的最大值，再随机上浮
  // Low至少是Open和Close中的最小值，再随机下探
  const bodyMax = Math.max(open, close);
  const bodyMin = Math.min(open, close);
  
  const highChange = Math.random() * volatility * 0.5;
  const lowChange = Math.random() * volatility * 0.5;

  const high = Number((bodyMax * (1 + highChange)).toFixed(2));
  const low = Number((bodyMin * (1 - lowChange)).toFixed(2));

  // 模拟成交量 (随机波动)
  const volumeBase = 1000000;
  const volume = Math.floor(volumeBase * (0.5 + Math.random()) * (1 + Math.abs(changePercent) * 10));

  return {
    date: formatDate(date),
    open,
    high,
    low,
    close,
    volume
  };
};

/**
 * 生成指定股票的历史K线数据
 * @param {String} symbol 股票代码
 * @param {Number} days 生成天数
 */
const generateHistory = (symbol, days = 365) => {
  const stock = STOCKS.find(s => s.symbol === symbol);
  if (!stock) return [];

  const data = [];
  let currentPrice = stock.basePrice;
  
  // 为了让曲线看起来更自然，先随机预热运算50次，避免所有股票都死板地从basePrice开始
  for (let i = 0; i < 50; i++) {
    const change = (Math.random() - 0.5) * stock.volatility;
    currentPrice = currentPrice * (1 + change);
  }

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - days);

  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // 跳过周六周日
    const day = currentDate.getDay();
    if (day !== 0 && day !== 6) {
      const candle = generateCandle(currentPrice, stock.volatility, currentDate);
      data.push(candle);
      currentPrice = candle.close;
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return data;
};

/**
 * 获取所有支持的股票列表
 */
const getStockList = () => {
  return STOCKS.map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.basePrice // 这里仅作为参考，实际价格需请求行情
  }));
};

/**
 * 生成下一个实时价格 tick (用于模拟实时行情)
 * @param {Number} lastPrice 上一次价格
 * @param {String} symbol 股票代码 (用于获取特定波动率)
 */
const generateRealtimeTick = (lastPrice, symbol) => {
  const stock = STOCKS.find(s => s.symbol === symbol);
  const volatility = stock ? stock.volatility : 0.02;
  
  // 实时tick波动幅度要比日线小很多
  const change = (Math.random() - 0.5) * volatility * 0.1; 
  let newPrice = lastPrice * (1 + change);
  
  return Number(newPrice.toFixed(2));
};

module.exports = {
  STOCKS,
  generateHistory,
  getStockList,
  generateRealtimeTick
};