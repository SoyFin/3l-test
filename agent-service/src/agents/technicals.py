import math
from typing import Dict
from src.utils.logging_config import setup_logger

from langchain_core.messages import HumanMessage

from src.agents.state import AgentState, show_agent_reasoning, show_workflow_status
from src.utils.api_utils import agent_endpoint, log_llm_interaction

import json
import pandas as pd
import numpy as np

from src.tools.api import prices_to_df

# 初始化 logger
logger = setup_logger('technical_analyst_agent')


##### Technical Analyst #####
@agent_endpoint("technical_analyst", "技术分析师，提供基于价格走势、指标和技术模式的交易信号")
def technical_analyst_agent(state: AgentState):
    """
    Sophisticated technical analysis system that combines multiple trading strategies:
    1. Trend Following
    2. Mean Reversion
    3. Momentum
    4. Volatility Analysis
    5. Statistical Arbitrage Signals
    """
    logger.info("\n--- DEBUG: technical_analyst_agent START ---")
    show_workflow_status("Technical Analyst")
    show_reasoning = state["metadata"]["show_reasoning"]
    data = state["data"]
    prices = data["prices"]
    prices_df = prices_to_df(prices)
    
    # 检查数据是否足够
    if prices_df is None or prices_df.empty or len(prices_df) < 20:
        logger.warning(f"价格数据不足或为空，无法进行技术分析。数据量: {len(prices_df) if prices_df is not None else 0}")
        message_content = {
            "signal": "neutral",
            "confidence": "0%",
            "reasoning": "价格数据不足，无法进行技术分析"
        }
        message = HumanMessage(
            content=json.dumps(message_content),
            name="technical_analyst_agent",
        )
        return {
            "messages": [message],
            "data": {**data, "technical_analysis": message_content},
            "metadata": state["metadata"],
        }

    # 1. Trend Following Strategy
    trend_signals = calculate_trend_signals(prices_df)

    # 2. Mean Reversion Strategy
    mean_reversion_signals = calculate_mean_reversion_signals(prices_df)

    # 3. Momentum Strategy
    momentum_signals = calculate_momentum_signals(prices_df)

    # 4. Volatility Strategy
    volatility_signals = calculate_volatility_signals(prices_df)

    # 5. Statistical Arbitrage Signals
    stat_arb_signals = calculate_stat_arb_signals(prices_df)

    # Combine all signals using a weighted ensemble approach
    strategy_weights = {
        'trend': 0.30,
        'mean_reversion': 0.25,
        'momentum': 0.25,
        'volatility': 0.15,
        'stat_arb': 0.05
    }

    combined_signal = weighted_signal_combination({
        'trend': trend_signals,
        'mean_reversion': mean_reversion_signals,
        'momentum': momentum_signals,
        'volatility': volatility_signals,
        'stat_arb': stat_arb_signals
    }, strategy_weights)

    # Generate detailed analysis report
    analysis_report = {
        "signal": combined_signal['signal'],
        "confidence": f"{round(combined_signal['confidence'] * 100)}%",
        "strategy_signals": {
            "trend_following": {
                "signal": trend_signals['signal'],
                "confidence": f"{round(trend_signals['confidence'] * 100)}%",
                "metrics": normalize_pandas(trend_signals['metrics'])
            },
            "mean_reversion": {
                "signal": mean_reversion_signals['signal'],
                "confidence": f"{round(mean_reversion_signals['confidence'] * 100)}%",
                "metrics": normalize_pandas(mean_reversion_signals['metrics'])
            },
            "momentum": {
                "signal": momentum_signals['signal'],
                "confidence": f"{round(momentum_signals['confidence'] * 100)}%",
                "metrics": normalize_pandas(momentum_signals['metrics'])
            },
            "volatility": {
                "signal": volatility_signals['signal'],
                "confidence": f"{round(volatility_signals['confidence'] * 100)}%",
                "metrics": normalize_pandas(volatility_signals['metrics'])
            },
            "statistical_arbitrage": {
                "signal": stat_arb_signals['signal'],
                "confidence": f"{round(stat_arb_signals['confidence'] * 100)}%",
                "metrics": normalize_pandas(stat_arb_signals['metrics'])
            }
        }
    }

    # Create the technical analyst message
    message = HumanMessage(
        content=json.dumps(analysis_report),
        name="technical_analyst_agent",
    )

    if show_reasoning:
        show_agent_reasoning(analysis_report, "Technical Analyst")
        state["metadata"]["agent_reasoning"] = analysis_report

    show_workflow_status("Technical Analyst", "completed")

    return {
        "messages": [message],
        "data": data,
        "metadata": state["metadata"],
    }


