/**
 * stock-trading-simulator-051425/backend/server.js
 * Node.js后端主服务文件
 * 提供股票数据、交易处理、策略分析API及Socket.IO实时行情推送
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const winston = require('winston');
const { Server } = require('socket.io');

// 引入业务模块
const db = require('./database');
const stockGen = require('./stockDataGenerator');
const strategyEngine = require('./strategyEngine');

// 配置日志
const logger = winston.createLogger({
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // 允许跨域，生产环境应限制
    methods: ["GET", "POST"]
  }
});

// 全局异常捕获
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// 中间件配置
app.use(helmet({
  contentSecurityPolicy: false,
  frameguard: false
}));
app.use(cors());
app.use(express.json());

// 静态资源配置
const publicDir = path.resolve(__dirname, '../frontend/public');
const distDir = path.resolve(__dirname, '../frontend/dist');
const publicPath = fs.existsSync(publicDir) ? publicDir : distDir;

// 必须先注册静态资源
app.use(express.static(publicPath));

// 初始化数据库
db.initDatabase().catch(err => {
  logger.error(`Database init failed: ${err.message}`);
});

// === 实时行情模拟逻辑 ===
// 内存中缓存最新价格，用于生成下一个tick
const latestPrices = {};
stockGen.STOCKS.forEach(s => {
  latestPrices[s.symbol] = s.basePrice;
});

// 每2秒向所有客户端广播最新的模拟价格
setInterval(() => {
  const updates = {};
  Object.keys(latestPrices).forEach(symbol => {
    const newPrice = stockGen.generateRealtimeTick(latestPrices[symbol], symbol);
    latestPrices[symbol] = newPrice;
    updates[symbol] = {
      symbol,
      price: newPrice,
      timestamp: new Date().toISOString()
    };
  });
  io.emit('price_update', updates);
}, 2000);

io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  socket.emit('price_update', Object.keys(latestPrices).reduce((acc, symbol) => {
    acc[symbol] = { symbol, price: latestPrices[symbol], timestamp: new Date().toISOString() };
    return acc;
  }, {}));

  socket.on('disconnect', () => {
    // 客户端断开
  });
});

// === 业务 API 路由 ===

/**
 * 获取股票列表
 */
app.get('/api/stocks', (req, res) => {
  try {
    const list = stockGen.getStockList();
    // 附带当前内存中的最新价格
    const listWithPrice = list.map(item => ({
      ...item,
      currentPrice: latestPrices[item.symbol] || item.price
    }));
    res.json({ success: true, data: listWithPrice });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '获取股票列表失败' });
  }
});

/**
 * 获取单只股票历史K线数据
 * Query: symbol, days (default 365)
 */
app.get('/api/stocks/history', (req, res) => {
  try {
    const { symbol, days } = req.query;
    if (!symbol) return res.status(400).json({ success: false, message: '缺少股票代码' });

    const data = stockGen.generateHistory(symbol, parseInt(days) || 365);
    res.json({ success: true, data });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '获取历史数据失败' });
  }
});

/**
 * 获取用户信息 (余额等)
 * Query: userId (默认1 demo用户)
 */
app.get('/api/user', async (req, res) => {
  try {
    const userId = req.query.userId || 1; 
    const user = await db.getUserById(userId);
    if (!user) return res.status(404).json({ success: false, message: '用户不存在' });
    res.json({ success: true, data: user });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '获取用户信息失败' });
  }
});

/**
 * 获取用户持仓
 * Query: userId (默认1)
 */
app.get('/api/portfolio', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const portfolio = await db.getPortfolio(userId);
    
    // 补充当前市值估算
    const enriched = portfolio.map(p => {
      const currentPrice = latestPrices[p.symbol] || p.average_price;
      return {
        ...p,
        currentPrice,
        marketValue: parseFloat((currentPrice * p.quantity).toFixed(2)),
        profit: parseFloat(((currentPrice - p.average_price) * p.quantity).toFixed(2)),
        profitPercent: parseFloat(((currentPrice - p.average_price) / p.average_price * 100).toFixed(2))
      };
    });

    res.json({ success: true, data: enriched });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '获取持仓失败' });
  }
});

/**
 * 获取交易记录
 */
app.get('/api/transactions', async (req, res) => {
  try {
    const userId = req.query.userId || 1;
    const txs = await db.getTransactions(userId);
    res.json({ success: true, data: txs });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '获取交易记录失败' });
  }
});

/**
 * 执行交易 (买入/卖出)
 * Body: { userId, symbol, type, quantity, price }
 */
app.post('/api/trade', async (req, res) => {
  try {
    let { userId, symbol, type, quantity, price } = req.body;
    userId = userId || 1; // 默认用户

    if (!symbol || !type || !quantity || !price) {
      return res.status(400).json({ success: false, message: '缺少交易参数' });
    }

    // 如果前端传的价格和后端内存价格差距过大(防止作弊)，实际应用需校验，模拟器暂略
    // 这里强制使用后端最新价格作为参考，或者信任前端传参
    // 为了模拟真实成交，我们在后端再次获取最新价格，如果偏差在允许范围内则执行
    // 简化：直接执行
    
    const result = await db.executeTrade(userId, symbol, type, parseFloat(price), parseInt(quantity));
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(`Trade failed: ${err.message}`);
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * 策略分析
 * Body: { symbol, strategyType, period }
 */
app.post('/api/strategy/analyze', (req, res) => {
  try {
    const { symbol, strategyType, period } = req.body; // strategyType: 'MA_CROSS' | 'MOMENTUM' | 'BOLLINGER'
    if (!symbol) return res.status(400).json({ success: false, message: '缺少股票代码' });

    // 获取历史数据用于分析 (默认取过去1年数据以确保指标计算准确)
    const history = stockGen.generateHistory(symbol, 365);
    
    // 运行策略引擎
    const result = strategyEngine.runStrategy(history, strategyType || 'MA_CROSS');
    
    // 如果发生错误
    if (result.error) {
      return res.status(400).json({ success: false, message: result.error });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ success: false, message: '策略分析失败' });
  }
});

// 简易用户注册 (MVP辅助)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await db.createUser(username, password);
    res.json({ success: true, data: { id: user.id, username: user.username } });
  } catch (err) {
    res.status(400).json({ success: false, message: '注册失败，用户名可能已存在' });
  }
});

// 前端路由兜底
app.get('*', (req, res) => {
  const filePath = path.join(publicPath, req.path);
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Static resources: ${publicPath}`);
});