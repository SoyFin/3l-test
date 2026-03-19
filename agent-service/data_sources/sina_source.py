"""
新浪财经新闻数据源实现
支持关键词搜索新闻、获取财经快讯等
"""
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, date
import json
import re
from loguru import logger

from .base import (
    BaseDataSource, StockData, MarketData, FinancialData, 
    NewsData, ValuationData, retry_on_failure
)


class SinaDataSource(BaseDataSource):
    """新浪财经数据源"""
    
    name = "sina"
    priority = 10  # 中等优先级，主要用于新闻
    
    # API端点
    NEWS_SEARCH_URL = "https://search.sina.com.cn/"
    STOCK_NEWS_URL = "https://feed.sina.com.cn/api/roll/get"
    FINANCE_NEWS_URL = "https://finance.sina.com.cn/7x24/"
    
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
        """获取股票基础信息 - 新浪不支持，返回None"""
        return None
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据 - 新浪不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据 - 新浪不支持，返回空列表"""
        return []
    
    @retry_on_failure(max_retries=3, delay=1.0)
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取新闻"""
        try:
            # 尝试多个新闻源
            news_list = []
            
            # 1. 尝试获取财经快讯
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
        """获取估值数据 - 新浪不支持，返回None"""
        return None
    
    async def _get_finance_news(self, limit: int = 10) -> List[NewsData]:
        """获取财经快讯"""
        try:
            client = await self._get_client()
            
            # 新浪财经快讯API
            params = {
                "pageid": "153",
                "lid": "2509",
                "k": "",
                "num": str(limit),
                "page": "1",
                "r": str(datetime.now().timestamp()),
            }
            
            response = await client.get(
                self.STOCK_NEWS_URL,
                params=params,
            )
            
            if response.status_code != 200:
                logger.warning(f"获取财经快讯失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            if data.get("status") == 200:
                items = data.get("result", {}).get("data", [])
                for item in items:
                    try:
                        # 解析时间
                        publish_time = None
                        time_str = item.get("createtime", "")
                        if time_str:
                            try:
                                publish_time = datetime.strptime(
                                    time_str, "%Y-%m-%d %H:%M:%S"
                                )
                            except ValueError:
                                pass
                        
                        news = NewsData(
                            title=item.get("title", ""),
                            content=item.get("intro", ""),
                            source="新浪财经",
                            url=item.get("url", ""),
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
            
            # 新浪搜索API
            params = {
                "q": keyword,
                "c": "news",
                "from": "channel",
                "ie": "utf-8",
            }
            
            # 设置时间范围参数
            params["time"] = "custom"
            params["stime"] = (datetime.now() - __import__('datetime').timedelta(days=7)).strftime("%Y-%m-%d")
            params["etime"] = datetime.now().strftime("%Y-%m-%d")
            
            response = await client.get(
                self.NEWS_SEARCH_URL,
                params=params,
            )
            
            if response.status_code != 200:
                logger.warning(f"搜索新闻失败: {response.status_code}")
                return []
            
            # 解析HTML响应
            html = response.text
            news_list = self._parse_search_results(html, limit)
            
            return news_list
            
        except Exception as e:
            logger.error(f"搜索新闻失败: {e}")
            return []
    
    def _parse_search_results(self, html: str, limit: int) -> List[NewsData]:
        """解析搜索结果HTML"""
        news_list = []
        
        try:
            # 使用正则表达式提取新闻信息
            # 匹配新闻标题和链接
            pattern = r'<h3[^>]*>.*?<a[^>]*href="([^"]+)"[^>]*>([^<]+)</a>'
            matches = re.findall(pattern, html, re.DOTALL)
            
            for url, title in matches[:limit]:
                # 清理标题
                title = re.sub(r'<[^>]+>', '', title).strip()
                title = title.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                title = title.replace('&quot;', '"').replace('&#34;', '"')
                
                if not title or not url:
                    continue
                
                # 尝试提取时间（如果有）
                time_pattern = rf'{re.escape(title)}.*?(\d{{4}}-\d{{2}}-\d{{2}})'
                time_match = re.search(time_pattern, html, re.DOTALL)
                publish_time = None
                if time_match:
                    try:
                        publish_time = datetime.strptime(time_match.group(1), "%Y-%m-%d")
                    except ValueError:
                        pass
                
                news = NewsData(
                    title=title,
                    source="新浪搜索",
                    url=url,
                    publish_time=publish_time,
                )
                news_list.append(news)
            
        except Exception as e:
            logger.error(f"解析搜索结果失败: {e}")
        
        return news_list
    
    async def get_stock_news(self, code: str, limit: int = 20) -> List[NewsData]:
        """获取个股新闻"""
        try:
            # 标准化股票代码
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
            
            client = await self._get_client()
            
            # 个股新闻API
            url = "https://cj.sina.com.cn/api/article/buildlist"
            params = {
                "symbol": pure_code,
                "page": "1",
                "pagesize": str(limit),
                "c": "news",
            }
            
            response = await client.get(url, params=params)
            
            if response.status_code != 200:
                logger.warning(f"获取个股新闻失败: {response.status_code}")
                return []
            
            data = response.json()
            news_list = []
            
            if data.get("status") == 200:
                items = data.get("data", {}).get("list", [])
                for item in items:
                    try:
                        publish_time = None
                        time_str = item.get("createtime", "")
                        if time_str:
                            try:
                                publish_time = datetime.strptime(
                                    time_str, "%Y-%m-%d %H:%M"
                                )
                            except ValueError:
                                pass
                        
                        news = NewsData(
                            title=item.get("title", ""),
                            content=item.get("summary", ""),
                            source="新浪财经",
                            url=item.get("url", ""),
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
    
    async def health_check(self) -> bool:
        """健康检查"""
        try:
            news = await self.get_news("", limit=1)
            return True  # 只要能返回就认为健康
        except Exception:
            return False
