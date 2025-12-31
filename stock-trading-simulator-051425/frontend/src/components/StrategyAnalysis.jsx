// stock-trading-simulator-051425/frontend/src/components/StrategyAnalysis.jsx
import React, { useState, useEffect } from 'react';
import { Card, Select, Table, Tag, Spin, Empty, Typography, Space, Alert, Progress, Row, Col, Statistic } from 'antd';
import { RobotOutlined, ThunderboltOutlined, LineChartOutlined } from '@ant-design/icons';
import { runStrategyAnalysis } from '../services/api';

const { Option } = Select;
const { Title, Text } = Typography;

const STRATEGIES = [
  { key: 'ML_COMPOSITE', label: 'AI机器学习综合策略', icon: <RobotOutlined /> },
  { key: 'ENHANCED_MA', label: 'AI增强型均线交叉', icon: <LineChartOutlined /> },
  { key: 'SMART_RSI', label: 'AI智能RSI超买超卖', icon: <ThunderboltOutlined /> },
  { key: 'MACD_MOMENTUM', label: 'AI MACD动量策略', icon: <LineChartOutlined /> },
  { key: 'BOLLINGER', label: 'AI布林带策略', icon: <LineChartOutlined /> },
];

const StrategyAnalysis = ({ currentSymbol }) => {
  const [strategyType, setStrategyType] = useState('ML_COMPOSITE');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentSymbol) executeAnalysis();
    else setData(null);
  }, [currentSymbol, strategyType]);

  const executeAnalysis = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await runStrategyAnalysis({ symbol: currentSymbol, strategyType });
      if (res.success) setData(res.data);
    } catch (err) {
      setError(err.message || 'AI策略分析失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 100,
      fixed: 'left',
    },
    {
      title: '信号',
      dataIndex: 'type',
      key: 'type',
      width: 70,
      render: (type) => {
        const color = type === 'BUY' ? '#FF4D4F' : '#52C41A';
        const text = type === 'BUY' ? '买入' : '卖出';
        return <Tag color={color} style={{ fontWeight: 'bold', fontSize: '12px' }}>{text}</Tag>;
      },
    },
    {
      title: '触发价',
      dataIndex: 'price',
      key: 'price',
      width: 90,
      render: (val) => <Text className="text-gold">${val.toFixed(2)}</Text>,
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 100,
      render: (val) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Progress 
            percent={val} 
            size="small" 
            strokeColor={val >= 80 ? '#52C41A' : val >= 60 ? '#FAAD14' : '#FF4D4F'}
            showInfo={false}
            style={{ width: '50px' }}
          />
          <Text style={{ fontSize: '12px', color: '#A89F99' }}>{val}%</Text>
        </div>
      ),
    },
    {
      title: 'AI分析',
      dataIndex: 'desc',
      key: 'desc',
      ellipsis: true,
    },
  ];

  const getAIScoreColor = (score) => {
    if (score >= 85) return '#52C41A';
    if (score >= 70) return '#FAAD14';
    if (score >= 50) return '#D4AF37';
    return '#FF4D4F';
  };

  const renderContent = () => {
    if (!currentSymbol) {
      return (
        <Empty 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <span style={{ color: '#A89F99' }}>
              请先在上方选择一只股票<br/>启动AI实时策略分析引擎
            </span>
          }
        />
      );
    }

    if (loading && !data) {
      return (
        <div className="flex-center" style={{ padding: '40px 0' }}>
          <Space direction="vertical" align="center" size="large">
            <Spin size="large" />
            <Text style={{ color: '#A89F99' }}>AI策略引擎正在分析市场数据...</Text>
          </Space>
        </div>
      );
    }

    if (error) {
      return <Alert message="分析失败" description={error} type="error" showIcon />;
    }

    if (!data || !data.signals || data.signals.length === 0) {
      return (
        <Empty 
          description={
            <span style={{ color: '#A89F99' }}>
              AI引擎暂未检测到交易信号<br/>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                当前策略：{data?.name || '未知'}
              </Text>
            </span>
          }
        />
      );
    }

    const latestSignal = data.signals[0];
    const aiScore = data.aiScore || 50;

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {/* AI实时评分面板 */}
        <div style={{ 
          background: 'linear-gradient(135deg, #2C2420 0%, #1A1614 100%)', 
          padding: '16px', 
          borderRadius: '8px',
          border: '1px solid #443B36'
        }}>
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Statistic
                title={<Text style={{ color: '#A89F99', fontSize: '12px' }}>AI综合评分</Text>}
                value={aiScore}
                suffix="/ 100"
                valueStyle={{ 
                  color: getAIScoreColor(aiScore), 
                  fontSize: '24px',
                  fontWeight: 'bold'
                }}
              />
            </Col>
            <Col span={12}>
              <div>
                <Text style={{ color: '#A89F99', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                  当前策略模型
                </Text>
                <Tag 
                  color="processing" 
                  style={{ fontSize: '12px', padding: '4px 12px' }}
                  icon={<RobotOutlined />}
                >
                  {data.name}
                </Tag>
              </div>
            </Col>
          </Row>
          
          <div style={{ marginTop: '12px' }}>
            <Progress 
              percent={aiScore} 
              strokeColor={{
                '0%': '#FF4D4F',
                '50%': '#FAAD14',
                '100%': '#52C41A',
              }}
              showInfo={false}
              strokeWidth={8}
            />
          </div>
        </div>

        {/* 最新信号卡片 */}
        {latestSignal && (
          <div style={{
            background: latestSignal.type === 'BUY' 
              ? 'rgba(255, 77, 79, 0.05)' 
              : 'rgba(82, 196, 26, 0.05)',
            border: `1px solid ${latestSignal.type === 'BUY' ? 'rgba(255, 77, 79, 0.3)' : 'rgba(82, 196, 26, 0.3)'}`,
            padding: '12px',
            borderRadius: '6px'
          }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div className="flex-between">
                <Space>
                  <ThunderboltOutlined style={{ color: '#D4AF37', fontSize: '16px' }} />
                  <Text strong style={{ color: '#E6E1DD' }}>最新AI信号</Text>
                </Space>
                <Tag 
                  color={latestSignal.type === 'BUY' ? '#FF4D4F' : '#52C41A'}
                  style={{ fontWeight: 'bold' }}
                >
                  {latestSignal.type === 'BUY' ? '买入建议' : '卖出建议'}
                </Tag>
              </div>
              <Text style={{ color: '#A89F99', fontSize: '12px' }}>
                触发时间: {latestSignal.date} | 价格: ${latestSignal.price.toFixed(2)} | 置信度: {latestSignal.confidence}%
              </Text>
              <Text style={{ color: '#E6E1DD', fontSize: '13px' }}>
                {latestSignal.desc}
              </Text>
            </Space>
          </div>
        )}

        {/* 历史信号表格 */}
        <div style={{ marginTop: '8px' }}>
          <div className="flex-between" style={{ marginBottom: '12px' }}>
            <Text strong style={{ color: '#E6E1DD', fontSize: '14px' }}>
              历史信号记录
            </Text>
            <Text style={{ color: '#A89F99', fontSize: '12px' }}>
              共 {data.signals.length} 条信号
            </Text>
          </div>
          <Table
            dataSource={data.signals}
            columns={columns}
            rowKey={(record) => `${record.date}-${record.type}-${record.price}`}
            size="small"
            pagination={{ 
              pageSize: 5, 
              size: 'small',
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`
            }}
            scroll={{ x: 500 }}
          />
        </div>
      </Space>
    );
  };

  return (
    <Card 
      title={
        <Space>
          <RobotOutlined style={{ color: '#D4AF37', fontSize: '16px' }} />
          <span>AI实时策略分析引擎</span>
        </Space>
      }
      extra={
        <Select
          value={strategyType}
          onChange={setStrategyType}
          style={{ width: 200 }}
          disabled={loading || !currentSymbol}
          dropdownMatchSelectWidth={false}
        >
          {STRATEGIES.map(s => (
            <Option key={s.key} value={s.key}>
              <Space>
                {s.icon}
                {s.label}
              </Space>
            </Option>
          ))}
        </Select>
      }
      className="h-full"
      bodyStyle={{ padding: '16px', overflowY: 'auto', maxHeight: '600px' }}
    >
      {renderContent()}
    </Card>
  );
};

export default StrategyAnalysis;