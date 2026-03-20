"""
数据源管理模块

统一管理多个金融数据源，支持自动切换和降级
"""

import asyncio
import time
from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging

logger = logging.getLogger("data_sources")

# ============== 数据源基类 ==============

class DataSourceBase(ABC):
    """数据源基类"""
    
    name: str = "base"
    enabled: bool = True
    priority: int = 100  # 数字越小优先级越高
    rate_limit_per_minute: int = 30
    
    def __init__(self):
        self._last_request_time = 0
        self._request_count = 0
        self._error_count = 0
        self._last_error = None
    
    @abstractmethod
    async def get_stock_info(self, symbol: str) -> Optional[Dict]:
        """获取股票基本信息"""
        pass
    
    @abstractmethod
    async def get_realtime_quote(self, symbol: str) -> Optional[Dict]:
        """获取实时行情"""
        pass
    
    @abstractmethod
    async def get_historical_data(self, symbol: str, start_date: str, end_date: str) -> Optional[List[Dict]]:
        """获取历史数据"""
        pass
    
    @abstractmethod
    async def get_financial_data(self, symbol: str) -> Optional[Dict]:
        """获取财务数据"""
        pass
    
    @abstractmethod
    async def get_news(self, symbol: str, limit: int = 20) -> Optional[List[Dict]]:
        """获取相关新闻"""
        pass
    
    def _check_rate_limit(self) -> bool:
        """检查速率限制"""
        current_time = time.time()
        if current_time - self._last_request_time < 60:
            if self._request_count >= self.rate_limit_per_minute:
                return False
        else:
            self._request_count = 0
            self._last_request_time = current_time
        
        self._request_count += 1
        return True
    
    def record_error(self, error: Exception):
        """记录错误"""
        self._error_count += 1
        self._last_error = str(error)
        logger.error(f"[{self.name}] Error: {error}")
    
    def get_status(self) -> Dict:
        """获取数据源状态"""
        return {
            "name": self.name,
            "enabled": self.enabled,
            "priority": self.priority,
            "request_count": self._request_count,
            "error_count": self._error_count,
            "last_error": self._last_error
        }


# ============== AKShare数据源 ==============

class AKShareDataSource(DataSourceBase):
    """AKShare数据源 - 免费A股数据"""
    
    name = "akshare"
    priority = 1
    
    def __init__(self):
        super().__init__()
        try:
            import akshare as ak
            self._ak = ak
            self._available = True
        except ImportError:
            self._available = False
            logger.warning("AKShare未安装")
    
    async def get_stock_info(self, symbol: str) -> Optional[Dict]:
        if not self._available or not self._check_rate_limit():
            return None
        try:
            df = self._ak.stock_individual_info_em(symbol=symbol)
            if df is not None and not df.empty:
                return df.to_dict('records')
        except Exception as e:
            self.record_error(e)
        return None
    
    async def get_realtime_quote(self, symbol: str) -> Optional[Dict]:
        if not self._available or not self._check_rate_limit():
            return None
        try:
            df = self._ak.stock_zh_a_spot_em()
            stock = df[df['代码'] == symbol]
            if not stock.empty:
                row = stock.iloc[0]
                return {
                    "symbol": symbol,
                    "name": row.get('名称', ''),
                    "price": float(row.get('最新价', 0)),
                    "change_percent": float(row.get('涨跌幅', 0)),
                    "change_amount": float(row.get('涨跌额', 0)),
                    "volume": float(row.get('成交量', 0)),
                    "amount": float(row.get('成交额', 0)),
                    "high": float(row.get('最高', 0)),
                    "low": float(row.get('最低', 0)),
                    "open": float(row.get('今开', 0)),
                    "prev_close": float(row.get('昨收', 0)),
                    "market_cap": float(row.get('总市值', 0)),
                    "pe_ratio": float(row.get('市盈率-动态', 0)),
                    "pb_ratio": float(row.get('市净率', 0))
                }
        except Exception as e:
            self.record_error(e)
        return None
    
    async def get_historical_data(self, symbol: str, start_date: str, end_date: str) -> Optional[List[Dict]]:
        if not self._available or not self._check_rate_limit():
            return None
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
            
            df = self._ak.stock_zh_a_hist(
                symbol=symbol,
                period="daily",
                start_date=start_dt.strftime("%Y%m%d"),
                end_date=end_dt.strftime("%Y%m%d"),
                adjust="qfq"
            )
            
            if df is not None and not df.empty:
                df = df.rename(columns={
                    "日期": "date", "开盘": "open", "最高": "high",
                    "最低": "low", "收盘": "close", "成交量": "volume",
                    "成交额": "amount", "涨跌幅": "change_percent",
                    "涨跌额": "change_amount", "换手率": "turnover"
                })
                return df.to_dict('records')
        except Exception as e:
            self.record_error(e)
        return None
    
    async def get_financial_data(self, symbol: str) -> Optional[Dict]:
        if not self._available or not self._check_rate_limit():
            return None
        try:
            # 获取财务指标
            current_year = datetime.now().year
            df = self._ak.stock_financial_analysis_indicator(
                symbol=symbol, 
                start_year=str(current_year - 1)
            )
            
            if df is not None and not df.empty:
                latest = df.iloc[0]
                return {
                    "symbol": symbol,
                    "roe": float(latest.get('净资产收益率(%)', 0) or 0),
                    "net_margin": float(latest.get('销售净利率(%)', 0) or 0),
                    "debt_ratio": float(latest.get('资产负债率(%)', 0) or 0),
                    "current_ratio": float(latest.get('流动比率', 0) or 0),
                    "eps": float(latest.get('加权每股收益(元)', 0) or 0)
                }
        except Exception as e:
            self.record_error(e)
        return None
    
    async def get_news(self, symbol: str, limit: int = 20) -> Optional[List[Dict]]:
        if not self._available or not self._check_rate_limit():
            return None
        try:
            df = self._ak.stock_news_em(symbol=symbol)
            if df is not None and not df.empty:
                news_list = []
                for _, row in df.head(limit).iterrows():
                    news_list.append({
                        "title": row.get('新闻标题', ''),
                        "content": row.get('新闻内容', ''),
                        "publish_time": row.get('发布时间', ''),
                        "source": "东方财富"
                    })
                return news_list
        except Exception as e:
            self.record_error(e)
        return None


