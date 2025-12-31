// stock-trading-simulator-051425/frontend/src/App.jsx
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, ConfigProvider, theme, Typography, Space } from 'antd';
import { io } from 'socket.io-client';
import { FaChartLine } from 'react-icons/fa';

import StockSearch from './components/StockSearch';
import StockChart from './components/StockChart';
import TradingPanel from './components/TradingPanel';
import StrategyAnalysis from './components/StrategyAnalysis';
import './styles/index.css';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

const socket = io('/', {
  transports: ['websocket', 'polling'],
  reconnectionAttempts: 5
});

const Dashboard = () => {
  const [selectedStock, setSelectedStock] = useState(null);
  const [marketPrices, setMarketPrices] = useState({});
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onPriceUpdate = (updates) => {
      setMarketPrices((prev) => ({ ...prev, ...updates }));
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('price_update', onPriceUpdate);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('price_update', onPriceUpdate);
    };
  }, []);

  const currentPrice = selectedStock 
    ? (marketPrices[selectedStock.symbol]?.price || selectedStock.price) 
    : 0;
    
  const stockWithPrice = selectedStock ? {
    ...selectedStock,
    currentPrice: currentPrice || selectedStock.price
  } : null;

  return (
    <Layout style={{ height: '100vh' }}>
      <Header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        padding: '0 24px',
        borderBottom: '1px solid #443B36',
        zIndex: 10
      }}>
        <Space align="center" size="middle">
          <FaChartLine style={{ fontSize: '24px', color: '#D4AF37' }} />
          <Title level={4} style={{ margin: 0, color: '#D4AF37', letterSpacing: '1px' }}>
            Q-STOCK
          </Title>
        </Space>
        <Space>
           <span style={{ color: isConnected ? '#52C41A' : '#FF4D4F', fontSize: '12px', fontWeight: 'bold' }}>
             ● {isConnected ? 'Market Live' : 'Disconnected'}
           </span>
        </Space>
      </Header>
      
      <Layout style={{ overflow: 'hidden' }}>
        <Sider width={320} style={{ borderRight: '1px solid #443B36', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px', borderBottom: '1px solid #443B36', flexShrink: 0 }}>
             <StockSearch onSelect={setSelectedStock} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
             <StrategyAnalysis currentSymbol={selectedStock?.symbol} />
          </div>
        </Sider>

        <Content style={{ padding: '16px', minWidth: '400px', display: 'flex', flexDirection: 'column' }}>
          <StockChart stock={stockWithPrice} />
        </Content>

        <Sider width={340} style={{ borderLeft: '1px solid #443B36' }}>
           <div style={{ height: '100%', padding: '16px', overflowY: 'auto' }}>
             <TradingPanel 
                stock={stockWithPrice} 
                currentPrice={currentPrice} 
                onTradeSuccess={() => {}}
             />
           </div>
        </Sider>
      </Layout>
    </Layout>
  );
};

const App = () => {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#D4AF37',
          colorBgBase: '#1A1614',
          colorBgContainer: '#2C2420',
          colorBorder: '#443B36',
          colorText: '#E6E1DD',
          borderRadius: 6,
        },
      }}
    >
      <Router>
        <Routes>
           <Route path="/" element={<Dashboard />} />
        </Routes>
      </Router>
    </ConfigProvider>
  );
};

export default App;