"""
东方财富新闻数据源实现
支持个股新闻、行业新闻、财经资讯等
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import json
import re
from loguru import logger

from .base import (
    BaseDataSource, StockData, MarketData, FinancialData, 
    NewsData, ValuationData, retry_on_failure
)


class EastmoneyDataSource(BaseDataSource):
    """东方财富数据源"""
    
    name = "eastmoney"
    priority = 5  # 较高优先级
    
    # API端点
    STOCK_NEWS_URL = "https://np-anotice-stock.eastmoney.com/api/security/ann"
    INDUSTRY_NEWS_URL = "https://np-anotice-stock.eastmoney.com/api/content/ann"
    FINANCE_NEWS_URL = "https://newsapi.eastmoney.com/kuaixun/v1/kuaixun/list"
    SEARCH_NEWS_URL = "https://searchapi.eastmoney.com/bussiness/web/QuotationLabelSearch"
    
    def __init__(self, timeout: float = 10.0):
        self._timeout = timeout
        self._client: Optional[httpx.AsyncClient] = None
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取HTTP客户端"""
        if self._client is None:
            self._client = httpx.AsyncClient(
                timeout=self._timeout,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Referer": "https://www.eastmoney.com/",
                },
                follow_redirects=True,
            )
        return self._client
    
    async def close(self):
        """关闭客户端"""
        if self._client:
            await self._client.aclose()
            self._client = None
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_stock_info(self, code: str) -> Optional[StockData]:
        """获取股票基础信息 - 东方财富不支持，返回None"""
        return None
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据 - 东方财富不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据 - 东方财富不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取新闻"""
        try:
            news_list = []
            
            # 1. 获取财经快讯
            finance_news = await self._get_finance_news(limit // 2)
            news_list.extend(finance_news)
            
            # 2. 如果有关键词，搜索相关新闻
            if keyword:
                search_news = await self._search_news(keyword, limit)
                # 合并去重
                seen_titles = {n.title for n in news_list}
                for news in search_news:
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
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_valuation(self, code: str) -> Optional[ValuationData]:
        """获取估值数据 - 东方财富不支持，返回None"""
        return None
    
    async def _get_finance_news(self, limit: int = 10) -> List[NewsData]:
        """获取财经快讯"""
        try:
            client = await self._get_client()
            
            params = {
                "client": "web",
                "biz": "web_7x24",
                "fast": "true",
                "sort": "time",
                "ps": str(limit),
                "p": "1",
                "q": "",
            }
            
            response = await client.get(
                self.FINANCE_NEWS_URL,
                params=params,
            )
            
            if response.status_code != 200:
                logger.warning(f"获取财经快讯失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            if data.get("code") == 0:
                items = data.get("data", {}).get("list", [])
                for item in items:
                    try:
                        # 解析时间
                        publish_time = None
                        time_str = item.get("showtime", "") or item.get("time", "")
                        if time_str:
                            try:
                                # 尝试多种时间格式
                                for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%m-%d %H:%M"]:
                                    try:
                                        publish_time = datetime.strptime(time_str, fmt)
                                        break
                                    except ValueError:
                                        continue
                            except Exception:
                                pass
                        
                        title = item.get("title", "") or item.get("content", "")[:100]
                        content = item.get("content", "")
                        
                        if not title:
                            continue
                        
                        news = NewsData(
                            title=title,
                            content=content,
                            source="东方财富",
                            url=f"https://finance.eastmoney.com/a/{item.get('code', '')}.html" if item.get('code') else None,
                            publish_time=publish_time,
                        )
                        news_list.append(news)
                    except Exception as e:
                        logger.warning(f"解析新闻失败: {e}")
                        continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"获取财经快讯失败: {e}")
            return []
    
    async def _search_news(self, keyword: str, limit: int = 20) -> List[NewsData]:
        """搜索新闻"""
        try:
            client = await self._get_client()
            
            params = {
                "client": "web",
                "client": "web",
                "keyword": keyword,
                "type": "news",
                "pi": "1",
                "ps": str(limit),
            }
            
            response = await client.get(
                self.SEARCH_NEWS_URL,
                params=params,
            )
            
            if response.status_code != 200:
                logger.warning(f"搜索新闻失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            # 解析搜索结果
            result = data.get("result", {})
            items = result.get("list", []) if isinstance(result, dict) else []
            
            for item in items:
                try:
                    # 解析时间
                    publish_time = None
                    time_str = item.get("date", "") or item.get("time", "")
                    if time_str:
                        try:
                            publish_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                        except ValueError:
                            try:
                                publish_time = datetime.strptime(time_str, "%Y-%m-%d")
                            except ValueError:
                                pass
                    
                    news = NewsData(
                        title=item.get("title", ""),
                        content=item.get("content", "") or item.get("description", ""),
                        source="东方财富",
                        url=item.get("url", "") or item.get("link", ""),
                        publish_time=publish_time,
                    )
                    news_list.append(news)
                except Exception as e:
                    logger.warning(f"解析搜索结果失败: {e}")
                    continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"搜索新闻失败: {e}")
            return []
    
    async def get_stock_news(self, code: str, limit: int = 20) -> List[NewsData]:
        """获取个股新闻"""
        try:
            # 标准化股票代码
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
            
            # 判断市场
            if pure_code.startswith(("6", "9")):
                secid = f"1.{pure_code}"
            else:
                secid = f"0.{pure_code}"
            
            client = await self._get_client()
            
            params = {
                "sr": "-1",
                "page_size": str(limit),
                "page_index": "1",
                "ann_type": "SHA,SZA",
                "client_source": "web",
                "f_node": "0",
                "s_node": "0",
                "secid": secid,
            }
            
            response = await client.get(
                self.STOCK_NEWS_URL,
                params=params,
            )
            
            if response.status_code != 200:
                logger.warning(f"获取个股新闻失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            if data.get("code") == 0:
                items = data.get("data", {}).get("list", [])
                for item in items:
                    try:
                        # 解析时间
                        publish_time = None
                        time_str = item.get("notice_date", "")
                        if time_str:
                            try:
                                publish_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                pass
                        
                        news = NewsData(
                            title=item.get("title", ""),
                            content=item.get("abstract", ""),
                            source="东方财富",
                            url=item.get("adjunct_url", ""),
                            publish_time=publish_time,
                        )
                        news_list.append(news)
                    except Exception as e:
                        logger.warning(f"解析个股新闻失败: {e}")
                        continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"获取个股新闻失败 {code}: {e}")
            return []
    
    async def get_industry_news(self, industry: str, limit: int = 20) -> List[NewsData]:
        """获取行业新闻"""
        try:
            client = await self._get_client()
            
            # 行业新闻API
            url = "https://newsapi.eastmoney.com/kuaixun/v1/industry/list"
            
            params = {
                "industry": industry,
                "ps": str(limit),
                "p": "1",
                "client": "web",
            }
            
            response = await client.get(url, params=params)
            
            if response.status_code != 200:
                logger.warning(f"获取行业新闻失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            if data.get("code") == 0:
                items = data.get("data", {}).get("list", [])
                for item in items:
                    try:
                        publish_time = None
                        time_str = item.get("showtime", "") or item.get("time", "")
                        if time_str:
                            try:
                                publish_time = datetime.strptime(time_str, "%Y-%m-%d %H:%M:%S")
                            except ValueError:
                                pass
                        
                        news = NewsData(
                            title=item.get("title", ""),
                            content=item.get("content", ""),
                            source="东方财富",
                            url=item.get("url", ""),
                            publish_time=publish_time,
                        )
                        news_list.append(news)
                    except Exception as e:
                        logger.warning(f"解析行业新闻失败: {e}")
                        continue
            
            return news_list
            
        except Exception as e:
            logger.error(f"获取行业新闻失败 {industry}: {e}")
            return []
    
    async def health_check(self) -> bool:
        """健康检查"""
        try:
            news = await self.get_news("", limit=1)
            return True
        except Exception:
            return False
