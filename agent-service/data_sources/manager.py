"""
数据源管理器
协调多个数据源，实现自动切换和重试
"""
from typing import Optional, List, Dict, Any, Type
from datetime import date, datetime
from loguru import logger

from .base import (
    BaseDataSource, StockData, MarketData, FinancialData, 
    NewsData, ValuationData
)
from .akshare_source import AkshareDataSource
from .sina_source import SinaDataSource
from .eastmoney_source import EastmoneyDataSource
from .serpapi_source import SerpAPIDataSource


class DataSourceManager:
    """数据源管理器"""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance
    
    def __init__(self):
        if self._initialized:
            return
        
        self._initialized = True
        self._sources: Dict[str, BaseDataSource] = {}
        self._source_priority: List[str] = []
        
        # 注册默认数据源
        self._register_default_sources()
    
    def _register_default_sources(self):
        """注册默认数据源"""
        # 注册Akshare（最高优先级，主要数据源）
        self.register_source(AkshareDataSource())
        
        # 注册东方财富（新闻数据源）
        self.register_source(EastmoneyDataSource())
        
        # 注册新浪财经（新闻数据源）
        self.register_source(SinaDataSource())
        
        # 注册SerpAPI（搜索数据源，需要API密钥）
        try:
            serpapi_source = SerpAPIDataSource()
            self.register_source(serpapi_source)
        except Exception as e:
            logger.warning(f"注册SerpAPI数据源失败: {e}")
    
    def register_source(self, source: BaseDataSource):
        """注册数据源"""
        self._sources[source.name] = source
        # 按优先级排序
        self._source_priority = sorted(
            self._sources.keys(), 
            key=lambda x: self._sources[x].priority
        )
        logger.info(f"注册数据源: {source.name}, 优先级: {source.priority}")
    
    async def get_stock_info(self, code: str) -> Optional[StockData]:
        """获取股票信息 - 按优先级尝试各数据源"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            try:
                result = await source.get_stock_info(code)
                if result:
                    logger.debug(f"从 {source_name} 获取股票信息: {code}")
                    return result
            except Exception as e:
                logger.warning(f"数据源 {source_name} 获取股票信息失败: {e}")
                continue
        
        logger.error(f"所有数据源都无法获取股票信息: {code}")
        return None
    
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            try:
                result = await source.get_market_data(code, start_date, end_date)
                if result:
                    logger.debug(f"从 {source_name} 获取行情数据: {code}, {len(result)}条")
                    return result
            except Exception as e:
                logger.warning(f"数据源 {source_name} 获取行情数据失败: {e}")
                continue
        
        logger.error(f"所有数据源都无法获取行情数据: {code}")
        return []
    
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            try:
                result = await source.get_financial_data(code)
                if result:
                    logger.debug(f"从 {source_name} 获取财务数据: {code}, {len(result)}条")
                    return result
            except Exception as e:
                logger.warning(f"数据源 {source_name} 获取财务数据失败: {e}")
                continue
        
        logger.error(f"所有数据源都无法获取财务数据: {code}")
        return []
    
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20,
        sources: Optional[List[str]] = None
    ) -> List[NewsData]:
        """获取新闻"""
        all_news: List[NewsData] = []
        seen_titles = set()
        
        # 确定要使用的数据源
        source_names = sources if sources else self._source_priority
        
        for source_name in source_names:
            if source_name not in self._sources:
                continue
            
            source = self._sources[source_name]
            try:
                news = await source.get_news(keyword, limit)
                for item in news:
                    if item.title not in seen_titles:
                        seen_titles.add(item.title)
                        all_news.append(item)
            except Exception as e:
                logger.warning(f"数据源 {source_name} 获取新闻失败: {e}")
                continue
        
        # 按时间排序
        all_news.sort(key=lambda x: x.publish_time or datetime.min, reverse=True)
        
        return all_news[:limit]
    
    async def get_valuation(self, code: str) -> Optional[ValuationData]:
        """获取估值数据"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            try:
                result = await source.get_valuation(code)
                if result:
                    logger.debug(f"从 {source_name} 获取估值数据: {code}")
                    return result
            except Exception as e:
                logger.warning(f"数据源 {source_name} 获取估值数据失败: {e}")
                continue
        
        return None
    
    async def get_realtime_quote(self, code: str) -> Optional[Dict[str, Any]]:
        """获取实时行情"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            if hasattr(source, 'get_realtime_quote'):
                try:
                    result = await source.get_realtime_quote(code)
                    if result:
                        return result
                except Exception as e:
                    logger.warning(f"数据源 {source_name} 获取实时行情失败: {e}")
                    continue
        
        return None
    
    async def get_industry_stocks(self, industry: str) -> List[StockData]:
        """获取行业成分股"""
        for source_name in self._source_priority:
            source = self._sources[source_name]
            if hasattr(source, 'get_industry_stocks'):
                try:
                    result = await source.get_industry_stocks(industry)
                    if result:
                        logger.debug(f"从 {source_name} 获取行业成分股: {industry}, {len(result)}只")
                        return result
                except Exception as e:
                    logger.warning(f"数据源 {source_name} 获取行业成分股失败: {e}")
                    continue
        
        return []
    
    async def health_check(self) -> Dict[str, bool]:
        """检查所有数据源健康状态"""
        results = {}
        for name, source in self._sources.items():
            results[name] = await source.health_check()
        return results


# 全局单例
data_source_manager = DataSourceManager()
