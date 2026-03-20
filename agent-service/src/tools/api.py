"""
数据源配置 - 完整修复版

问题修复：
1. 实时行情频率限制 - 使用历史价格最新数据替代
2. volume列不存在 - 添加列名兼容处理
"""

from typing import Dict, Any, List, Optional
import pandas as pd
import akshare as ak
from datetime import datetime, timedelta
import numpy as np
import time
from src.utils.logging_config import setup_logger

logger = setup_logger('api')

# 全局缓存
_quote_cache = {"data": None, "time": None}
CACHE_TTL = 60  # 缓存60秒


def normalize_stock_code(ticker: str) -> str:
    """标准化股票代码"""
    if not ticker:
        return ""
    ticker = str(ticker).upper()
    for prefix in ['SZ', 'SH', 'BJ', 'SHSE', 'SZSE', 'BSE']:
        if ticker.startswith(prefix):
            ticker = ticker[len(prefix):]
            break
    return ticker.zfill(6)


def get_market_prefix(code: str) -> str:
    """根据股票代码判断市场"""
    if not code:
        return "sh"
    first = code[0]
    if first in ['6', '9']:
        return "sh"
    elif first in ['0', '2', '3']:
        return "sz"
    elif first in ['4', '8']:
        return "bj"
    return "sh"


def safe_float(value, default=0.0) -> float:
    """安全转换为浮点数"""
    try:
        if value is None or pd.isna(value):
            return default
        return float(value)
    except:
        return default


# ============== 历史价格 ==============

def get_price_history(symbol: str, start_date: str = None, end_date: str = None, adjust: str = "qfq") -> pd.DataFrame:
    """获取历史价格数据"""
    normalized_code = normalize_stock_code(symbol)
    
    try:
        current_date = datetime.now()
        yesterday = current_date - timedelta(days=1)
        
        if not end_date:
            end_date = yesterday
        else:
            end_date = datetime.strptime(end_date, "%Y-%m-%d")
            if end_date > yesterday:
                end_date = yesterday
        
        if not start_date:
            start_date = end_date - timedelta(days=365)
        else:
            start_date = datetime.strptime(start_date, "%Y-%m-%d")
        
        logger.info(f"获取历史价格: {symbol} -> {normalized_code}")
        logger.info(f"日期范围: {start_date.strftime('%Y-%m-%d')} ~ {end_date.strftime('%Y-%m-%d')}")
        
        df = None
        
        # 数据源1：东方财富
        for attempt in range(3):
            try:
                logger.info(f"[东方财富] 获取历史价格 (第{attempt+1}次)...")
                df = ak.stock_zh_a_hist(
                    symbol=normalized_code,
                    period="daily",
                    start_date=start_date.strftime("%Y%m%d"),
                    end_date=end_date.strftime("%Y%m%d"),
                    adjust=adjust
                )
                if df is not None and not df.empty:
                    logger.info(f"✓ [东方财富] 成功 {len(df)} 条")
                    break
            except Exception as e:
                logger.warning(f"[东方财富] 失败: {e}")
                if attempt < 2:
                    time.sleep(2 ** attempt)
        
        # 数据源2：腾讯
        if df is None or df.empty:
            try:
                market = get_market_prefix(normalized_code)
                tx_symbol = f"{market}{normalized_code}"
                logger.info(f"[腾讯] 获取历史价格 {tx_symbol}...")
                df = ak.stock_zh_a_hist_tx(
                    symbol=tx_symbol,
                    start_date=start_date.strftime("%Y-%m-%d"),
                    end_date=end_date.strftime("%Y-%m-%d"),
                    adjust=adjust
                )
                if df is not None and not df.empty:
                    logger.info(f"✓ [腾讯] 成功 {len(df)} 条")
            except Exception as e:
                logger.warning(f"[腾讯] 失败: {e}")
        
        if df is None or df.empty:
            logger.warning(f"无法获取 {normalized_code} 历史价格")
            return pd.DataFrame()
        
        # ★ 修复：标准化列名（兼容不同数据源）
        column_mapping = {
            "日期": "date", "开盘": "open", "最高": "high", "最低": "low",
            "收盘": "close", "成交量": "volume", "成交额": "amount",
            "振幅": "amplitude", "涨跌幅": "pct_change", "涨跌额": "change_amount",
            "换手率": "turnover",
            # 腾讯可能的列名
            "date": "date", "open": "open", "high": "high", "low": "low",
            "close": "close", "volume": "volume", "amount": "amount"
        }
        
        # 只重命名存在的列
        rename_dict = {k: v for k, v in column_mapping.items() if k in df.columns and k != v}
        if rename_dict:
            df = df.rename(columns=rename_dict)
        
        if "date" in df.columns:
            df["date"] = pd.to_datetime(df["date"])
        
        # 确保必要列存在
        required_cols = ["date", "open", "high", "low", "close", "volume"]
        for col in required_cols:
            if col not in df.columns:
                logger.warning(f"缺少列: {col}，可用列: {list(df.columns)}")
                if col == "volume":
                    df["volume"] = 0  # 默认值
        
        # 数据量不足时扩大范围
        if len(df) < 120:
            logger.warning(f"数据量不足 ({len(df)})，扩大到2年...")
            new_start = end_date - timedelta(days=730)
            try:
                df2 = ak.stock_zh_a_hist(
                    symbol=normalized_code,
                    period="daily",
                    start_date=new_start.strftime("%Y%m%d"),
                    end_date=end_date.strftime("%Y%m%d"),
                    adjust=adjust
                )
                if df2 is not None and not df2.empty:
                    rename_dict2 = {k: v for k, v in column_mapping.items() if k in df2.columns and k != v}
                    df2 = df2.rename(columns=rename_dict2)
                    if "date" in df2.columns:
                        df2["date"] = pd.to_datetime(df2["date"])
                    df = df2
            except:
                pass
        
        if df is None or df.empty:
            return pd.DataFrame()
        
        # 计算技术指标
        df = calculate_technical_indicators(df)
        
        logger.info(f"✓ 历史价格处理完成 ({len(df)} 条)")
        return df
    
    except Exception as e:
        logger.error(f"获取历史价格失败: {e}")
        import traceback
        traceback.print_exc()
        return pd.DataFrame()