def calculate_trend_signals(prices_df):
    """Advanced trend following strategy using multiple timeframes and indicators"""
    # Calculate EMAs for multiple timeframes
    ema_8 = calculate_ema(prices_df, 8)
    ema_21 = calculate_ema(prices_df, 21)
    ema_55 = calculate_ema(prices_df, 55)

    # Calculate ADX for trend strength
    adx = calculate_adx(prices_df, 14)

    # Determine trend direction and strength
    short_trend = ema_8 > ema_21
    medium_trend = ema_21 > ema_55

    # Combine signals with confidence weighting
    trend_strength = adx['adx'].iloc[-1] / 100.0

    if short_trend.iloc[-1] and medium_trend.iloc[-1]:
        signal = 'bullish'
        confidence = trend_strength
    elif not short_trend.iloc[-1] and not medium_trend.iloc[-1]:
        signal = 'bearish'
        confidence = trend_strength
    else:
        signal = 'neutral'
        confidence = 0.5

    return {
        'signal': signal,
        'confidence': confidence,
        'metrics': {
            'adx': float(adx['adx'].iloc[-1]),
            'trend_strength': float(trend_strength),
        }
    }


def calculate_mean_reversion_signals(prices_df):
    """Mean reversion strategy using statistical measures and Bollinger Bands"""
    # Calculate z-score of price relative to moving average
    ma_50 = prices_df['close'].rolling(window=50, min_periods=20).mean()
    std_50 = prices_df['close'].rolling(window=50, min_periods=20).std()
    z_score = (prices_df['close'] - ma_50) / std_50

    # Calculate Bollinger Bands
    bb_upper, bb_lower = calculate_bollinger_bands(prices_df)

    # Calculate RSI with multiple timeframes
    rsi_14 = calculate_rsi(prices_df, 14)
    rsi_28 = calculate_rsi(prices_df, 28)

    # 处理NaN值
    z_score_val = z_score.iloc[-1] if not pd.isna(z_score.iloc[-1]) else 0
    
    # 安全计算 price_vs_bb
    bb_range = bb_upper.iloc[-1] - bb_lower.iloc[-1]
    if pd.isna(bb_range) or bb_range == 0:
        price_vs_bb = 0.5
    else:
        price_vs_bb = (prices_df['close'].iloc[-1] - bb_lower.iloc[-1]) / bb_range

    # Combine signals
    if z_score_val < -2 and price_vs_bb < 0.2:
        signal = 'bullish'
        confidence = min(abs(z_score_val) / 4, 1.0)
    elif z_score_val > 2 and price_vs_bb > 0.8:
        signal = 'bearish'
        confidence = min(abs(z_score_val) / 4, 1.0)
    else:
        signal = 'neutral'
        confidence = 0.5

    return {
        'signal': signal,
        'confidence': confidence,
        'metrics': {
            'z_score': float(z_score_val),
            'price_vs_bb': float(price_vs_bb),
            'rsi_14': float(rsi_14.iloc[-1]) if not pd.isna(rsi_14.iloc[-1]) else 50,
            'rsi_28': float(rsi_28.iloc[-1]) if not pd.isna(rsi_28.iloc[-1]) else 50
        }
    }


def calculate_momentum_signals(prices_df):
    """Multi-factor momentum strategy with conservative settings"""
    # Price momentum with adjusted min_periods
    returns = prices_df['close'].pct_change()
    mom_1m = returns.rolling(21, min_periods=5).sum()
    mom_3m = returns.rolling(63, min_periods=42).sum()
    mom_6m = returns.rolling(126, min_periods=63).sum()

    # Volume momentum
    volume_ma = prices_df['volume'].rolling(21, min_periods=10).mean()
    volume_momentum = prices_df['volume'] / volume_ma.replace(0, np.nan)

    # 处理NaN值
    mom_1m_val = mom_1m.iloc[-1] if not pd.isna(mom_1m.iloc[-1]) else 0
    mom_3m_val = mom_3m.iloc[-1] if not pd.isna(mom_3m.iloc[-1]) else mom_1m_val
    mom_6m_val = mom_6m.iloc[-1] if not pd.isna(mom_6m.iloc[-1]) else mom_3m_val

    # Calculate momentum score
    momentum_score = 0.2 * mom_1m_val + 0.3 * mom_3m_val + 0.5 * mom_6m_val

    # Volume confirmation
    volume_conf_val = volume_momentum.iloc[-1] if not pd.isna(volume_momentum.iloc[-1]) else 1.0
    volume_confirmation = volume_conf_val > 1.0

    if momentum_score > 0.05 and volume_confirmation:
        signal = 'bullish'
        confidence = min(abs(momentum_score) * 5, 1.0)
    elif momentum_score < -0.05 and volume_confirmation:
        signal = 'bearish'
        confidence = min(abs(momentum_score) * 5, 1.0)
    else:
        signal = 'neutral'
        confidence = 0.5

    return {
        'signal': signal,
        'confidence': confidence,
        'metrics': {
            'momentum_1m': float(mom_1m_val),
            'momentum_3m': float(mom_3m_val),
            'momentum_6m': float(mom_6m_val),
            'volume_momentum': float(volume_conf_val)
        }
    }


