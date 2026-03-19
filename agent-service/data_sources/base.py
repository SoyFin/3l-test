"""
数据获取层 - 基础类和工具
"""
from abc import ABC, abstractmethod
from typing import Any, Optional, Dict, List
from datetime import datetime, date
from pydantic import BaseModel
import asyncio
from functools import wraps
import time


class StockData(BaseModel):
    """股票基础数据"""
    code: str
    name: str
    industry: Optional[str] = None
    market: Optional[str] = None  # SH, SZ, BJ


class MarketData(BaseModel):
    """行情数据"""
    code: str
    date: date
    open: float
    high: float
    low: float
    close: float
    volume: float
    amount: Optional[float] = None
    turnover_rate: Optional[float] = None


class FinancialData(BaseModel):
    """财务数据"""
    code: str
    report_date: date
    # 资产负债表
    total_assets: Optional[float] = None
    total_liabilities: Optional[float] = None
    total_equity: Optional[float] = None
    current_assets: Optional[float] = None
    current_liabilities: Optional[float] = None
    
    # 利润表
    revenue: Optional[float] = None
    net_profit: Optional[float] = None
    gross_profit: Optional[float] = None
    operating_profit: Optional[float] = None
    
    # 现金流量表
    operating_cash_flow: Optional[float] = None
    investing_cash_flow: Optional[float] = None
    financing_cash_flow: Optional[float] = None
    
    # 关键指标
    roe: Optional[float] = None
    roa: Optional[float] = None
    gross_margin: Optional[float] = None
    net_margin: Optional[float] = None
    debt_ratio: Optional[float] = None
    current_ratio: Optional[float] = None


class NewsData(BaseModel):
    """新闻数据"""
    title: str
    content: Optional[str] = None
    source: str
    url: str
    publish_time: Optional[datetime] = None
    sentiment: Optional[float] = None  # -1 到 1
    keywords: Optional[List[str]] = None


class ValuationData(BaseModel):
    """估值数据"""
    code: str
    date: date
    pe_ttm: Optional[float] = None
    pe_lyr: Optional[float] = None
    pb: Optional[float] = None
    ps: Optional[float] = None
    market_cap: Optional[float] = None
    circulating_market_cap: Optional[float] = None


class BaseDataSource(ABC):
    """数据源基类"""
    
    name: str = "base"
    priority: int = 100  # 数字越小优先级越高
    
    @abstractmethod
    async def get_stock_info(self, code: str) -> Optional[StockData]:
        """获取股票基础信息"""
        pass
    
    @abstractmethod
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据"""
        pass
    
    @abstractmethod
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据"""
        pass
    
    @abstractmethod
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取新闻"""
        pass
    
    @abstractmethod
    async def get_valuation(self, code: str) -> Optional[ValuationData]:
        """获取估值数据"""
        pass
    
    async def health_check(self) -> bool:
        """健康检查"""
        try:
            # 尝试获取一只股票的信息
            result = await self.get_stock_info("000001")
            return result is not None
        except Exception:
            return False


def retry_on_failure(max_retries: int = 3, delay: float = 1.0):
    """重试装饰器"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_error = None
            for i in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    last_error = e
                    if i < max_retries - 1:
                        await asyncio.sleep(delay * (i + 1))
            raise last_error
        return wrapper
    return decorator


def cache_result(ttl: int = 3600):
    """缓存装饰器"""
    _cache: Dict[str, tuple[Any, float]] = {}
    
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # 生成缓存键
            cache_key = f"{func.__name__}:{args}:{kwargs}"
            
            # 检查缓存
            if cache_key in _cache:
                result, timestamp = _cache[cache_key]
                if time.time() - timestamp < ttl:
                    return result
            
            # 执行函数
            result = await func(*args, **kwargs)
            
            # 存储缓存
            _cache[cache_key] = (result, time.time())
            
            return result
        return wrapper
    return decorator