def calculate_technical_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """计算技术指标"""
    try:
        if df.empty or "close" not in df.columns:
            return df
        
        returns = df["close"].pct_change()
        
        df["momentum_1m"] = df["close"].pct_change(periods=20)
        df["momentum_3m"] = df["close"].pct_change(periods=60)
        df["momentum_6m"] = df["close"].pct_change(periods=120)
        
        # ★ 安全处理volume列
        if "volume" in df.columns:
            df["volume_ma20"] = df["volume"].rolling(window=20).mean()
            df["volume_momentum"] = df["volume"] / df["volume_ma20"].replace(0, 1)
        
        df["historical_volatility"] = returns.rolling(window=20).std() * np.sqrt(252)
        
        if all(col in df.columns for col in ["high", "low", "close"]):
            tr = pd.DataFrame()
            tr["h-l"] = df["high"] - df["low"]
            tr["h-pc"] = abs(df["high"] - df["close"].shift(1))
            tr["l-pc"] = abs(df["low"] - df["close"].shift(1))
            tr["tr"] = tr[["h-l", "h-pc", "l-pc"]].max(axis=1)
            df["atr"] = tr["tr"].rolling(window=14).mean()
            df["atr_ratio"] = df["atr"] / df["close"].replace(0, 1)
        
        df["skewness"] = returns.rolling(window=20).skew()
        df["kurtosis"] = returns.rolling(window=20).kurt()
        
        if "date" in df.columns:
            df = df.sort_values("date").reset_index(drop=True)
        
        return df
    except Exception as e:
        logger.error(f"计算技术指标失败: {e}")
        import traceback
        traceback.print_exc()
        return df


# ============== 实时行情（带缓存和降级） ==============