# ============== 数据源管理器 ==============

class DataSourceManager:
    """数据源管理器"""
    
    def __init__(self):
        self._sources: Dict[str, DataSourceBase] = {}
        self._initialize_sources()
    
    def _initialize_sources(self):
        """初始化所有数据源"""
        # 注册数据源
        self.register(AKShareDataSource())
    
    def register(self, source: DataSourceBase):
        """注册数据源"""
        self._sources[source.name] = source
        logger.info(f"已注册数据源: {source.name} (优先级: {source.priority})")
    
    def get_source(self, name: str) -> Optional[DataSourceBase]:
        """获取指定数据源"""
        return self._sources.get(name)
    
    def get_available_sources(self) -> List[DataSourceBase]:
        """获取所有可用数据源，按优先级排序"""
        sources = [s for s in self._sources.values() if s.enabled]
        return sorted(sources, key=lambda x: x.priority)
    
    async def get_realtime_quote(self, symbol: str) -> Optional[Dict]:
        """获取实时行情（自动选择最优数据源）"""
        for source in self.get_available_sources():
            result = await source.get_realtime_quote(symbol)
            if result:
                result["data_source"] = source.name
                return result
        return None
    
    async def get_historical_data(self, symbol: str, start_date: str, end_date: str) -> Optional[List[Dict]]:
        """获取历史数据（自动选择最优数据源）"""
        for source in self.get_available_sources():
            result = await source.get_historical_data(symbol, start_date, end_date)
            if result:
                return result
        return None
    
    async def get_financial_data(self, symbol: str) -> Optional[Dict]:
        """获取财务数据（自动选择最优数据源）"""
        for source in self.get_available_sources():
            result = await source.get_financial_data(symbol)
            if result:
                result["data_source"] = source.name
                return result
        return None
    
    async def get_news(self, symbol: str, limit: int = 20) -> Optional[List[Dict]]:
        """获取新闻（自动选择最优数据源）"""
        for source in self.get_available_sources():
            result = await source.get_news(symbol, limit)
            if result:
                return result
        return None
    
    def get_all_status(self) -> Dict:
        """获取所有数据源状态"""
        return {
            name: source.get_status() 
            for name, source in self._sources.items()
        }


# 全局数据源管理器实例
_manager: Optional[DataSourceManager] = None

def get_data_source_manager() -> DataSourceManager:
    """获取数据源管理器实例"""
    global _manager
    if _manager is None:
        _manager = DataSourceManager()
    return _manager
