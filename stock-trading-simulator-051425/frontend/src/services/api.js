import axios from 'axios';

// 创建 axios 实例，不预设 baseURL 以避免重复拼接问题，直接使用相对路径
const api = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

// 响应拦截器：简化返回数据结构，统一处理错误信息
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const msg = error.response?.data?.message || error.message || '请求服务失败';
    return Promise.reject(new Error(msg));
  }
);

/** 获取所有股票列表 */
export const fetchStocks = () => api.get('/api/stocks');

/**
 * 获取单只股票历史K线数据
 * @param {string} symbol 股票代码
 * @param {number} days 历史天数
 */
export const fetchStockHistory = (symbol, days = 365) => 
  api.get('/api/stocks/history', { params: { symbol, days } });

/** 获取用户信息（余额等） */
export const fetchUserInfo = (userId) => 
  api.get('/api/user', { params: { userId } });

/** 获取用户持仓信息 */
export const fetchPortfolio = (userId) => 
  api.get('/api/portfolio', { params: { userId } });

/** 获取交易历史记录 */
export const fetchTransactions = (userId) => 
  api.get('/api/transactions', { params: { userId } });

/**
 * 执行交易 (买入/卖出)
 * @param {Object} params { userId, symbol, type: 'BUY'|'SELL', quantity, price }
 */
export const executeTrade = (params) => api.post('/api/trade', params);

/**
 * 运行策略分析
 * @param {Object} params { symbol, strategyType: 'MA_CROSS'|'MOMENTUM'|'BOLLINGER' }
 */
export const runStrategyAnalysis = (params) => api.post('/api/strategy/analyze', params);

/** 用户注册 */
export const registerUser = (username, password) => 
  api.post('/api/auth/register', { username, password });