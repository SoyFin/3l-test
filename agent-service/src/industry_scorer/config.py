# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统 - 配置模块
"""

import os
from typing import Dict, List, Optional

# 行业类型分类映射
# 价值型：低PE、高分红、稳定现金流
# 周期型：业绩随经济周期波动
# 消费型：品牌溢价、稳定增长
# 成长型：高增长、高估值

INDUSTRY_TYPE_MAP: Dict[str, str] = {
    # 价值型行业
    "银行": "value",
    "保险": "value",
    "证券": "value",
    "房地产": "value",
    "电力": "value",
    "水务": "value",
    "燃气": "value",
    "高速公路": "value",
    "港口": "value",
    "机场": "value",

    # 周期型行业
    "煤炭开采": "cycle",
    "石油开采": "cycle",
    "钢铁": "cycle",
    "有色金属": "cycle",
    "化工": "cycle",
    "水泥": "cycle",
    "玻璃": "cycle",
    "造纸": "cycle",
    "化纤": "cycle",
    "橡胶": "cycle",
    "航运": "cycle",
    "船舶制造": "cycle",
    "工程机械": "cycle",
    "重型机械": "cycle",

    # 消费型行业
    "白酒": "consume",
    "啤酒": "consume",
    "调味品": "consume",
    "乳制品": "consume",
    "肉制品": "consume",
    "家电": "consume",
    "小家电": "consume",
    "服装": "consume",
    "珠宝首饰": "consume",
    "化妆品": "consume",
    "医美": "consume",
    "教育": "consume",
    "旅游": "consume",
    "酒店": "consume",
    "餐饮": "consume",
    "零售": "consume",
    "超市": "consume",

    # 成长型行业
    "半导体": "growth",
    "集成电路": "growth",
    "消费电子": "growth",
    "电子制造": "growth",
    "光学光电子": "growth",
    "软件开发": "growth",
    "IT服务": "growth",
    "计算机设备": "growth",
    "通信设备": "growth",
    "光伏设备": "growth",
    "风电设备": "growth",
    "锂电池": "growth",
    "新能源汽车": "growth",
    "汽车零部件": "growth",
    "医疗服务": "growth",
    "医疗器械": "growth",
    "生物制品": "growth",
    "化学制药": "growth",
    "机器人": "growth",
    "工业自动化": "growth",
    "航天航空": "growth",
    "军工": "growth",
}

# 评分权重配置
SCORING_WEIGHTS: Dict[str, float] = {
    "earnings_turn": 0.25,    # 业绩拐点 25%
    "valuation": 0.20,        # 估值评分 20%
    "supply_barrier": 0.15,   # 供给壁垒 15%
    "risk_exclude": 0.10,     # 风险排除 10%
    "logic_change": 0.15,     # 逻辑质变 15%
    "momentum": 0.10,         # 动量因子 10%
    "north_money": 0.05,      # 北向资金 5%
}

# PE估值阈值（历史分位数）
PE_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "value": {
        "low": 20,      # 低估值：分位数 < 20%
        "high": 60,     # 高估值：分位数 > 60%
        "score_low": 8, # 低估值得分
        "score_mid": 5, # 中等估值得分
        "score_high": 2,# 高估值得分
    },
    "cycle": {
        "low": 15,
        "high": 70,
        "score_low": 7,
        "score_mid": 5,
        "score_high": 3,
    },
    "consume": {
        "low": 30,
        "high": 70,
        "score_low": 6,
        "score_mid": 5,
        "score_high": 4,
    },
    "growth": {
        "low": 25,
        "high": 75,
        "score_low": 5,
        "score_mid": 5,
        "score_high": 5,
    },
}

# PB估值阈值
PB_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "value": {
        "low": 20,
        "high": 60,
        "score_low": 8,
        "score_mid": 5,
        "score_high": 2,
    },
    "cycle": {
        "low": 15,
        "high": 70,
        "score_low": 7,
        "score_mid": 5,
        "score_high": 3,
    },
    "consume": {
        "low": 30,
        "high": 70,
        "score_low": 6,
        "score_mid": 5,
        "score_high": 4,
    },
    "growth": {
        "low": 25,
        "high": 75,
        "score_low": 5,
        "score_mid": 5,
        "score_high": 5,
    },
}

# 行业盈利周期判断阈值
EARNINGS_CYCLE_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "value": {
        "revenue_growth_up": 5,      # 营收增速上升阈值
        "revenue_growth_down": -5,   # 营收增速下降阈值
        "profit_growth_up": 10,      # 利润增速上升阈值
        "profit_growth_down": -10,   # 利润增速下降阈值
    },
    "cycle": {
        "revenue_growth_up": 15,
        "revenue_growth_down": -15,
        "profit_growth_up": 20,
        "profit_growth_down": -20,
    },
    "consume": {
        "revenue_growth_up": 10,
        "revenue_growth_down": -5,
        "profit_growth_up": 15,
        "profit_growth_down": -10,
    },
    "growth": {
        "revenue_growth_up": 20,
        "revenue_growth_down": 0,
        "profit_growth_up": 25,
        "profit_growth_down": -5,
    },
}

# 风险因子阈值
RISK_THRESHOLDS: Dict[str, Dict[str, float]] = {
    "debt_ratio_high": 70,        # 资产负债率高风险线
    "debt_ratio_low": 30,         # 资产负债率低风险线
    "pledge_ratio_high": 30,      # 股权质押高风险线
    "pledge_ratio_low": 10,       # 股权质押低风险线
    "goodwill_high": 30,          # 商誉占净资产高风险线
    "goodwill_low": 5,            # 商誉占净资产低风险线
    "inventory_turnover_low": 2,  # 存货周转率低风险线
}

# 动量因子参数
MOMENTUM_CONFIG: Dict[str, Dict[str, float]] = {
    "short_period": 5,            # 短期动量天数
    "mid_period": 20,             # 中期动量天数
    "long_period": 60,            # 长期动量天数
    "short_weight": 0.5,          # 短期权重
    "mid_weight": 0.3,            # 中期权重
    "long_weight": 0.2,           # 长期权重
}

# 北向资金参数
NORTH_MONEY_CONFIG: Dict[str, Dict[str, float]] = {
    "lookback_days": 20,          # 回看天数
    "inflow_threshold": 5,        # 大幅流入阈值（亿）
    "outflow_threshold": -5,      # 大幅流出阈值（亿）
}


def get_industry_type(industry_name: str) -> str:
    """
    获取行业类型

    Args:
        industry_name: 行业名称

    Returns:
        行业类型: value/cycle/consume/growth
    """
    # 直接匹配
    if industry_name in INDUSTRY_TYPE_MAP:
        return INDUSTRY_TYPE_MAP[industry_name]

    # 模糊匹配
    for key, value in INDUSTRY_TYPE_MAP.items():
        if key in industry_name or industry_name in key:
            return value

    # 默认为成长型
    return "growth"


def get_api_config() -> Dict[str, Optional[str]]:
    """
    获取API配置

    Returns:
        API配置字典
    """
    return {
        "doubao_api_key": os.getenv("DOUBAO_API_KEY", ""),
        "doubao_model_id": os.getenv("DOUBAO_MODEL_ID", ""),
        "doubao_base_url": os.getenv("DOUBAO_BASE_URL", "https://ark.cn-beijing.volces.com/api/v3"),
    }


def get_scoring_weights(industry_type: str) -> Dict[str, float]:
    """
    根据行业类型获取评分权重

    Args:
        industry_type: 行业类型

    Returns:
        评分权重字典
    """
    base_weights = SCORING_WEIGHTS.copy()

    # 根据行业类型调整权重
    if industry_type == "value":
        # 价值型：重视估值和风险
        base_weights["valuation"] = 0.25
        base_weights["risk_exclude"] = 0.15
        base_weights["momentum"] = 0.05
    elif industry_type == "cycle":
        # 周期型：重视业绩拐点和供给
        base_weights["earnings_turn"] = 0.30
        base_weights["supply_barrier"] = 0.20
    elif industry_type == "consume":
        # 消费型：重视业绩和北向资金
        base_weights["earnings_turn"] = 0.30
        base_weights["north_money"] = 0.10
    elif industry_type == "growth":
        # 成长型：重视逻辑质变和动量
        base_weights["logic_change"] = 0.20
        base_weights["momentum"] = 0.15

    return base_weights


def get_pe_threshold(industry_type: str) -> Dict[str, float]:
    """获取PE估值阈值"""
    return PE_THRESHOLDS.get(industry_type, PE_THRESHOLDS["growth"])


def get_pb_threshold(industry_type: str) -> Dict[str, float]:
    """获取PB估值阈值"""
    return PB_THRESHOLDS.get(industry_type, PB_THRESHOLDS["growth"])