def calculate_volatility_signals(prices_df):
    """Optimized volatility calculation with shorter lookback periods"""
    returns = prices_df['close'].pct_change()

    # 计算历史波动率
    hist_vol = returns.rolling(21, min_periods=10).std() * math.sqrt(252)

    # 计算波动率均值
    vol_ma = hist_vol.rolling(42, min_periods=21).mean()
    vol_regime = hist_vol / vol_ma.replace(0, np.nan)

    # 计算波动率Z分数
    vol_std = hist_vol.rolling(42, min_periods=21).std()
    vol_z_score = (hist_vol - vol_ma) / vol_std.replace(0, np.nan)

    # ATR计算
    atr = calculate_atr(prices_df, period=14, min_periods=7)
    atr_ratio = atr / prices_df['close']

    # 处理NaN值
    current_vol_regime = vol_regime.iloc[-1] if not pd.isna(vol_regime.iloc[-1]) else 1.0
    vol_z = vol_z_score.iloc[-1] if not pd.isna(vol_z_score.iloc[-1]) else 0.0
    atr_ratio_val = atr_ratio.iloc[-1] if not pd.isna(atr_ratio.iloc[-1]) else 0.02

    # Generate signal
    if current_vol_regime < 0.8 and vol_z < -1:
        signal = 'bullish'
        confidence = min(abs(vol_z) / 3, 1.0)
    elif current_vol_regime > 1.2 and vol_z > 1:
        signal = 'bearish'
        confidence = min(abs(vol_z) / 3, 1.0)
    else:
        signal = 'neutral'
        confidence = 0.5

    return {
        'signal': signal,
        'confidence': confidence,
        'metrics': {
            'historical_volatility': float(hist_vol.iloc[-1]) if not pd.isna(hist_vol.iloc[-1]) else 0.2,
            'volatility_regime': float(current_vol_regime),
            'volatility_z_score': float(vol_z),
            'atr_ratio': float(atr_ratio_val)
        }
    }


def calculate_stat_arb_signals(prices_df):
    """Optimized statistical arbitrage signals with shorter lookback periods"""
    returns = prices_df['close'].pct_change()

    # 计算偏度和峰度
    skew = returns.rolling(42, min_periods=21).skew()
    kurt = returns.rolling(42, min_periods=21).kurt()

    # Hurst指数计算
    hurst = calculate_hurst_exponent(prices_df['close'], max_lag=10)

    # 处理NaN值
    skew_val = skew.iloc[-1] if not pd.isna(skew.iloc[-1]) else 0.0
    kurt_val = kurt.iloc[-1] if not pd.isna(kurt.iloc[-1]) else 3.0

    # Generate signal
    if hurst < 0.4 and skew_val > 1:
        signal = 'bullish'
        confidence = (0.5 - hurst) * 2
    elif hurst < 0.4 and skew_val < -1:
        signal = 'bearish'
        confidence = (0.5 - hurst) * 2
    else:
        signal = 'neutral'
        confidence = 0.5

    return {
        'signal': signal,
        'confidence': confidence,
        'metrics': {
            'hurst_exponent': float(hurst),
            'skewness': float(skew_val),
            'kurtosis': float(kurt_val)
        }
    }


def weighted_signal_combination(signals, weights):
    """Combines multiple trading signals using a weighted approach"""
    signal_values = {
        'bullish': 1,
        'neutral': 0,
        'bearish': -1
    }

    weighted_sum = 0
    total_confidence = 0

    for strategy, signal in signals.items():
        numeric_signal = signal_values[signal['signal']]
        weight = weights[strategy]
        confidence = signal['confidence']

        weighted_sum += numeric_signal * weight * confidence
        total_confidence += weight * confidence

    # Normalize the weighted sum
    if total_confidence > 0:
        final_score = weighted_sum / total_confidence
    else:
        final_score = 0

    # Convert back to signal
    if final_score > 0.2:
        signal = 'bullish'
    elif final_score < -0.2:
        signal = 'bearish'
    else:
        signal = 'neutral'

    return {
        'signal': signal,
        'confidence': abs(final_score)
    }


