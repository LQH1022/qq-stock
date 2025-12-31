/**
 * stock-trading-simulator-051425/backend/database.js
 * 数据库操作模块：SQLite3 + 内存兜底
 * 管理用户、资产、交易记录
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const winston = require('winston');

// 配置日志
const logger = winston.createLogger({
  transports: [new winston.transports.Console({ format: winston.format.simple() })]
});

const DB_PATH = path.resolve(__dirname, 'stock_trading_simulator.db');
let db = null;
let useMemory = false;

// 内存兜底数据结构
const memoryStore = {
  users: [],
  portfolios: {}, // key: userId-symbol
  transactions: []
};

// 数据库初始化
const initDatabase = () => {
  return new Promise((resolve) => {
    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        logger.error(`SQLite connection failed: ${err.message}. Switching to In-Memory mode.`);
        useMemory = true;
        initMemoryData();
        resolve();
      } else {
        logger.info('Connected to SQLite database.');
        createTables().then(resolve).catch(e => {
          logger.error(`Table creation failed: ${e.message}. Switching to In-Memory mode.`);
          useMemory = true;
          initMemoryData();
          resolve();
        });
      }
    });
  });
};

const initMemoryData = () => {
  // 初始化默认内存用户
  const passHash = bcrypt.hashSync('password123', 10);
  memoryStore.users.push({
    id: 1, username: 'demo', password: passHash, balance: 100000.00, created_at: new Date().toISOString()
  });
};

const createTables = () => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 用户表
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        balance REAL DEFAULT 100000.00,
        created_at TEXT
      )`);

      // 持仓表
      db.run(`CREATE TABLE IF NOT EXISTS portfolios (
        user_id INTEGER,
        symbol TEXT,
        quantity INTEGER,
        average_price REAL,
        updated_at TEXT,
        PRIMARY KEY (user_id, symbol)
      )`);

      // 交易记录表
      db.run(`CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        symbol TEXT,
        type TEXT,
        price REAL,
        quantity INTEGER,
        total_amount REAL,
        timestamp TEXT
      )`, (err) => {
        if (err) return reject(err);
        // 检查是否需要插入默认用户
        db.get("SELECT count(*) as count FROM users", (err, row) => {
          if (!err && row.count === 0) {
            const passHash = bcrypt.hashSync('password123', 10);
            const stmt = db.prepare("INSERT INTO users (username, password, balance, created_at) VALUES (?, ?, ?, ?)");
            stmt.run('demo', passHash, 100000.00, new Date().toISOString());
            stmt.finalize();
            logger.info('Default user "demo" created.');
          }
          resolve();
        });
      });
    });
  });
};

// Promise 包装器
const dbRun = (sql, params = []) => {
  if (useMemory) return Promise.reject(new Error("Memory mode does not support raw SQL"));
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

const dbGet = (sql, params = []) => {
  if (useMemory) return Promise.reject(new Error("Memory mode does not support raw SQL"));
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const dbAll = (sql, params = []) => {
  if (useMemory) return Promise.reject(new Error("Memory mode does not support raw SQL"));
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// === 业务方法 ===

const getUserByUsername = async (username) => {
  if (useMemory) {
    return memoryStore.users.find(u => u.username === username);
  }
  try {
    return await dbGet("SELECT * FROM users WHERE username = ?", [username]);
  } catch (e) {
    logger.error(`getUserByUsername error: ${e.message}`);
    return null;
  }
};

const getUserById = async (id) => {
  if (useMemory) return memoryStore.users.find(u => u.id === id);
  try {
    return await dbGet("SELECT id, username, balance FROM users WHERE id = ?", [id]);
  } catch (e) {
    return null;
  }
};

const createUser = async (username, password) => {
  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();
  if (useMemory) {
    const newUser = { id: memoryStore.users.length + 1, username, password: hash, balance: 100000.00, created_at: now };
    memoryStore.users.push(newUser);
    return newUser;
  }
  try {
    const result = await dbRun(
      "INSERT INTO users (username, password, balance, created_at) VALUES (?, ?, ?, ?)",
      [username, hash, 100000.00, now]
    );
    return { id: result.lastID, username, balance: 100000.00 };
  } catch (e) {
    logger.error(`createUser error: ${e.message}`);
    throw new Error('User creation failed');
  }
};

const getPortfolio = async (userId) => {
  if (useMemory) {
    // memoryStore.portfolios key format: "userId-symbol"
    return Object.values(memoryStore.portfolios).filter(p => p.user_id === userId);
  }
  try {
    return await dbAll("SELECT * FROM portfolios WHERE user_id = ?", [userId]);
  } catch (e) {
    logger.error(`getPortfolio error: ${e.message}`);
    return [];
  }
};

const getTransactions = async (userId) => {
  if (useMemory) {
    return memoryStore.transactions.filter(t => t.user_id === userId).reverse();
  }
  try {
    return await dbAll("SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC", [userId]);
  } catch (e) {
    logger.error(`getTransactions error: ${e.message}`);
    return [];
  }
};

/**
 * 执行交易
 * @param {Number} userId 
 * @param {String} symbol 
 * @param {String} type 'BUY' | 'SELL'
 * @param {Number} price 
 * @param {Number} quantity 
 */
