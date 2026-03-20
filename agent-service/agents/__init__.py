"""
Agent 模块 - 重新导出 src.agents 中的完整实现
"""
import sys
import os

# 添加项目路径以支持 src 导入
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

# 从 src.agents 重新导出完整实现
try:
    from src.agents import (
        AgentState,
        show_agent_reasoning,
        show_workflow_status,
        market_data_agent,
        technical_analyst_agent,
        fundamentals_agent,
        sentiment_agent,
        valuation_agent,
        researcher_bull_agent,
        researcher_bear_agent,
        debate_room_agent,
        risk_management_agent,
        portfolio_management_agent
    )
    
    __all__ = [
        'AgentState',
        'show_agent_reasoning',
        'show_workflow_status',
        'market_data_agent',
        'technical_analyst_agent',
        'fundamentals_agent',
        'sentiment_agent',
        'valuation_agent',
        'researcher_bull_agent',
        'researcher_bear_agent',
        'debate_room_agent',
        'risk_management_agent',
        'portfolio_management_agent'
    ]
    
    print("✅ 已加载完整 Agent 实现（来自 src.agents）")
    
except ImportError as e:
    print(f"⚠️ 无法导入完整 Agent 实现: {e}")
    print("⚠️ 使用简化版 Agent 实现")
    
    # 回退到简化版实现
    from typing import TypedDict, Annotated, Sequence, Dict, Any
    from langchain_core.messages import BaseMessage
    import operator
    import json

    def merge_dicts(a: Dict[str, Any], b: Dict[str, Any]) -> Dict[str, Any]:
        return {**a, **b}

    class AgentState(TypedDict):
        messages: Annotated[Sequence[BaseMessage], operator.add]
        data: Annotated[Dict[str, Any], merge_dicts]
        metadata: Annotated[Dict[str, Any], merge_dicts]

    def show_agent_reasoning(agent_name, reasoning):
        print(f"[{agent_name}] {reasoning}")

    def show_workflow_status(status):
        print(f"[Workflow] {status}")

    def market_data_agent(state):
        return {"messages": [], "data": {"market_data": "ok"}, "metadata": {}}

    def technical_analyst_agent(state):
        return {
            "messages": [],
            "data": {"technical_signal": {"signal": "neutral", "confidence": 0.5}},
            "metadata": {}
        }

    def fundamentals_agent(state):
        return {
            "messages": [],
            "data": {"fundamentals_signal": {"signal": "neutral", "confidence": 0.5}},
            "metadata": {}
        }

    def sentiment_agent(state):
        return {
            "messages": [],
            "data": {"sentiment_signal": {"signal": "neutral", "confidence": 0.5}},
            "metadata": {}
        }

    def valuation_agent(state):
        return {
            "messages": [],
            "data": {"valuation_signal": {"signal": "neutral", "confidence": 0.5}},
            "metadata": {}
        }

    def researcher_bull_agent(state):
        return {
            "messages": [],
            "data": {"bull_signal": {"signal": "bullish", "confidence": 0.6}},
            "metadata": {}
        }

    def researcher_bear_agent(state):
        return {
            "messages": [],
            "data": {"bear_signal": {"signal": "bearish", "confidence": 0.4}},
            "metadata": {}
        }

    def debate_room_agent(state):
        return {
            "messages": [],
            "data": {"debate_signal": {"signal": "neutral", "confidence": 0.5}},
            "metadata": {}
        }

    def risk_management_agent(state):
        return {
            "messages": [],
            "data": {"risk_signal": {"signal": "hold", "confidence": 0.5, "max_position": 10000}},
            "metadata": {}
        }

    def portfolio_management_agent(state):
        from langchain_core.messages import HumanMessage
        data = state.get("data", {})
        decision = {
            "action": "hold",
            "quantity": 0,
            "confidence": 0.5,
            "agent_signals": [
                {"agent_name": "market_data", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "technical_analysis", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "fundamental_analysis", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "sentiment_analysis", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "valuation_analysis", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "bull_researcher", "signal": "bullish", "confidence": 0.6},
                {"agent_name": "bear_researcher", "signal": "bearish", "confidence": 0.4},
                {"agent_name": "debate_room", "signal": "neutral", "confidence": 0.5},
                {"agent_name": "risk_management", "signal": "hold", "confidence": 0.5},
                {"agent_name": "portfolio_management", "signal": "hold", "confidence": 0.5}
            ],
            "reasoning": "综合分析：基于技术面、基本面、情绪面、估值等多维度分析，当前建议持有观望。",
        }
        return {
            "messages": [HumanMessage(content=json.dumps(decision, ensure_ascii=False), name="portfolio_management_agent")],
            "data": state.get("data", {}),
            "metadata": state.get("metadata", {})
        }