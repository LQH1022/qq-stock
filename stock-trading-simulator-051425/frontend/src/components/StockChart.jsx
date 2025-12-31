// stock-trading-simulator-051425/frontend/src/components/StockChart.jsx
import React, { useState, useEffect, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { Spin, Empty, Card } from 'antd';
import { fetchStockHistory } from '../services/api';
import * as echarts from 'echarts';

const StockChart = ({ stock }) => {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState([]);

  // 监听股票切换，加载历史数据
  useEffect(() => {
    if (!stock?.symbol) {
      setHistoryData([]);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      try {
        const res = await fetchStockHistory(stock.symbol);
        if (res.success && Array.isArray(res.data)) {
          setHistoryData(res.data);
        }
      } catch (error) {
        console.error('Chart data load failed', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [stock]);

  // 数据预处理：拆分为ECharts需要的格式
  const processedData = useMemo(() => {
    if (!historyData.length) return null;

    const dates = [];
    const values = []; // [open, close, lowest, highest]
    const volumes = [];

    historyData.forEach((item, index) => {
      dates.push(item.date);
      values.push([item.open, item.close, item.low, item.high]);
      volumes.push([index, item.volume, item.open > item.close ? 1 : -1]); // 1为阴线(跌)，-1为阳线(涨)
    });

    return { dates, values, volumes };
  }, [historyData]);

  // 计算移动平均线 (MA)
  const calculateMA = (dayCount, data) => {
    const result = [];
    for (let i = 0; i < data.values.length; i++) {
      if (i < dayCount) {
        result.push('-');
        continue;
      }
      let sum = 0;
      for (let j = 0; j < dayCount; j++) {
        sum += data.values[i - j][1]; // close price
      }
      result.push(+(sum / dayCount).toFixed(2));
    }
    return result;
  };

  // 生成图表配置
  const getOption = () => {
    if (!processedData) return {};

    const { dates, values, volumes } = processedData;
    
    // 颜色常量
    const upColor = '#FF4D4F';   // 涨 (红)
    const downColor = '#52C41A'; // 跌 (绿)
    const bgColor = '#2C2420';   // 面板背景
    const textColor = '#A89F99'; // 文字颜色
    const splitLineColor = '#443B36'; // 分割线

    return {
      backgroundColor: bgColor,
      animation: false,
      legend: {
        bottom: 10,
        left: 'center',
        data: ['K-Line', 'MA5', 'MA10', 'MA20', 'MA30'],
        textStyle: { color: textColor }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
        backgroundColor: 'rgba(44, 36, 32, 0.9)',
        borderColor: '#D4AF37',
        textStyle: { color: '#E6E1DD' },
        padding: 10,
        position: function (pos, params, el, elRect, size) {
          const obj = { top: 10 };
          obj[['left', 'right'][+(pos[0] < size.viewSize[0] / 2)]] = 30;
          return obj;
        }
      },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
        label: { backgroundColor: '#777' }
      },
      grid: [
        { left: '6%', right: '4%', top: '10%', height: '55%' }, // K线图区域
        { left: '6%', right: '4%', top: '70%', height: '15%' }  // 成交量区域
      ],
      xAxis: [
        {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { lineStyle: { color: splitLineColor } },
          axisLabel: { color: textColor },
          splitLine: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        },
        {
          type: 'category',
          gridIndex: 1,
          data: dates,
          scale: true,
          boundaryGap: false,
          axisLine: { onZero: false },
          axisTick: { show: false },
          splitLine: { show: false },
          axisLabel: { show: false },
          min: 'dataMin',
          max: 'dataMax'
        }
      ],
      yAxis: [
        {
          scale: true,
          splitArea: { show: false },
          splitLine: { show: true, lineStyle: { color: splitLineColor, opacity: 0.5 } },
          axisLabel: { color: textColor },
          axisLine: { show: false }
        },
        {
          scale: true,
          gridIndex: 1,
          splitNumber: 2,
          axisLabel: { show: false },
          axisLine: { show: false },
          axisTick: { show: false },
          splitLine: { show: false }
        }
      ],
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          start: 50,
          end: 100
        },
        {
          show: true,
          xAxisIndex: [0, 1],
          type: 'slider',
          bottom: 40,
          start: 50,
          end: 100,
          borderColor: splitLineColor,
          textStyle: { color: textColor },
          handleStyle: { color: '#D4AF37' }
        }
      ],
      visualMap: {
        show: false,
        seriesIndex: 5, // Volume series index
        dimension: 2,
        pieces: [
          { value: 1, color: downColor },
          { value: -1, color: upColor }
        ]
      },
      series: [
        {
          name: 'K-Line',
          type: 'candlestick',
          data: values,
          itemStyle: {
            color: upColor,
            color0: downColor,
            borderColor: upColor,
            borderColor0: downColor
          },
        },
        {
          name: 'MA5',
          type: 'line',
          data: calculateMA(5, processedData),
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.8, width: 1 }
        },
        {
          name: 'MA10',
          type: 'line',
          data: calculateMA(10, processedData),
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.8, width: 1 }
        },
        {
          name: 'MA20',
          type: 'line',
          data: calculateMA(20, processedData),
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.8, width: 1 }
        },
        {
          name: 'MA30',
          type: 'line',
          data: calculateMA(30, processedData),
          smooth: true,
          showSymbol: false,
          lineStyle: { opacity: 0.8, width: 1 }
        },
        {
          name: 'Volume',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: volumes
        }
      ]
    };
  };

  if (!stock) {
    return (
      <Card title="市场走势" className="h-full flex-center">
        <Empty description="请选择股票查看图表" />
      </Card>
    );
  }

  return (
    <Card 
      title={
        <div className="flex-between">
          <span>{stock.name} ({stock.symbol})</span>
          {stock.currentPrice && (
             <span style={{ fontSize: '16px', color: '#D4AF37', fontWeight: 'bold' }}>
               ${stock.currentPrice.toFixed(2)}
             </span>
          )}
        </div>
      }
      className="h-full"
      bodyStyle={{ padding: 0, height: 'calc(100% - 57px)' }}
    >
      {loading ? (
        <div className="h-full flex-center">
          <Spin size="large" tip="加载图表数据..." />
        </div>
      ) : (
        <ReactECharts
          option={getOption()}
          style={{ height: '100%', width: '100%' }}
          notMerge={true}
          lazyUpdate={true}
          theme="dark"
        />
      )}
    </Card>
  );
};

export default StockChart;