// stock-trading-simulator-051425/frontend/src/components/StockSearch.jsx
import React, { useState, useEffect } from 'react';
import { Select, Spin, message } from 'antd';
import { fetchStocks } from '../services/api';

const { Option } = Select;

const StockSearch = ({ onSelect, className = '' }) => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState(undefined);

  useEffect(() => {
    const loadStocks = async () => {
      setLoading(true);
      try {
        const res = await fetchStocks();
        if (res.success) {
          setStocks(res.data);
          // 默认选中第一个
          if (res.data.length > 0 && !value) {
            // 这里的逻辑由父组件控制初始值更好，或者是初始化时不自动选？
            // 为了模拟器体验，通常不需要自动选中，除非父组件传入了defaultValue
            // 这里保持受控组件的灵活性，暂不强制设置初始值，仅加载数据
          }
        }
      } catch (error) {
        message.error('加载股票列表失败');
      } finally {
        setLoading(false);
      }
    };
    loadStocks();
  }, []);

  const handleChange = (val) => {
    setValue(val);
    const selectedStock = stocks.find(s => s.symbol === val);
    if (onSelect && selectedStock) {
      onSelect(selectedStock);
    }
  };

  return (
    <div className={`stock-search-wrapper ${className}`} style={{ minWidth: 200 }}>
      <Select
        showSearch
        value={value}
        placeholder="搜索股票代码或名称 (如 AAPL)"
        optionFilterProp="children"
        onChange={handleChange}
        loading={loading}
        notFoundContent={loading ? <Spin size="small" /> : null}
        filterOption={(input, option) => {
          const stock = stocks.find(s => s.symbol === option.value);
          if (!stock) return false;
          const searchStr = `${stock.symbol} ${stock.name}`.toLowerCase();
          return searchStr.includes(input.toLowerCase());
        }}
        style={{ width: '100%' }}
        dropdownStyle={{ backgroundColor: '#2C2420', border: '1px solid #443B36' }}
      >
        {stocks.map((stock) => (
          <Option key={stock.symbol} value={stock.symbol} className="stock-option">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 'bold', color: '#D4AF37' }}>{stock.symbol}</span>
              <span style={{ color: '#A89F99', fontSize: '12px', marginLeft: '8px' }}>
                {stock.name}
              </span>
            </div>
          </Option>
        ))}
      </Select>
    </div>
  );
};

export default StockSearch;