const executeTrade = async (userId, symbol, type, price, quantity) => {
  const total = price * quantity;
  const now = new Date().toISOString();

  // 内存模式逻辑
  if (useMemory) {
    const user = memoryStore.users.find(u => u.id === userId);
    if (!user) throw new Error("User not found");

    if (type === 'BUY') {
      if (user.balance < total) throw new Error("Insufficient funds");
      user.balance -= total;
      
      const key = `${userId}-${symbol}`;
      if (!memoryStore.portfolios[key]) {
        memoryStore.portfolios[key] = { user_id: userId, symbol, quantity: 0, average_price: 0, updated_at: now };
      }
      const p = memoryStore.portfolios[key];
      const oldTotalVal = p.quantity * p.average_price;
      p.quantity += quantity;
      p.average_price = (oldTotalVal + total) / p.quantity;
      p.updated_at = now;
    } else {
      const key = `${userId}-${symbol}`;
      const p = memoryStore.portfolios[key];
      if (!p || p.quantity < quantity) throw new Error("Insufficient holdings");
      
      p.quantity -= quantity;
      user.balance += total;
      if (p.quantity === 0) delete memoryStore.portfolios[key];
      else p.updated_at = now;
    }

    const tx = { id: memoryStore.transactions.length + 1, user_id: userId, symbol, type, price, quantity, total_amount: total, timestamp: now };
    memoryStore.transactions.push(tx);
    return { success: true, balance: user.balance, transaction: tx };
  }

  // SQLite 事务逻辑
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");

      // 1. 检查用户余额或持仓
      const checkUser = new Promise((res, rej) => {
        db.get("SELECT balance FROM users WHERE id = ?", [userId], (err, row) => {
          if (err || !row) rej(new Error("User not found"));
          else res(row);
        });
      });

      checkUser.then(userRow => {
        if (type === 'BUY') {
          if (userRow.balance < total) throw new Error("Insufficient funds");
          
          // 扣款
          db.run("UPDATE users SET balance = balance - ? WHERE id = ?", [total, userId]);
          
          // 更新持仓
          db.get("SELECT * FROM portfolios WHERE user_id = ? AND symbol = ?", [userId, symbol], (err, pf) => {
            if (err) throw err;
            if (pf) {
              const newQty = pf.quantity + quantity;
              const newAvg = ((pf.quantity * pf.average_price) + total) / newQty;
              db.run("UPDATE portfolios SET quantity = ?, average_price = ?, updated_at = ? WHERE user_id = ? AND symbol = ?", 
                [newQty, newAvg, now, userId, symbol]);
            } else {
              db.run("INSERT INTO portfolios (user_id, symbol, quantity, average_price, updated_at) VALUES (?, ?, ?, ?, ?)", 
                [userId, symbol, quantity, price, now]);
            }
          });

        } else { // SELL
          // 检查持仓
          db.get("SELECT * FROM portfolios WHERE user_id = ? AND symbol = ?", [userId, symbol], (err, pf) => {
            if (err) {
              db.run("ROLLBACK");
              return reject(err);
            }
            if (!pf || pf.quantity < quantity) {
              db.run("ROLLBACK");
              return reject(new Error("Insufficient holdings"));
            }
            
            // 加款
            db.run("UPDATE users SET balance = balance + ? WHERE id = ?", [total, userId]);
            
            // 扣持仓
            const newQty = pf.quantity - quantity;
            if (newQty === 0) {
              db.run("DELETE FROM portfolios WHERE user_id = ? AND symbol = ?", [userId, symbol]);
            } else {
              db.run("UPDATE portfolios SET quantity = ?, updated_at = ? WHERE user_id = ? AND symbol = ?", 
                [newQty, now, userId, symbol]);
            }
          });
        }

        // 记录交易
        db.run("INSERT INTO transactions (user_id, symbol, type, price, quantity, total_amount, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)", 
          [userId, symbol, type, price, quantity, total, now], 
          function(err) {
            if (err) {
              db.run("ROLLBACK");
              reject(err);
            } else {
              db.run("COMMIT");
              // 获取最新余额返回
              db.get("SELECT balance FROM users WHERE id = ?", [userId], (e, r) => {
                resolve({ success: true, balance: r ? r.balance : 0 });
              });
            }
          });

      }).catch(err => {
        db.run("ROLLBACK");
        reject(err);
      });
    });
  });
};

module.exports = {
  initDatabase,
  getUserByUsername,
  getUserById,
  createUser,
  getPortfolio,
  getTransactions,
  executeTrade
};