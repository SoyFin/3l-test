# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统

基于七个维度对申万二级行业进行量化评分：
- 业绩拐点 (25%): 基于行业盈利周期判断
- 估值评分 (20%): PE/PB历史分位分析
- 供给壁垒 (15%): LLM定性分析行业壁垒
- 风险排除 (10%): 行业风险指标排查
- 逻辑质变 (15%): LLM分析行业逻辑变化
- 动量因子 (10%): 涨跌幅趋势分析
- 北向资金 (5%): 外资流向分析
"""

from .config import (
    INDUSTRY_TYPE_MAP,
    SCORING_WEIGHTS,
    PE_THRESHOLDS,
    PB_THRESHOLDS,
    get_industry_type,
    get_api_config
)
from .data_fetcher import DataFetcher
from .scorer import DavisScorer
from .utils import (
    linear_score,
    filter_outlier,
    save_cache,
    load_cache,
    judge_market_cycle
)

__all__ = [
    'INDUSTRY_TYPE_MAP',
    'SCORING_WEIGHTS',
    'PE_THRESHOLDS',
    'PB_THRESHOLDS',
    'get_industry_type',
    'get_api_config',
    'DataFetcher',
    'DavisScorer',
    'linear_score',
    'filter_outlier',
    'save_cache',
    'load_cache',
    'judge_market_cycle'
]
