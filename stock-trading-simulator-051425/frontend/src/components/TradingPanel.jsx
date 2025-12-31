// stock-trading-simulator-051425/frontend/src/components/TradingPanel.jsx
import React, { useState, useEffect } from 'react';
import { Card, Tabs, Button, InputNumber, Row, Col, Statistic, Divider, message, Spin, Empty, Form } from 'antd';
import { fetchUserInfo, fetchPortfolio, executeTrade } from '../services/api';

const TradingPanel = ({ stock, currentPrice, onTradeSuccess }) => {
  const [activeTab, setActiveTab] = useState('BUY');
  const [balance, setBalance] = useState(0);
  const [holdings, setHoldings] = useState(0);
  const [loadingData, setLoadingData] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  
  // 这里的userId硬编码为1，对应后端默认demo用户
  const USER_ID = 1;

  useEffect(() => {
    if (stock?.symbol) {
      refreshUserData();
    }
  }, [stock]);

  const refreshUserData = async () => {
    setLoadingData(true);
    try {
      const [userRes, portRes] = await Promise.all([
        fetchUserInfo(USER_ID),
        fetchPortfolio(USER_ID)
      ]);

      if (userRes.success) {
        setBalance(userRes.data.balance);
      }

      if (portRes.success) {
        const currentStock = portRes.data.find(p => p.symbol === stock.symbol);
        setHoldings(currentStock ? currentStock.quantity : 0);
      }
    } catch (err) {
      message.error('获取账户信息失败');
    } finally {
      setLoadingData(false);
    }
  };

  const handleTrade = async () => {
    if (!stock) return;
    if (tradeQuantity <= 0) {
      message.warning('请输入有效的交易数量');
      return;
    }

    const price = currentPrice || stock.price || 0;
    const totalCost = price * tradeQuantity;

    // 前端预校验
    if (activeTab === 'BUY') {
      if (totalCost > balance) {
        message.error('余额不足');
        return;
      }
    } else {
      if (tradeQuantity > holdings) {
        message.error('持仓不足');
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await executeTrade({
        userId: USER_ID,
        symbol: stock.symbol,
        type: activeTab,
        quantity: tradeQuantity,
        price: price
      });

      if (res.success) {
        message.success(`${activeTab === 'BUY' ? '买入' : '卖出'} ${stock.symbol} 成功`);
        setTradeQuantity(1);
        refreshUserData(); // 刷新余额和持仓
        if (onTradeSuccess) onTradeSuccess();
      }
    } catch (err) {
      message.error(err.message || '交易失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (!stock) {
    return (
      <Card title="交易面板" className="h-full">
        <Empty description="请在左侧选择一只股票进行交易" />
      </Card>
    );
  }

  const price = currentPrice || stock.price || 0;
  const estimatedTotal = price * tradeQuantity;
  
  const items = [
    { key: 'BUY', label: '买入 (Buy)' },
    { key: 'SELL', label: '卖出 (Sell)' },
  ];

  return (
    <Card 
      title={
        <div className="flex-between">
          <span>交易面板</span>
          <span style={{ fontSize: '12px', color: '#A89F99' }}>{stock.symbol}</span>
        </div>
      } 
      className="h-full"
      bodyStyle={{ padding: '16px' }}
    >
      <Spin spinning={loadingData}>
        {/* 账户概览 */}
        <div style={{ background: '#2C2420', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic 
                title={<span style={{ color: '#A89F99', fontSize: '12px' }}>可用余额 (USD)</span>}
                value={balance}
                precision={2}
                valueStyle={{ color: '#D4AF37', fontSize: '18px', fontWeight: 'bold' }}
                prefix="$"
              />
            </Col>
            <Col span={12}>
              <Statistic 
                title={<span style={{ color: '#A89F99', fontSize: '12px' }}>当前持仓 (股)</span>}
                value={holdings}
                precision={0}
                valueStyle={{ color: '#E6E1DD', fontSize: '18px' }}
              />
            </Col>
          </Row>
        </div>

        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab} 
          items={items}
          centered
          tabBarStyle={{ marginBottom: 24, color: '#A89F99' }}
        />

        <Form layout="vertical">
          <Form.Item label={<span style={{ color: '#A89F99' }}>当前价格</span>}>
            <div style={{ 
              background: '#120F0E', 
              padding: '8px 12px', 
              borderRadius: '4px', 
              border: '1px solid #443B36',
              color: '#E6E1DD',
              fontSize: '16px',
              fontWeight: 'bold'
            }}>
              ${price.toFixed(2)}
            </div>
          </Form.Item>

          <Form.Item label={<span style={{ color: '#A89F99' }}>{activeTab === 'BUY' ? '买入数量' : '卖出数量'}</span>}>
            <InputNumber
              min={1}
              max={activeTab === 'SELL' ? holdings : 999999}
              style={{ width: '100%' }}
              value={tradeQuantity}
              onChange={setTradeQuantity}
              precision={0}
              controls
              size="large"
            />
          </Form.Item>

          <div className="flex-between mb-2" style={{ marginTop: '24px' }}>
            <span style={{ color: '#A89F99' }}>预估总额</span>
            <span style={{ color: '#D4AF37', fontWeight: 'bold', fontSize: '16px' }}>
              ${estimatedTotal.toFixed(2)}
            </span>
          </div>

          <Divider style={{ borderColor: '#443B36', margin: '12px 0 24px 0' }} />

          <Button 
            type="primary" 
            block 
            size="large"
            onClick={handleTrade}
            loading={submitting}
            danger={activeTab === 'SELL'} // 卖出按钮使用红色警示
            disabled={activeTab === 'SELL' && holdings <= 0}
          >
            {activeTab === 'BUY' ? '确认买入' : '确认卖出'}
          </Button>
          
          {activeTab === 'BUY' && (
            <div style={{ textAlign: 'center', marginTop: '8px' }}>
              <span style={{ fontSize: '12px', color: '#6B635F' }}>
                最大可买: {Math.floor(balance / price)} 股
              </span>
            </div>
          )}
        </Form>
      </Spin>
    </Card>
  );
};

export default TradingPanel;