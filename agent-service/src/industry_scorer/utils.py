# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统 - 工具函数模块
"""

import json
import os
import pickle
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple, Union
import numpy as np
import pandas as pd


def linear_score(
    value: float,
    min_val: float,
    max_val: float,
    reverse: bool = False
) -> float:
    """
    线性评分函数

    Args:
        value: 待评分值
        min_val: 最小值（得分0）
        max_val: 最大值（得分10）
        reverse: 是否反向（值越大得分越低）

    Returns:
        0-10分的评分
    """
    if max_val == min_val:
        return 5.0

    if reverse:
        # 反向评分：值越大得分越低
        score = 10 * (1 - (value - min_val) / (max_val - min_val))
    else:
        # 正向评分：值越大得分越高
        score = 10 * (value - min_val) / (max_val - min_val)

    return max(0, min(10, score))


def filter_outlier(
    data: List[float],
    method: str = "iqr",
    threshold: float = 1.5
) -> Tuple[List[float], List[int]]:
    """
    异常值过滤

    Args:
        data: 数据列表
        method: 过滤方法 (iqr/zscore)
        threshold: 阈值

    Returns:
        过滤后的数据和异常值索引
    """
    if not data:
        return [], []

    arr = np.array(data)
    outlier_indices = []

    if method == "iqr":
        q1 = np.percentile(arr, 25)
        q3 = np.percentile(arr, 75)
        iqr = q3 - q1
        lower_bound = q1 - threshold * iqr
        upper_bound = q3 + threshold * iqr
        outlier_indices = np.where((arr < lower_bound) | (arr > upper_bound))[0].tolist()
    elif method == "zscore":
        mean = np.mean(arr)
        std = np.std(arr)
        if std > 0:
            z_scores = np.abs((arr - mean) / std)
            outlier_indices = np.where(z_scores > threshold)[0].tolist()

    filtered_data = [d for i, d in enumerate(data) if i not in outlier_indices]
    return filtered_data, outlier_indices


def save_cache(
    data: Any,
    cache_name: str,
    cache_dir: str = "/tmp/industry_scorer_cache"
) -> str:
    """
    保存缓存数据

    Args:
        data: 待缓存数据
        cache_name: 缓存名称
        cache_dir: 缓存目录

    Returns:
        缓存文件路径
    """
    os.makedirs(cache_dir, exist_ok=True)
    cache_path = os.path.join(cache_dir, f"{cache_name}.pkl")

    with open(cache_path, "wb") as f:
        pickle.dump(data, f)

    return cache_path


def load_cache(
    cache_name: str,
    cache_dir: str = "/tmp/industry_scorer_cache",
    max_age_hours: int = 24
) -> Optional[Any]:
    """
    加载缓存数据

    Args:
        cache_name: 缓存名称
        cache_dir: 缓存目录
        max_age_hours: 最大缓存时间（小时）

    Returns:
        缓存数据，如果不存在或过期则返回None
    """
    cache_path = os.path.join(cache_dir, f"{cache_name}.pkl")

    if not os.path.exists(cache_path):
        return None

    # 检查缓存时间
    file_mtime = datetime.fromtimestamp(os.path.getmtime(cache_path))
    if (datetime.now() - file_mtime).total_seconds() > max_age_hours * 3600:
        return None

    with open(cache_path, "rb") as f:
        return pickle.load(f)


def judge_market_cycle(
    index_data: pd.DataFrame,
    lookback: int = 60
) -> Dict[str, Any]:
    """
    判断市场周期

    Args:
        index_data: 指数数据（需包含close列）
        lookback: 回看天数

    Returns:
        市场周期信息字典
    """
    if len(index_data) < lookback:
        return {
            "cycle": "unknown",
            "position": 0.5,
            "trend": "neutral"
        }

    recent_data = index_data.tail(lookback)
    close = recent_data["close"].values

    # 计算均线
    ma20 = np.mean(close[-20:])
    ma60 = np.mean(close[-60:]) if len(close) >= 60 else np.mean(close)
    current = close[-1]

    # 判断趋势
    if current > ma20 > ma60:
        trend = "up"
        cycle = "bull"
    elif current < ma20 < ma60:
        trend = "down"
        cycle = "bear"
    else:
        trend = "neutral"
        cycle = "consolidate"

    # 计算位置（相对高低）
    high_60 = np.max(close[-60:])
    low_60 = np.min(close[-60:])
    position = (current - low_60) / (high_60 - low_60) if high_60 != low_60 else 0.5

    return {
        "cycle": cycle,
        "position": position,
        "trend": trend,
        "ma20": ma20,
        "ma60": ma60,
        "current": current
    }


def calculate_percentile_rank(
    value: float,
    historical_values: List[float]
) -> float:
    """
    计算历史分位数

    Args:
        value: 当前值
        historical_values: 历史值列表

    Returns:
        分位数（0-100）
    """
    if not historical_values:
        return 50.0

    sorted_values = sorted(historical_values)
    rank = sum(1 for v in sorted_values if v <= value)
    percentile = (rank / len(sorted_values)) * 100

    return percentile


def normalize_score(
    raw_score: float,
    min_score: float = 0,
    max_score: float = 10,
    target_min: float = 0,
    target_max: float = 10
) -> float:
    """
    分数归一化

    Args:
        raw_score: 原始分数
        min_score: 原始最小分
        max_score: 原始最大分
        target_min: 目标最小分
        target_max: 目标最大分

    Returns:
        归一化后的分数
    """
    if max_score == min_score:
        return (target_min + target_max) / 2

    normalized = (raw_score - min_score) / (max_score - min_score)
    return target_min + normalized * (target_max - target_min)


def format_score_breakdown(scores: Dict[str, float]) -> str:
    """
    格式化评分明细

    Args:
        scores: 各维度评分字典

    Returns:
        格式化字符串
    """
    lines = []
    dimension_names = {
        "earnings_turn": "业绩拐点",
        "valuation": "估值评分",
        "supply_barrier": "供给壁垒",
        "risk_exclude": "风险排除",
        "logic_change": "逻辑质变",
        "momentum": "动量因子",
        "north_money": "北向资金",
    }

    for key, value in scores.items():
        name = dimension_names.get(key, key)
        lines.append(f"  {name}: {value:.1f}分")

    return "\n".join(lines)


def safe_divide(
    numerator: float,
    denominator: float,
    default: float = 0.0
) -> float:
    """
    安全除法

    Args:
        numerator: 分子
        denominator: 分母
        default: 默认值

    Returns:
        除法结果或默认值
    """
    if denominator == 0:
        return default
    return numerator / denominator


def get_week_date(date: Optional[datetime] = None) -> str:
    """
    获取周日期字符串（周一的日期）

    Args:
        date: 日期，默认为今天

    Returns:
        周日期字符串 (YYYY-MM-DD)
    """
    if date is None:
        date = datetime.now()

    # 获取本周一
    weekday = date.weekday()
    monday = date - pd.Timedelta(days=weekday)

    return monday.strftime("%Y-%m-%d")


def parse_industry_data(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    解析行业数据

    Args:
        raw_data: 原始数据

    Returns:
        解析后的数据
    """
    parsed = {}

    for key, value in raw_data.items():
        # 处理NaN值
        if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
            parsed[key] = None
        else:
            parsed[key] = value

    return parsed
