"""
SerpAPI搜索数据源实现
使用SerpAPI进行网络搜索，获取新闻和相关信息
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import os
from loguru import logger

from .base import (
    BaseDataSource, StockData, MarketData, FinancialData, 
    NewsData, ValuationData, retry_on_failure
)


class SerpAPIDataSource(BaseDataSource):
    """SerpAPI数据源"""
    
    name = "serpapi"
    priority = 20  # 较低优先级，作为备用
    
    # SerpAPI端点
    SEARCH_URL = "https://serpapi.com/search"
    NEWS_URL = "https://serpapi.com/search"  # 使用同一端点，通过参数区分
    
    def __init__(self, api_key: Optional[str] = None, timeout: float = 15.0):
        self._api_key = api_key or os.getenv("SERPAPI_KEY") or os.getenv("SERPAPI_API_KEY")
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
        
        if not self._api_key:
            logger.warning("SerpAPI密钥未设置，请设置SERPAPI_KEY环境变量")
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取HTTP客户端"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                follow_redirects=True,
            )
        return self._client
    
    async def close(self):
        """关闭客户端"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    @retry_on_failure(max_retries=3, delay=2.0)
    async def get_stock_info(self, code: str) -> Optional[StockData]:
        """获取股票基础信息 - SerpAPI不支持，返回None"""
        return None
    
    @retry_on_failure(max_retries=3, delay=2.0)
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据 - SerpAPI不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=2.0)
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据 - SerpAPI不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=2.0)
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取新闻"""
        if not self._api_key:
            logger.warning("SerpAPI密钥未设置，跳过新闻搜索")
            return []
        
        try:
            # 合并搜索结果和新闻结果
            news_list = []
            
            # 1. 搜索新闻
            search_news = await self._search_news(keyword, limit)
            news_list.extend(search_news)
            
            # 2. 获取Google News结果
            google_news = await self._get_google_news(keyword, limit)
            
            # 合并去重
            seen_titles = {n.title for n in news_list}
            for news in google_news:
                if news.title not in seen_titles:
                    news_list.append(news)
                    seen_titles.add(news.title)
            
            # 按时间排序
            news_list.sort(
                key=lambda x: x.publish_time or datetime.min, 
                reverse=True
            )
            
            return news_list[:limit]
            
        except Exception as e:
            logger.error(f"获取新闻失败: {e}")
            return []
    
    @retry_on_failure(max_retries=3, delay=2.0)
    async def get_valuation(self, code: str) -> Optional[ValuationData]:
        """获取估值数据 - SerpAPI不支持，返回None"""
        return None
    
    async def _search_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """搜索新闻"""
        try:
            client = await self._get_client()
            
            params = {
                "api_key": self._api_key,
                "engine": "google",
                "q": f"{keyword} 股票 新闻" if keyword else "股票 新闻",
                "tbm": "nws",  # 新闻搜索
                "num": str(min(limit, 100)),
                "hl": "zh-CN",
                "gl": "cn",
            }
            
            response = await client.get(self.SEARCH_URL, params=params)
            
            if response.status_code != 200:
                logger.warning(f"搜索新闻失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            # 解析新闻结果
            news_results = data.get("news_results", [])
            
            for item in news_results:
                try:
                    # 解析时间
                    publish_time = None
                    time_str = item.get("date", "")
                    if time_str:
                        publish_time = self._parse_date(time_str)
                    
                    news = NewsData(
                        title=item.get("title", ""),
                        content=item.get("snippet", ""),
                        source=item.get("source", "Google搜索"),
                        url=item.get("link", ""),
                        publish_time=publish_time,
                    )
                    news_list.append(news)
                except Exception as e:
                    logger.warning(f"解析新闻失败: {e}")
                    continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"搜索新闻失败: {e}")
            return []
    
    async def _get_google_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取Google News结果"""
        try:
            client = await self._get_client()
            
            params = {
                "api_key": self._api_key,
                "engine": "google_news",
                "q": keyword,
                "num": str(min(limit, 100)),
                "hl": "zh-CN",
                "gl": "cn",
            }
            
            response = await client.get(self.NEWS_URL, params=params)
            
            if response.status_code != 200:
                logger.warning(f"获取Google News失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            # 解析新闻结果
            news_results = data.get("news_results", [])
            
            for item in news_results:
                try:
                    # 解析时间
                    publish_time = None
                    time_str = item.get("date", "")
                    if time_str:
                        publish_time = self._parse_date(time_str)
                    
                    news = NewsData(
                        title=item.get("title", ""),
                        content=item.get("snippet", ""),
                        source=item.get("source", "Google News"),
                        url=item.get("link", ""),
                        publish_time=publish_time,
                    )
                    news_list.append(news)
                except Exception as e:
                    logger.warning(f"解析Google News失败: {e}")
                    continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"获取Google News失败: {e}")
            return []
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """解析日期字符串"""
        if not date_str:
            return None
        
        try:
            # 尝试多种日期格式
            formats = [
                "%Y-%m-%d",
                "%Y-%m-%d %H:%M:%S",
                "%Y年%m月%d日",
                "%m月%d日",
                "%d天前",
                "%d小时前",
                "%d分钟前",
            ]
            
            # 处理相对时间
            if "天前" in date_str:
                days = int(date_str.replace("天前", "").strip())
                return datetime.now() - __import__('datetime').timedelta(days=days)
            elif "小时前" in date_str:
                hours = int(date_str.replace("小时前", "").strip())
                return datetime.now() - __import__('datetime').timedelta(hours=hours)
            elif "分钟前" in date_str:
                minutes = int(date_str.replace("分钟前", "").strip())
                return datetime.now() - __import__('datetime').timedelta(minutes=minutes)
            
            for fmt in formats:
                try:
                    return datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            
            # 如果是 "月日" 格式，补充年份
            if "月" in date_str and "日" in date_str:
                try:
                    # 提取月日
                    parts = date_str.replace("月", " ").replace("日", "").split()
                    month = int(parts[0])
                    day = int(parts[1])
                    year = datetime.now().year
                    return datetime(year, month, day)
                except Exception:
                    pass
            
            return None
            
        except Exception:
            return None
    
    async def search(
        self, 
        query: str, 
        num_results: int = 10
    ) -> List[Dict[str, Any]]:
        """通用搜索方法"""
        if not self._api_key:
            logger.warning("SerpAPI密钥未设置，跳过搜索")
            return []
        
        try:
            client = await self._get_client()
            
            params = {
                "api_key": self._api_key,
                "engine": "google",
                "q": query,
                "num": str(num_results),
                "hl": "zh-CN",
                "gl": "cn",
            }
            
            response = await client.get(self.SEARCH_URL, params=params)
            
            if response.status_code != 200:
                logger.warning(f"搜索失败: {response.status_code}")
                return []
            
            data = response.json()
            results = []
            
            # 解析搜索结果
            organic_results = data.get("organic_results", [])
            
            for item in organic_results:
                result = {
                    "title": item.get("title", ""),
                    "link": item.get("link", ""),
                    "snippet": item.get("snippet", ""),
                    "source": item.get("source", ""),
                }
                results.append(result)
            
            return results
            
        except Exception as e:
            logger.error(f"搜索失败: {e}")
            return []
    
    async def health_check(self) -> bool:
        """健康检查"""
        if not self._api_key:
            return False
        
        try:
            # 尝试搜索测试
            results = await self.search("test", num_results=1)
            return True
        except Exception:
            return False