def get_realtime_quotes(symbol: str, max_retries: int = 2) -> Optional[pd.DataFrame]:
    """
    获取实时行情
    
    策略：
    1. 使用缓存避免频繁请求
    2. 新浪接口失败时使用历史价格最新数据
    """
    global _quote_cache
    normalized_code = normalize_stock_code(symbol)
    
    # 检查缓存
    now = time.time()
    if _quote_cache["data"] is not None and _quote_cache["time"] is not None:
        if now - _quote_cache["time"] < CACHE_TTL:
            logger.info("[缓存] 使用缓存的实时行情数据")
            cached_df = _quote_cache["data"]
            code_col = None
            for col in ['代码', 'code', 'symbol', '股票代码']:
                if col in cached_df.columns:
                    code_col = col
                    break
            if code_col:
                cached_df['_code'] = cached_df[code_col].astype(str).str.zfill(6)
                stock_data = cached_df[cached_df['_code'] == normalized_code]
                return stock_data.drop(columns=['_code'], errors='ignore')
    
    # 尝试新浪接口
    for attempt in range(max_retries):
        try:
            logger.info(f"[新浪] 获取实时行情 (第{attempt+1}次)...")
            df = ak.stock_zh_a_spot()
            if df is not None and not df.empty:
                # 更新缓存
                _quote_cache = {"data": df.copy(), "time": now}
                
                code_col = None
                for col in ['代码', 'code', 'symbol', '股票代码']:
                    if col in df.columns:
                        code_col = col
                        break
                
                if code_col:
                    df['_code'] = df[code_col].astype(str).str.zfill(6)
                    stock_data = df[df['_code'] == normalized_code]
                    logger.info(f"✓ [新浪] 实时行情成功")
                    return stock_data.drop(columns=['_code'], errors='ignore')
        except Exception as e:
            logger.warning(f"[新浪] 实时行情失败: {e}")
            if attempt < max_retries - 1:
                time.sleep(1)
    
    logger.warning("实时行情获取失败，将使用历史价格最新数据")
    return None


def get_latest_price_from_history(symbol: str) -> Dict[str, Any]:
    """从历史价格获取最新数据（降级方案）"""
    try:
        normalized_code = normalize_stock_code(symbol)
        end_date = datetime.now()
        start_date = end_date - timedelta(days=10)  # 最近10天
        
        df = None
        try:
            df = ak.stock_zh_a_hist(
                symbol=normalized_code,
                period="daily",
                start_date=start_date.strftime("%Y%m%d"),
                end_date=end_date.strftime("%Y%m%d"),
                adjust="qfq"
            )
        except:
            pass
        
        if df is None or df.empty:
            # 尝试腾讯
            try:
                market = get_market_prefix(normalized_code)
                df = ak.stock_zh_a_hist_tx(
                    symbol=f"{market}{normalized_code}",
                    start_date=start_date.strftime("%Y-%m-%d"),
                    end_date=end_date.strftime("%Y-%m-%d"),
                    adjust="qfq"
                )
            except:
                pass
        
        if df is not None and not df.empty:
            latest = df.iloc[-1]
            logger.info(f"✓ 从历史价格获取最新数据")
            return {
                "close": safe_float(latest.get("收盘", latest.get("close", 0))),
                "open": safe_float(latest.get("开盘", latest.get("open", 0))),
                "high": safe_float(latest.get("最高", latest.get("high", 0))),
                "low": safe_float(latest.get("最低", latest.get("low", 0))),
                "volume": safe_float(latest.get("成交量", latest.get("volume", 0))),
                "amount": safe_float(latest.get("成交额", latest.get("amount", 0))),
            }
    except Exception as e:
        logger.warning(f"从历史价格获取最新数据失败: {e}")
    
    return {}


# ============== 财务报表 ==============

def get_financial_report(stock: str, report_type: str) -> Optional[pd.DataFrame]:
    """获取财务报表"""
    code = normalize_stock_code(stock)
    market = get_market_prefix(code)
    full_code = f"{market}{code}"
    
    # 数据源1：新浪
    for attempt in range(2):
        try:
            df = ak.stock_financial_report_sina(stock=full_code, symbol=report_type)
            if df is not None and not df.empty:
                logger.info(f"✓ [新浪] {report_type}成功")
                return df
        except Exception as e:
            logger.warning(f"[新浪] {report_type}失败: {e}")
            if attempt < 1:
                time.sleep(1)
    
    # 数据源2：东方财富
    try:
        logger.info(f"[东方财富] 获取{report_type}...")
        if report_type == "资产负债表":
            df = ak.stock_balance_sheet_by_report_em(symbol=code)
        elif report_type == "利润表":
            df = ak.stock_profit_sheet_by_report_em(symbol=code)
        elif report_type == "现金流量表":
            df = ak.stock_cash_flow_sheet_by_report_em(symbol=code)
        
        if df is not None and not df.empty:
            logger.info(f"✓ [东方财富] {report_type}成功")
            return df
    except Exception as e:
        logger.warning(f"[东方财富] {report_type}失败: {e}")
    
    return None


