# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统 - 核心评分模块
"""

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
import pandas as pd
import numpy as np

from .config import (
    get_industry_type,
    get_scoring_weights,
    get_pe_threshold,
    get_pb_threshold,
    EARNINGS_CYCLE_THRESHOLDS,
    RISK_THRESHOLDS,
    MOMENTUM_CONFIG,
    NORTH_MONEY_CONFIG,
    SCORING_WEIGHTS,
)
from .utils import (
    linear_score,
    filter_outlier,
    calculate_percentile_rank,
    safe_divide,
    format_score_breakdown,
    get_week_date,
    judge_market_cycle,
)
from .data_fetcher import DataFetcher


class DavisScorer:
    """戴维斯双击评分器"""

    def __init__(self, data_fetcher: DataFetcher = None):
        """
        初始化评分器

        Args:
            data_fetcher: 数据获取器实例
        """
        self.data_fetcher = data_fetcher or DataFetcher()

    def calculate_earnings_turn_score(
        self,
        industry_name: str,
        daily_data: pd.DataFrame = None,
        financial_data: Dict = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算业绩拐点得分

        Args:
            industry_name: 行业名称
            daily_data: 日线数据
            financial_data: 财务数据

        Returns:
            得分和详细信息
        """
        industry_type = get_industry_type(industry_name)
        thresholds = EARNINGS_CYCLE_THRESHOLDS.get(industry_type, EARNINGS_CYCLE_THRESHOLDS["growth"])

        detail = {
            "industry_type": industry_type,
            "revenue_trend": "unknown",
            "profit_trend": "unknown",
            "cycle_position": "neutral",
        }

        score = 5.0  # 默认中性得分

        try:
            if daily_data is not None and len(daily_data) > 20:
                # 计算价格趋势作为业绩代理
                close = daily_data['close'].values
                ma5 = np.mean(close[-5:])
                ma20 = np.mean(close[-20:])

                if ma5 > ma20 * 1.02:
                    detail["revenue_trend"] = "up"
                    score += 2
                elif ma5 < ma20 * 0.98:
                    detail["revenue_trend"] = "down"
                    score -= 2

                # 计算动量
                returns = np.diff(close[-20:]) / close[-21:-1]
                positive_days = np.sum(returns > 0)
                if positive_days > 12:
                    detail["profit_trend"] = "up"
                    score += 1.5
                elif positive_days < 8:
                    detail["profit_trend"] = "down"
                    score -= 1.5

                # 判断周期位置
                high_60 = np.max(close[-60:]) if len(close) >= 60 else np.max(close)
                low_60 = np.min(close[-60:]) if len(close) >= 60 else np.min(close)
                current = close[-1]
                position = (current - low_60) / (high_60 - low_60) if high_60 != low_60 else 0.5

                if position < 0.3:
                    detail["cycle_position"] = "bottom"
                    score += 2  # 底部加分
                elif position > 0.7:
                    detail["cycle_position"] = "top"
                    score -= 1  # 顶部减分

        except Exception as e:
            print(f"计算业绩拐点得分失败: {e}")

        score = max(0, min(10, score))
        return score, detail

    def calculate_valuation_score(
        self,
        industry_name: str,
        pe_data: Dict = None,
        pb_data: Dict = None,
        daily_data: pd.DataFrame = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算估值得分

        Args:
            industry_name: 行业名称
            pe_data: PE数据
            pb_data: PB数据
            daily_data: 日线数据

        Returns:
            得分和详细信息
        """
        industry_type = get_industry_type(industry_name)
        pe_threshold = get_pe_threshold(industry_type)
        pb_threshold = get_pb_threshold(industry_type)

        detail = {
            "industry_type": industry_type,
            "pe_percentile": None,
            "pb_percentile": None,
            "valuation_level": "neutral",
        }

        pe_score = 5.0
        pb_score = 5.0

        try:
            if daily_data is not None and len(daily_data) > 60:
                # 使用价格历史模拟估值分位数
                close = daily_data['close'].values
                current = close[-1]

                # 计算当前价格在历史中的位置（作为估值代理）
                pe_percentile = calculate_percentile_rank(current, close.tolist())
                detail["pe_percentile"] = pe_percentile

                # 根据分位数评分
                if pe_percentile < pe_threshold["low"]:
                    pe_score = pe_threshold["score_low"]
                    detail["valuation_level"] = "low"
                elif pe_percentile > pe_threshold["high"]:
                    pe_score = pe_threshold["score_high"]
                    detail["valuation_level"] = "high"
                else:
                    pe_score = pe_threshold["score_mid"]
                    detail["valuation_level"] = "mid"

                # PB维度
                pb_percentile = 100 - pe_percentile  # 简化处理
                detail["pb_percentile"] = pb_percentile

                if pb_percentile < pb_threshold["low"]:
                    pb_score = pb_threshold["score_low"]
                elif pb_percentile > pb_threshold["high"]:
                    pb_score = pb_threshold["score_high"]
                else:
                    pb_score = pb_threshold["score_mid"]

        except Exception as e:
            print(f"计算估值得分失败: {e}")

        # 综合得分（PE 60%，PB 40%）
        score = pe_score * 0.6 + pb_score * 0.4
        return score, detail

    def calculate_supply_barrier_score(
        self,
        industry_name: str,
        llm_analysis: Dict = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算供给壁垒得分

        Args:
            industry_name: 行业名称
            llm_analysis: LLM分析结果

        Returns:
            得分和详细信息
        """
        detail = {
            "barrier_type": None,
            "barrier_strength": "medium",
            "analysis_source": "rule_based",
        }

        # 基于行业特性的规则评分
        high_barrier_industries = [
            "半导体", "集成电路", "软件开发", "生物制品", "医疗器械",
            "航天装备", "航空装备", "白酒", "化妆品"
        ]
        medium_barrier_industries = [
            "化学制药", "中药", "汽车零部件", "光伏设备", "风电设备",
            "电池", "通信设备", "电子制造"
        ]
        low_barrier_industries = [
            "零售", "超市", "餐饮", "服装", "造纸", "包装印刷"
        ]

        score = 5.0

        # 判断壁垒类型
        for high_ind in high_barrier_industries:
            if high_ind in industry_name:
                score = 8.0
                detail["barrier_type"] = "technology_brand"
                detail["barrier_strength"] = "high"
                break

        if detail["barrier_type"] is None:
            for med_ind in medium_barrier_industries:
                if med_ind in industry_name:
                    score = 6.0
                    detail["barrier_type"] = "capital_technology"
                    detail["barrier_strength"] = "medium"
                    break

        if detail["barrier_type"] is None:
            for low_ind in low_barrier_industries:
                if low_ind in industry_name:
                    score = 3.0
                    detail["barrier_type"] = "low_entry"
                    detail["barrier_strength"] = "low"
                    break

        # 如果有LLM分析结果，结合使用
        if llm_analysis and "supply_barrier_score" in llm_analysis:
            llm_score = llm_analysis["supply_barrier_score"]
            score = score * 0.4 + llm_score * 0.6
            detail["analysis_source"] = "llm_enhanced"

        return score, detail

    def calculate_risk_exclude_score(
        self,
        industry_name: str,
        risk_data: Dict = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算风险排除得分

        Args:
            industry_name: 行业名称
            risk_data: 风险数据

        Returns:
            得分和详细信息
        """
        detail = {
            "debt_risk": "normal",
            "pledge_risk": "normal",
            "goodwill_risk": "normal",
            "overall_risk": "low",
        }

        score = 8.0  # 默认较高得分

        # 高风险行业
        high_risk_industries = [
            "房地产开发", "多元金融", "教育", "传媒"
        ]
        medium_risk_industries = [
            "钢铁", "煤炭开采", "造纸", "化工"
        ]

        for high_risk in high_risk_industries:
            if high_risk in industry_name:
                score = 4.0
                detail["overall_risk"] = "high"
                break

        if detail["overall_risk"] == "low":
            for med_risk in medium_risk_industries:
                if med_risk in industry_name:
                    score = 6.0
                    detail["overall_risk"] = "medium"
                    break

        # 如果有具体风险数据
        if risk_data:
            if risk_data.get("debt_ratio", 0) > RISK_THRESHOLDS["debt_ratio_high"]:
                score -= 2
                detail["debt_risk"] = "high"
            if risk_data.get("pledge_ratio", 0) > RISK_THRESHOLDS["pledge_ratio_high"]:
                score -= 1.5
                detail["pledge_risk"] = "high"

        score = max(0, min(10, score))
        return score, detail

    def calculate_logic_change_score(
        self,
        industry_name: str,
        llm_analysis: Dict = None,
        policy_events: List[Dict] = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算逻辑质变得分

        Args:
            industry_name: 行业名称
            llm_analysis: LLM分析结果
            policy_events: 政策事件

        Returns:
            得分和详细信息
        """
        detail = {
            "logic_type": "stable",
            "catalyst": None,
            "change_direction": "neutral",
        }

        score = 5.0

        # 判断逻辑变化类型
        growth_logic_industries = [
            "半导体", "人工智能", "光伏设备", "风电设备", "锂电池",
            "新能源汽车", "机器人", "工业自动化"
        ]
        value_logic_industries = [
            "银行", "保险", "电力", "高速公路", "港口"
        ]
        cycle_logic_industries = [
            "煤炭开采", "钢铁", "有色金属", "化工", "航运"
        ]

        # 检查是否有政策催化
        if policy_events:
            recent_policies = [p for p in policy_events if
                               (datetime.now() - datetime.fromisoformat(p.get("date", "2000-01-01"))).days < 30]
            if len(recent_policies) > 0:
                score += min(len(recent_policies), 3)  # 每个政策加1分，最多3分
                detail["catalyst"] = "policy"
                detail["change_direction"] = "positive"

        # 行业特性
        for growth_ind in growth_logic_industries:
            if growth_ind in industry_name:
                detail["logic_type"] = "growth"
                score += 1.5
                break

        if detail["logic_type"] == "stable":
            for value_ind in value_logic_industries:
                if value_ind in industry_name:
                    detail["logic_type"] = "value"
                    break

        # 如果有LLM分析
        if llm_analysis and "logic_change_score" in llm_analysis:
            llm_score = llm_analysis["logic_change_score"]
            score = score * 0.4 + llm_score * 0.6

        score = max(0, min(10, score))
        return score, detail

    def calculate_momentum_score(
        self,
        industry_name: str,
        daily_data: pd.DataFrame = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算动量因子得分

        Args:
            industry_name: 行业名称
            daily_data: 日线数据

        Returns:
            得分和详细信息
        """
        detail = {
            "short_momentum": None,
            "mid_momentum": None,
            "long_momentum": None,
            "trend": "neutral",
        }

        score = 5.0

        try:
            if daily_data is not None and len(daily_data) > 20:
                close = daily_data['close'].values

                # 短期动量（5日）
                if len(close) >= 5:
                    short_return = (close[-1] - close[-5]) / close[-5] * 100
                    detail["short_momentum"] = short_return
                    short_score = linear_score(short_return, -5, 5)

                # 中期动量（20日）
                if len(close) >= 20:
                    mid_return = (close[-1] - close[-20]) / close[-20] * 100
                    detail["mid_momentum"] = mid_return
                    mid_score = linear_score(mid_return, -10, 10)

                # 长期动量（60日）
                if len(close) >= 60:
                    long_return = (close[-1] - close[-60]) / close[-60] * 100
                    detail["long_momentum"] = long_return
                    long_score = linear_score(long_return, -20, 20)

                # 加权综合
                score = (
                    short_score * MOMENTUM_CONFIG["short_weight"] +
                    mid_score * MOMENTUM_CONFIG["mid_weight"] +
                    long_score * MOMENTUM_CONFIG["long_weight"]
                )

                # 判断趋势
                if score > 6:
                    detail["trend"] = "up"
                elif score < 4:
                    detail["trend"] = "down"

        except Exception as e:
            print(f"计算动量得分失败: {e}")

        score = max(0, min(10, score))
        return score, detail

    def calculate_north_money_score(
        self,
        industry_name: str,
        north_data: Dict = None
    ) -> Tuple[float, Dict[str, Any]]:
        """
        计算北向资金得分

        Args:
            industry_name: 行业名称
            north_data: 北向资金数据

        Returns:
            得分和详细信息
        """
        detail = {
            "holding_change": None,
            "flow_direction": "neutral",
        }

        score = 5.0

        try:
            if north_data:
                holding_value = north_data.get("holding_value", 0)
                stock_count = north_data.get("stock_count", 0)

                # 根据持仓市值评分
                if holding_value > 100:  # 100亿以上
                    score = 8.0
                    detail["flow_direction"] = "strong_inflow"
                elif holding_value > 50:
                    score = 7.0
                    detail["flow_direction"] = "inflow"
                elif holding_value > 10:
                    score = 6.0
                    detail["flow_direction"] = "slight_inflow"
                elif holding_value < -10:
                    score = 3.0
                    detail["flow_direction"] = "outflow"

        except Exception as e:
            print(f"计算北向资金得分失败: {e}")

        score = max(0, min(10, score))
        return score, detail

    def calculate_total_score(
        self,
        industry_name: str,
        daily_data: pd.DataFrame = None,
        financial_data: Dict = None,
        llm_analysis: Dict = None,
        policy_events: List[Dict] = None,
        risk_data: Dict = None,
        north_data: Dict = None
    ) -> Dict[str, Any]:
        """
        计算行业综合得分

        Args:
            industry_name: 行业名称
            daily_data: 日线数据
            financial_data: 财务数据
            llm_analysis: LLM分析结果
            policy_events: 政策事件
            risk_data: 风险数据
            north_data: 北向资金数据

        Returns:
            综合评分结果
        """
        # 获取行业类型和权重
        industry_type = get_industry_type(industry_name)
        weights = get_scoring_weights(industry_type)

        # 计算各维度得分
        earnings_score, earnings_detail = self.calculate_earnings_turn_score(
            industry_name, daily_data, financial_data
        )
        valuation_score, valuation_detail = self.calculate_valuation_score(
            industry_name, None, None, daily_data
        )
        supply_score, supply_detail = self.calculate_supply_barrier_score(
            industry_name, llm_analysis
        )
        risk_score, risk_detail = self.calculate_risk_exclude_score(
            industry_name, risk_data
        )
        logic_score, logic_detail = self.calculate_logic_change_score(
            industry_name, llm_analysis, policy_events
        )
        momentum_score, momentum_detail = self.calculate_momentum_score(
            industry_name, daily_data
        )
        north_score, north_detail = self.calculate_north_money_score(
            industry_name, north_data
        )

        # 各维度得分
        dimension_scores = {
            "earnings_turn": earnings_score,
            "valuation": valuation_score,
            "supply_barrier": supply_score,
            "risk_exclude": risk_score,
            "logic_change": logic_score,
            "momentum": momentum_score,
            "north_money": north_score,
        }

        # 加权总分
        total_score = sum(
            dimension_scores[key] * weights[key]
            for key in dimension_scores
        )

        # 转换为100分制
        total_score_100 = total_score * 10

        return {
            "industry": industry_name,
            "industry_type": industry_type,
            "total_score": round(total_score_100, 1),
            "total_score_10": round(total_score, 2),
            "dimension_scores": {k: round(v, 2) for k, v in dimension_scores.items()},
            "weights": weights,
            "details": {
                "earnings_turn": earnings_detail,
                "valuation": valuation_detail,
                "supply_barrier": supply_detail,
                "risk_exclude": risk_detail,
                "logic_change": logic_detail,
                "momentum": momentum_detail,
                "north_money": north_detail,
            },
            "week_date": get_week_date(),
            "timestamp": datetime.now().isoformat(),
        }

    def score_industry(self, industry_code: str, industry_name: str) -> Dict[str, Any]:
        """
        评分单个行业

        Args:
            industry_code: 行业代码
            industry_name: 行业名称

        Returns:
            评分结果
        """
        # 获取数据
        daily_data = self.data_fetcher.get_industry_daily_data(industry_code)
        north_data = self.data_fetcher.get_industry_north_holding(industry_name)
        capital_flow = self.data_fetcher.get_industry_capital_flow(industry_name)

        # 合并资金数据
        north_data["capital_flow"] = capital_flow

        # 计算评分
        result = self.calculate_total_score(
            industry_name=industry_name,
            daily_data=daily_data,
            north_data=north_data
        )

        result["industry_code"] = industry_code
        return result

    def score_all_industries(
        self,
        industry_list: List[Dict[str, str]] = None,
        top_n: int = 30
    ) -> List[Dict[str, Any]]:
        """
        评分所有行业

        Args:
            industry_list: 行业列表，默认获取全部
            top_n: 返回前N个行业

        Returns:
            排序后的评分列表
        """
        if industry_list is None:
            industry_list = self.data_fetcher.get_industry_list()

        results = []

        for industry in industry_list[:50]:  # 限制数量
            try:
                score_result = self.score_industry(
                    industry["code"],
                    industry["name"]
                )
                results.append(score_result)
            except Exception as e:
                print(f"评分行业 {industry['name']} 失败: {e}")

        # 按总分排序
        results.sort(key=lambda x: x["total_score"], reverse=True)

        return results[:top_n]