def normalize_pandas(obj):
    """Convert pandas Series/DataFrames to primitive Python types"""
    if isinstance(obj, pd.Series):
        return obj.tolist()
    elif isinstance(obj, pd.DataFrame):
        return obj.to_dict('records')
    elif isinstance(obj, dict):
        return {k: normalize_pandas(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [normalize_pandas(item) for item in obj]
    return obj


def calculate_macd(prices_df: pd.DataFrame) -> tuple:
    ema_12 = prices_df['close'].ewm(span=12, adjust=False).mean()
    ema_26 = prices_df['close'].ewm(span=26, adjust=False).mean()
    macd_line = ema_12 - ema_26
    signal_line = macd_line.ewm(span=9, adjust=False).mean()
    return macd_line, signal_line


def calculate_rsi(prices_df: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = prices_df['close'].diff()
    gain = (delta.where(delta > 0, 0)).fillna(0)
    loss = (-delta.where(delta < 0, 0)).fillna(0)
    avg_gain = gain.rolling(window=period).mean()
    avg_loss = loss.rolling(window=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)


def calculate_bollinger_bands(prices_df: pd.DataFrame, window: int = 20) -> tuple:
    sma = prices_df['close'].rolling(window, min_periods=10).mean()
    std_dev = prices_df['close'].rolling(window, min_periods=10).std()
    upper_band = sma + (std_dev * 2)
    lower_band = sma - (std_dev * 2)
    return upper_band, lower_band


def calculate_ema(df: pd.DataFrame, window: int) -> pd.Series:
    """Calculate Exponential Moving Average"""
    return df['close'].ewm(span=window, adjust=False).mean()


def calculate_adx(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    """Calculate Average Directional Index (ADX)"""
    df = df.copy()
    
    # Calculate True Range
    df['high_low'] = df['high'] - df['low']
    df['high_close'] = abs(df['high'] - df['close'].shift())
    df['low_close'] = abs(df['low'] - df['close'].shift())
    df['tr'] = df[['high_low', 'high_close', 'low_close']].max(axis=1)

    # Calculate Directional Movement
    df['up_move'] = df['high'] - df['high'].shift()
    df['down_move'] = df['low'].shift() - df['low']

    df['plus_dm'] = np.where(
        (df['up_move'] > df['down_move']) & (df['up_move'] > 0),
        df['up_move'],
        0
    )
    df['minus_dm'] = np.where(
        (df['down_move'] > df['up_move']) & (df['down_move'] > 0),
        df['down_move'],
        0
    )

    # Calculate ADX
    df['+di'] = 100 * (df['plus_dm'].ewm(span=period).mean() /
                       df['tr'].ewm(span=period).mean())
    df['-di'] = 100 * (df['minus_dm'].ewm(span=period).mean() /
                       df['tr'].ewm(span=period).mean())
    df['dx'] = 100 * abs(df['+di'] - df['-di']) / (df['+di'] + df['-di']).replace(0, np.nan)
    df['adx'] = df['dx'].ewm(span=period).mean()

    return df[['adx', '+di', '-di']]


def calculate_atr(df: pd.DataFrame, period: int = 14, min_periods: int = 7) -> pd.Series:
    """Optimized ATR calculation with minimum periods parameter"""
    high_low = df['high'] - df['low']
    high_close = abs(df['high'] - df['close'].shift())
    low_close = abs(df['low'] - df['close'].shift())

    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)

    return true_range.rolling(period, min_periods=min_periods).mean()


def calculate_hurst_exponent(price_series: pd.Series, max_lag: int = 10) -> float:
    """Optimized Hurst exponent calculation with shorter lookback"""
    try:
        returns = np.log(price_series / price_series.shift(1)).dropna()

        if len(returns) < max_lag * 2:
            return 0.5

        lags = range(2, max_lag)
        tau = [np.sqrt(np.std(np.subtract(returns[lag:], returns[:-lag])))
               for lag in lags]

        tau = [max(1e-8, t) for t in tau]

        reg = np.polyfit(np.log(list(lags)), np.log(tau), 1)
        h = reg[0]

        return max(0.0, min(1.0, h))

    except (ValueError, RuntimeWarning, np.linalg.LinAlgError):
        return 0.5


def calculate_obv(prices_df: pd.DataFrame) -> pd.Series:
    """Calculate On-Balance Volume"""
    obv = [0]
    for i in range(1, len(prices_df)):
        if prices_df['close'].iloc[i] > prices_df['close'].iloc[i - 1]:
            obv.append(obv[-1] + prices_df['volume'].iloc[i])
        elif prices_df['close'].iloc[i] < prices_df['close'].iloc[i - 1]:
            obv.append(obv[-1] - prices_df['volume'].iloc[i])
        else:
            obv.append(obv[-1])
    return pd.Series(obv, index=prices_df.index)
