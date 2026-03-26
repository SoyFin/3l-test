# -*- coding: utf-8 -*-
"""
戴维斯双击行业评分系统 - LLM处理模块

使用LLM进行行业定性分析
"""

import json
import os
from typing import Any, Dict, List, Optional
from datetime import datetime

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from .config import get_api_config


class LLMProcessor:
    """LLM处理器，用于行业定性分析"""

    def __init__(self, api_config: Dict[str, str] = None):
        """
        初始化LLM处理器

        Args:
            api_config: API配置，默认从环境变量读取
        """
        if api_config is None:
            api_config = get_api_config()

        self.api_key = api_config.get("doubao_api_key", "")
        self.model_id = api_config.get("doubao_model_id", "")
        self.base_url = api_config.get("doubao_base_url", "https://ark.cn-beijing.volces.com/api/v3")

        self.client = None
        if self.api_key and OpenAI:
            try:
                self.client = OpenAI(
                    api_key=self.api_key,
                    base_url=self.base_url
                )
            except Exception as e:
                print(f"初始化LLM客户端失败: {e}")

    def is_available(self) -> bool:
        """检查LLM是否可用"""
        return self.client is not None and self.api_key != ""

    def analyze_supply_barrier(
        self,
        industry_name: str,
        context: str = ""
    ) -> Dict[str, Any]:
        """
        分析行业供给壁垒

        Args:
            industry_name: 行业名称
            context: 额外上下文信息

        Returns:
            分析结果
        """
        if not self.is_available():
            return self._get_default_barrier_result()

        prompt = f"""请分析以下行业的供给壁垒情况：

行业：{industry_name}

{context}

请从以下维度分析供给壁垒：
1. 技术壁垒：是否需要核心技术、专利保护
2. 资金壁垒：进入该行业需要的资金门槛
3. 牌照壁垒：是否需要特殊许可证或资质
4. 品牌壁垒：消费者品牌忠诚度如何
5. 渠道壁垒：销售渠道是否难以建立

请返回JSON格式：
{{
    "barrier_level": "high/medium/low",
    "barrier_score": 0-10的评分,
    "main_barriers": ["主要壁垒1", "主要壁垒2"],
    "analysis": "简要分析"
}}
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "你是一个专业的行业分析师，擅长分析行业竞争格局和进入壁垒。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )

            content = response.choices[0].message.content
            # 尝试解析JSON
            result = self._parse_llm_response(content)
            result["source"] = "llm"
            return result

        except Exception as e:
            print(f"LLM分析供给壁垒失败: {e}")
            return self._get_default_barrier_result()

    def analyze_logic_change(
        self,
        industry_name: str,
        recent_news: List[str] = None,
        context: str = ""
    ) -> Dict[str, Any]:
        """
        分析行业逻辑质变

        Args:
            industry_name: 行业名称
            recent_news: 最近新闻列表
            context: 额外上下文

        Returns:
            分析结果
        """
        if not self.is_available():
            return self._get_default_logic_result()

        news_context = ""
        if recent_news:
            news_context = "\n".join([f"- {news}" for news in recent_news[:5]])

        prompt = f"""请分析以下行业是否正在发生逻辑质变：

行业：{industry_name}

近期动态：
{news_context}

{context}

请分析：
1. 行业商业模式是否在发生变化
2. 技术路线是否在迭代
3. 政策环境是否在改变
4. 竞争格局是否在重塑
5. 需求结构是否在演变

请返回JSON格式：
{{
    "logic_change_type": "major_change/minor_change/stable",
    "logic_change_score": 0-10的评分（10表示重大质变）,
    "change_direction": "positive/negative/neutral",
    "key_changes": ["关键变化1", "关键变化2"],
    "investment_implication": "对投资的影响分析"
}}
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "你是一个资深的投资分析师，擅长识别行业投资逻辑的变化。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=500
            )

            content = response.choices[0].message.content
            result = self._parse_llm_response(content)
            result["source"] = "llm"
            return result

        except Exception as e:
            print(f"LLM分析逻辑质变失败: {e}")
            return self._get_default_logic_result()

    def generate_industry_report(
        self,
        industry_name: str,
        score_data: Dict[str, Any]
    ) -> str:
        """
        生成行业分析报告

        Args:
            industry_name: 行业名称
            score_data: 评分数据

        Returns:
            分析报告文本
        """
        if not self.is_available():
            return self._generate_default_report(industry_name, score_data)

        prompt = f"""请根据以下评分数据生成一份简要的行业投资分析报告：

行业：{industry_name}

评分数据：
{json.dumps(score_data, ensure_ascii=False, indent=2)}

请生成包含以下内容的分析报告：
1. 行业概述（一句话）
2. 核心投资逻辑（2-3点）
3. 主要风险提示（1-2点）
4. 投资建议（一句话）

报告要简洁、专业，字数控制在200字以内。
"""
        try:
            response = self.client.chat.completions.create(
                model=self.model_id,
                messages=[
                    {"role": "system", "content": "你是一个专业的投资分析师，擅长撰写简洁的投资分析报告。"},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.5,
                max_tokens=300
            )

            return response.choices[0].message.content

        except Exception as e:
            print(f"LLM生成报告失败: {e}")
            return self._generate_default_report(industry_name, score_data)

    def _parse_llm_response(self, content: str) -> Dict[str, Any]:
        """解析LLM响应"""
        try:
            # 尝试直接解析JSON
            return json.loads(content)
        except:
            pass

        # 尝试提取JSON块
        import re
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            try:
                return json.loads(json_match.group())
            except:
                pass

        return {"raw_content": content}

    def _get_default_barrier_result(self) -> Dict[str, Any]:
        """获取默认壁垒分析结果"""
        return {
            "barrier_level": "medium",
            "barrier_score": 5.0,
            "main_barriers": [],
            "analysis": "无法获取LLM分析",
            "source": "default"
        }

    def _get_default_logic_result(self) -> Dict[str, Any]:
        """获取默认逻辑分析结果"""
        return {
            "logic_change_type": "stable",
            "logic_change_score": 5.0,
            "change_direction": "neutral",
            "key_changes": [],
            "investment_implication": "无法获取LLM分析",
            "source": "default"
        }

    def _generate_default_report(
        self,
        industry_name: str,
        score_data: Dict[str, Any]
    ) -> str:
        """生成默认报告"""
        total_score = score_data.get("total_score", 50)
        dimension_scores = score_data.get("dimension_scores", {})

        dimension_names = {
            "earnings_turn": "业绩拐点",
            "valuation": "估值评分",
            "supply_barrier": "供给壁垒",
            "risk_exclude": "风险排除",
            "logic_change": "逻辑质变",
            "momentum": "动量因子",
            "north_money": "北向资金",
        }

        # 找出最强和最弱维度
        if dimension_scores:
            strongest = max(dimension_scores.items(), key=lambda x: x[1])
            weakest = min(dimension_scores.items(), key=lambda x: x[1])
            strongest_name = dimension_names.get(strongest[0], strongest[0])
            weakest_name = dimension_names.get(weakest[0], weakest[0])
        else:
            strongest_name = "未知"
            weakest_name = "未知"

        rating = "推荐" if total_score >= 70 else "关注" if total_score >= 50 else "观望"

        return f"""{industry_name}行业综合得分{total_score:.1f}分，{rating}。

优势：{strongest_name}表现较好；关注：{weakest_name}有待改善。

本报告基于量化评分，仅供参考。"""


def create_llm_processor() -> LLMProcessor:
    """创建LLM处理器实例"""
    return LLMProcessor()