# ============== 主要API ==============

def get_financial_metrics(symbol: str) -> List[Dict[str, Any]]:
    """获取财务指标"""
    normalized_code = normalize_stock_code(symbol)
    logger.info(f"获取财务指标: {symbol} -> {normalized_code}")
    
    try:
        # 获取实时行情（尝试新浪，失败则用历史数据）
        stock_df = get_realtime_quotes(normalized_code)
        stock_data = pd.Series()
        
        if stock_df is not None and not stock_df.empty:
            stock_data = stock_df.iloc[0]
        else:
            # 降级：从历史价格获取
            latest_price = get_latest_price_from_history(normalized_code)
            if latest_price:
                stock_data = pd.Series(latest_price)
        
        # 获取财务指标
        financial_data = None
        try:
            current_year = datetime.now().year
            financial_data = ak.stock_financial_analysis_indicator(
                symbol=normalized_code,
                start_year=str(current_year - 2)
            )
            if financial_data is not None and not financial_data.empty:
                financial_data['日期'] = pd.to_datetime(financial_data['日期'])
                financial_data = financial_data.sort_values('日期', ascending=False)
                logger.info(f"✓ 财务指标获取成功 ({len(financial_data)} 条)")
        except Exception as e:
            logger.warning(f"财务指标获取失败: {e}")
        
        latest_financial = financial_data.iloc[0] if financial_data is not None and not financial_data.empty else pd.Series()
        
        # 获取利润表
        income_df = get_financial_report(normalized_code, "利润表")
        latest_income = income_df.iloc[0] if income_df is not None and not income_df.empty else pd.Series()
        
        def convert_pct(value) -> float:
            try:
                if value is None or pd.isna(value):
                    return 0.0
                return float(value) / 100.0
            except:
                return 0.0
        
        market_cap = safe_float(stock_data.get("总市值", 0))
        revenue = safe_float(latest_income.get("营业总收入", 0))
        price_to_sales = market_cap / revenue if revenue > 0 else 0
        
        metrics = {
            "return_on_equity": convert_pct(latest_financial.get("净资产收益率(%)", 0)),
            "net_margin": convert_pct(latest_financial.get("销售净利率(%)", 0)),
            "operating_margin": convert_pct(latest_financial.get("营业利润率(%)", 0)),
            "revenue_growth": convert_pct(latest_financial.get("主营业务收入增长率(%)", 0)),
            "earnings_growth": convert_pct(latest_financial.get("净利润增长率(%)", 0)),
            "book_value_growth": convert_pct(latest_financial.get("净资产增长率(%)", 0)),
            "current_ratio": safe_float(latest_financial.get("流动比率", 0)),
            "debt_to_equity": convert_pct(latest_financial.get("资产负债率(%)", 0)),
            "free_cash_flow_per_share": safe_float(latest_financial.get("每股经营性现金流(元)", 0)),
            "earnings_per_share": safe_float(latest_financial.get("加权每股收益(元)", 0)),
            "pe_ratio": safe_float(stock_data.get("市盈率-动态", stock_data.get("市盈率", 0))),
            "price_to_book": safe_float(stock_data.get("市净率", 0)),
            "price_to_sales": price_to_sales,
        }
        
        logger.info("✓ 财务指标构建完成")
        return [metrics]
    
    except Exception as e:
        logger.error(f"获取财务指标失败: {e}")
        return [{}]


