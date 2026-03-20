"""
数据获取工具模块
整合 DataSourceManager 和 src.tools.api 获取真实数据
"""
import pandas as pd
import akshare as ak
from datetime import datetime, timedelta, date
from typing import List, Dict, Any, Optional
import asyncio
import logging
import sys
import os

logger = logging.getLogger('tools')

# 添加项目路径以支持 src 导入
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# 尝试导入 src.tools.api 中的完整实现
try:
    from src.tools.api import (
        get_financial_metrics as _get_financial_metrics,
        get_financial_statements as _get_financial_statements,
        get_price_history as _get_price_history,
        get_market_data as _get_market_data,
        prices_to_df
    )
    HAS_SRC_TOOLS = True
    logger.info("✅ 已加载 src.tools.api 中的完整数据获取实现")
except ImportError as e:
    HAS_SRC_TOOLS = False
    logger.warning(f"⚠️ 无法导入 src.tools.api: {e}，使用基础实现")

# 导入数据源管理器
try:
    from data_sources.manager import data_source_manager
    HAS_DATA_SOURCE = True
except ImportError:
    HAS_DATA_SOURCE = False
    logger.warning("无法导入数据源管理器")


def _run_async(coro):
    """在同步环境中运行异步函数"""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        else:
            return loop.run_until_complete(coro)
    except RuntimeError:
        return asyncio.run(coro)


def get_price_history(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """
    获取价格历史数据
    """
    if HAS_SRC_TOOLS:
        try:
            df = _get_price_history(ticker, start_date, end_date)
            if df is not None and not df.empty:
                logger.info(f"成功通过 src.tools.api 获取 {ticker} 价格数据，共 {len(df)} 条记录")
                return df
        except Exception as e:
            logger.warning(f"src.tools.api 获取价格数据失败: {e}")
    
    try:
        pure_code = ticker.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
        df = ak.stock_zh_a_hist(
            symbol=pure_code,
            period="daily",
            start_date=start_date.replace("-", ""),
            end_date=end_date.replace("-", ""),
            adjust="qfq"
        )
        
        if df is not None and not df.empty:
            df = df.rename(columns={
                "日期": "date", "开盘": "open", "最高": "high", "最低": "low",
                "收盘": "close", "成交量": "volume", "成交额": "amount",
                "振幅": "amplitude", "涨跌幅": "pct_change", "涨跌额": "change_amount", "换手率": "turnover"
            })
            df["date"] = pd.to_datetime(df["date"])
            logger.info(f"成功获取 {ticker} 价格数据，共 {len(df)} 条记录")
            return df
        return pd.DataFrame()
    except Exception as e:
        logger.error(f"获取 {ticker} 价格数据失败: {e}")
        return pd.DataFrame()


def get_financial_metrics(ticker: str) -> List[Dict[str, Any]]:
    """获取财务指标数据"""
    if HAS_SRC_TOOLS:
        try:
            metrics = _get_financial_metrics(ticker)
            if metrics:
                return metrics
        except Exception as e:
            logger.warning(f"src.tools.api 获取财务指标失败: {e}")
    
    try:
        pure_code = ticker.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
        df = ak.stock_zh_a_spot_em()
        if df is not None and not df.empty:
            match = df[df['代码'] == pure_code]
            if len(match) > 0:
                row = match.iloc[0]
                try:
                    financial_df = ak.stock_financial_analysis_indicator(symbol=pure_code)
                    if financial_df is not None and not financial_df.empty:
                        latest = financial_df.iloc[0]
                        return [{
                            "ticker": ticker,
                            "pe_ratio": _safe_float(row.get('市盈率-动态')),
                            "price_to_book": _safe_float(row.get('市净率')),
                            "market_cap": _safe_float(row.get('总市值')),
                            "return_on_equity": _safe_float(latest.get('净资产收益率(%)')),
                            "net_margin": _safe_float(latest.get('销售净利率(%)')),
                        }]
                except:
                    pass
                return [{"ticker": ticker, "pe_ratio": _safe_float(row.get('市盈率-动态')), "price_to_book": _safe_float(row.get('市净率')), "market_cap": _safe_float(row.get('总市值'))}]
    except Exception as e:
        logger.error(f"获取 {ticker} 财务指标失败: {e}")
    return [{}]


def get_financial_statements(ticker: str) -> List[Dict[str, Any]]:
    """获取财务报表数据"""
    if HAS_SRC_TOOLS:
        try:
            statements = _get_financial_statements(ticker)
            if statements:
                return statements
        except Exception as e:
            logger.warning(f"src.tools.api 获取财务报表失败: {e}")
    
    try:
        pure_code = ticker.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
        balance_df = ak.stock_balance_sheet_by_report_em(symbol=pure_code)
        if balance_df is not None and not balance_df.empty:
            latest = balance_df.iloc[0]
            return [{
                "ticker": ticker,
                "report_date": str(latest.get('报告期', '')),
                "total_assets": _safe_float(latest.get('资产总计')),
                "total_liabilities": _safe_float(latest.get('负债合计')),
                "total_equity": _safe_float(latest.get('所有者权益合计')),
            }]
    except Exception as e:
        logger.warning(f"获取财务报表失败: {e}")
    return [{}]


def get_market_data(ticker: str) -> Dict[str, Any]:
    """获取市场数据"""
    if HAS_SRC_TOOLS:
        try:
            data = _get_market_data(ticker)
            if data:
                return data
        except Exception as e:
            logger.warning(f"src.tools.api 获取市场数据失败: {e}")
    
    try:
        pure_code = ticker.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
        df = ak.stock_zh_a_spot_em()
        if df is not None and not df.empty:
            match = df[df['代码'] == pure_code]
            if len(match) > 0:
                row = match.iloc[0]
                return {
                    "ticker": ticker,
                    "name": str(row['名称']),
                    "price": _safe_float(row['最新价']),
                    "change_percent": _safe_float(row['涨跌幅']),
                    "volume": _safe_float(row['成交量']),
                    "pe_ttm": _safe_float(row.get('市盈率-动态')),
                    "pb": _safe_float(row.get('市净率')),
                    "market_cap": _safe_float(row.get('总市值')),
                }
    except Exception as e:
        logger.error(f"获取 {ticker} 市场数据失败: {e}")
    return {}


def get_news_data(ticker: str, num: int = 10) -> List[Dict[str, Any]]:
    """获取新闻数据"""
    try:
        pure_code = ticker.lstrip("SH").lstrip("SZ").lstrip("BJ").zfill(6)
        df = ak.stock_news_em(symbol=pure_code)
        if df is not None and not df.empty:
            result = []
            for _, row in df.head(num).iterrows():
                result.append({
                    "title": str(row.get('新闻标题', '')),
                    "content": str(row.get('新闻内容', '')),
                    "source": "东方财富",
                    "url": str(row.get('新闻链接', '')),
                })
            return result
    except Exception as e:
        logger.warning(f"获取新闻失败: {e}")
    return []


def _safe_float(value: Any) -> Optional[float]:
    if value is None or value == '' or value == '-':
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None