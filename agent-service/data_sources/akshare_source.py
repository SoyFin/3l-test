"""
Akshare 数据源实现
A股主要数据源，支持实时行情、财务数据、新闻等
"""
import akshare as ak
from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
import asyncio
import pandas as pd
from loguru import logger

from .base import (
    BaseDataSource, StockData, MarketData, FinancialData, 
    NewsData, ValuationData, retry_on_failure, cache_result
)


class AkshareDataSource(BaseDataSource):
    """Akshare数据源"""
    
    name = "akshare"
    priority = 1  # 最高优先级
    
    def __init__(self):
        self._stock_cache: Dict[str, StockData] = {}
    
    @retry_on_failure(max_retries=3, delay=0.5)
    async def get_stock_info(self, code: str) -> Optional[StockData]:
        """获取股票基础信息"""
        try:
            # 标准化代码格式
            std_code = self._normalize_code(code)
            
            # 从缓存获取
            if std_code in self._stock_cache:
                return self._stock_cache[std_code]
            
            # 获取A股股票列表
            def _get_stock_list():
                try:
                    df = ak.stock_zh_a_spot_em()
                    return df
                except Exception:
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_stock_list)
            
            if df is None:
                return None
            
            # 查找股票
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ").lstrip("0")
            match = df[df['代码'] == pure_code]
            
            if len(match) > 0:
                row = match.iloc[0]
                stock_data = StockData(
                    code=code,
                    name=str(row['名称']),
                    market=self._get_market(code),
                )
                self._stock_cache[std_code] = stock_data
                return stock_data
            
            return None
            
        except Exception as e:
            logger.error(f"获取股票信息失败 {code}: {e}")
            return None
    
    @retry_on_failure(max_retries=3, delay=0.5)
    async def get_market_data(
        self, 
        code: str, 
        start_date: date, 
        end_date: date
    ) -> List[MarketData]:
        """获取行情数据"""
        try:
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ")
            market = self._get_market(code)
            symbol = f"{market}{pure_code}"
            
            def _get_kline():
                try:
                    df = ak.stock_zh_a_hist(
                        symbol=pure_code,
                        period="daily",
                        start_date=start_date.strftime("%Y%m%d"),
                        end_date=end_date.strftime("%Y%m%d"),
                        adjust="qfq"  # 前复权
                    )
                    return df
                except Exception as e:
                    logger.error(f"获取K线失败: {e}")
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_kline)
            
            if df is None or df.empty:
                return []
            
            result = []
            for _, row in df.iterrows():
                try:
                    market_data = MarketData(
                        code=code,
                        date=datetime.strptime(str(row['日期']), "%Y-%m-%d").date(),
                        open=float(row['开盘']),
                        high=float(row['最高']),
                        low=float(row['最低']),
                        close=float(row['收盘']),
                        volume=float(row['成交量']),
                        amount=float(row['成交额']),
                        turnover_rate=float(row['换手率']) if '换手率' in row else None,
                    )
                    result.append(market_data)
                except Exception as e:
                    logger.warning(f"解析行情数据失败: {e}")
                    continue
            
            return result
            
        except Exception as e:
            logger.error(f"获取行情数据失败 {code}: {e}")
            return []
    
    @retry_on_failure(max_retries=3, delay=0.5)
    async def get_financial_data(self, code: str) -> List[FinancialData]:
        """获取财务数据"""
        try:
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ")
            
            def _get_financial():
                try:
                    # 获取主要财务指标
                    df = ak.stock_financial_analysis_indicator(symbol=pure_code)
                    return df
                except Exception as e:
                    logger.error(f"获取财务数据失败: {e}")
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_financial)
            
            if df is None or df.empty:
                return []
            
            result = []
            for _, row in df.iterrows():
                try:
                    # 解析日期
                    date_str = str(row.get('日期', ''))
                    try:
                        report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
                    except ValueError:
                        continue
                    
                    financial = FinancialData(
                        code=code,
                        report_date=report_date,
                        roe=self._safe_float(row.get('净资产收益率(%)')),
                        roa=self._safe_float(row.get('总资产净利率(%)')),
                        gross_margin=self._safe_float(row.get('销售毛利率(%)')),
                        net_margin=self._safe_float(row.get('销售净利率(%)')),
                    )
                    result.append(financial)
                except Exception as e:
                    logger.warning(f"解析财务数据失败: {e}")
                    continue
            
            return result
            
        except Exception as e:
            logger.error(f"获取财务数据失败 {code}: {e}")
            return []
    
    async def get_news(
        self, 
        keyword: str, 
        limit: int = 20
    ) -> List[NewsData]:
        """获取新闻 - Akshare不支持，返回空"""
        return []
    
    @retry_on_failure(max_retries=3, delay=0.5)
    async def get_valuation(self, code: str) -> Optional[ValuationData]:
        """获取估值数据"""
        try:
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ")
            
            def _get_realtime():
                try:
                    df = ak.stock_zh_a_spot_em()
                    return df
                except Exception:
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_realtime)
            
            if df is None or df.empty:
                return None
            
            match = df[df['代码'] == pure_code]
            if len(match) == 0:
                return None
            
            row = match.iloc[0]
            
            return ValuationData(
                code=code,
                date=date.today(),
                pe_ttm=self._safe_float(row.get('市盈率-动态')),
                pb=self._safe_float(row.get('市净率')),
                market_cap=self._safe_float(row.get('总市值')),
                circulating_market_cap=self._safe_float(row.get('流通市值')),
            )
            
        except Exception as e:
            logger.error(f"获取估值数据失败 {code}: {e}")
            return None
    
    async def get_industry_stocks(self, industry: str) -> List[StockData]:
        """获取行业成分股"""
        try:
            def _get_industry():
                try:
                    df = ak.stock_board_industry_cons_em(symbol=industry)
                    return df
                except Exception:
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_industry)
            
            if df is None or df.empty:
                return []
            
            result = []
            for _, row in df.iterrows():
                stock = StockData(
                    code=str(row['代码']),
                    name=str(row['名称']),
                    industry=industry,
                )
                result.append(stock)
            
            return result
            
        except Exception as e:
            logger.error(f"获取行业成分股失败 {industry}: {e}")
            return []
    
    async def get_realtime_quote(self, code: str) -> Optional[Dict[str, Any]]:
        """获取实时行情"""
        try:
            pure_code = code.lstrip("SH").lstrip("SZ").lstrip("BJ")
            
            def _get_quote():
                try:
                    df = ak.stock_zh_a_spot_em()
                    return df
                except Exception:
                    return None
            
            df = await asyncio.get_event_loop().run_in_executor(None, _get_quote)
            
            if df is None or df.empty:
                return None
            
            match = df[df['代码'] == pure_code]
            if len(match) == 0:
                return None
            
            row = match.iloc[0]
            
            return {
                'code': code,
                'name': str(row['名称']),
                'price': float(row['最新价']),
                'change_percent': float(row['涨跌幅']),
                'change_amount': float(row['涨跌额']),
                'volume': float(row['成交量']),
                'amount': float(row['成交额']),
                'high': float(row['最高']),
                'low': float(row['最低']),
                'open': float(row['今开']),
                'prev_close': float(row['昨收']),
                'pe_ttm': self._safe_float(row.get('市盈率-动态')),
                'pb': self._safe_float(row.get('市净率')),
                'market_cap': self._safe_float(row.get('总市值')),
            }
            
        except Exception as e:
            logger.error(f"获取实时行情失败 {code}: {e}")
            return None
    
    def _normalize_code(self, code: str) -> str:
        """标准化代码格式"""
        return code.upper().zfill(6)
    
    def _get_market(self, code: str) -> str:
        """获取市场代码"""
        code = code.upper()
        if code.startswith("SH") or code.startswith("6"):
            return "SH"
        elif code.startswith("BJ") or code.startswith(("4", "8")):
            return "BJ"
        else:
            return "SZ"
    
    def _safe_float(self, value: Any) -> Optional[float]:
        """安全转换为浮点数"""
        if value is None or value == '' or value == '-':
            return None
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