def get_financial_statements(symbol: str) -> List[Dict[str, Any]]:
    """获取财务报表"""
    normalized_code = normalize_stock_code(symbol)
    logger.info(f"获取财务报表: {symbol} -> {normalized_code}")
    
    default_item = {
        "net_income": 0, "operating_revenue": 0, "operating_profit": 0,
        "working_capital": 0, "depreciation_and_amortization": 0,
        "capital_expenditure": 0, "free_cash_flow": 0
    }
    
    try:
        balance_df = get_financial_report(normalized_code, "资产负债表")
        income_df = get_financial_report(normalized_code, "利润表")
        cash_df = get_financial_report(normalized_code, "现金流量表")
        
        def build_item(balance, income, cash) -> dict:
            return {
                "net_income": safe_float(income.get("净利润", 0)),
                "operating_revenue": safe_float(income.get("营业总收入", 0)),
                "operating_profit": safe_float(income.get("营业利润", 0)),
                "working_capital": safe_float(balance.get("流动资产合计", 0)) - safe_float(balance.get("流动负债合计", 0)),
                "depreciation_and_amortization": safe_float(cash.get("固定资产折旧、油气资产折耗、生产性生物资产折旧", 0)),
                "capital_expenditure": abs(safe_float(cash.get("购建固定资产、无形资产和其他长期资产支付的现金", 0))),
                "free_cash_flow": safe_float(cash.get("经营活动产生的现金流量净额", 0)) - abs(safe_float(cash.get("购建固定资产、无形资产和其他长期资产支付的现金", 0)))
            }
        
        latest_balance = balance_df.iloc[0] if balance_df is not None and not balance_df.empty else pd.Series()
        previous_balance = balance_df.iloc[1] if balance_df is not None and len(balance_df) > 1 else latest_balance
        
        latest_income = income_df.iloc[0] if income_df is not None and not income_df.empty else pd.Series()
        previous_income = income_df.iloc[1] if income_df is not None and len(income_df) > 1 else latest_income
        
        latest_cash = cash_df.iloc[0] if cash_df is not None and not cash_df.empty else pd.Series()
        previous_cash = cash_df.iloc[1] if cash_df is not None and len(cash_df) > 1 else latest_cash
        
        items = [
            build_item(latest_balance, latest_income, latest_cash),
            build_item(previous_balance, previous_income, previous_cash)
        ]
        
        logger.info("✓ 财务报表处理完成")
        return items
    
    except Exception as e:
        logger.error(f"获取财务报表失败: {e}")
        return [default_item, default_item]


def get_market_data(symbol: str) -> Dict[str, Any]:
    """获取市场数据"""
    normalized_code = normalize_stock_code(symbol)
    logger.info(f"获取市场数据: {symbol} -> {normalized_code}")
    
    try:
        stock_df = get_realtime_quotes(normalized_code)
        
        if stock_df is not None and not stock_df.empty:
            stock_data = stock_df.iloc[0]
            
            result = {
                "market_cap": safe_float(stock_data.get("总市值", stock_data.get("市值", 0))),
                "volume": safe_float(stock_data.get("成交量", 0)),
                "average_volume": safe_float(stock_data.get("成交量", 0)),
                "fifty_two_week_high": safe_float(stock_data.get("52周最高", stock_data.get("最高", 0))),
                "fifty_two_week_low": safe_float(stock_data.get("52周最低", stock_data.get("最低", 0)))
            }
            logger.info("✓ 市场数据获取成功")
            return result
        
        # 降级：从历史价格获取
        latest_price = get_latest_price_from_history(normalized_code)
        if latest_price:
            logger.info("✓ 市场数据从历史价格获取成功")
            return {
                "market_cap": 0,
                "volume": latest_price.get("volume", 0),
                "average_volume": latest_price.get("volume", 0),
                "fifty_two_week_high": latest_price.get("high", 0),
                "fifty_two_week_low": latest_price.get("low", 0)
            }
        
        logger.warning("市场数据获取失败")
        return {}
    
    except Exception as e:
        logger.error(f"获取市场数据失败: {e}")
        return {}


def prices_to_df(prices) -> pd.DataFrame:
    """转换价格数据"""
    try:
        df = pd.DataFrame(prices)
        column_mapping = {
            '收盘': 'close', '开盘': 'open', '最高': 'high', '最低': 'low',
            '成交量': 'volume', '成交额': 'amount'
        }
        for cn, en in column_mapping.items():
            if cn in df.columns:
                df[en] = df[cn]
        return df
    except Exception as e:
        logger.error(f"转换价格数据失败: {e}")
        return pd.DataFrame(columns=['close', 'open', 'high', 'low', 'volume'])


def get_price_data(ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
    """获取股票价格数据"""
    return get_price_history(ticker, start_date, end_date)
