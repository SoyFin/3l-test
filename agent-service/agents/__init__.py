from typing import TypedDict, Annotated, Sequence, Dict, Any
from langchain_core.messages import BaseMessage
import operator

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

# 简化版Agent函数
def market_data_agent(state):
    return {"messages": [], "data": {"market_data": "ok"}, "metadata": {}}

def technical_analyst_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "technical_signal": {"signal": "neutral", "confidence": 0.5}
        },
        "metadata": {}
    }

def fundamentals_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "fundamentals_signal": {"signal": "neutral", "confidence": 0.5}
        },
        "metadata": {}
    }

def sentiment_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "sentiment_signal": {"signal": "neutral", "confidence": 0.5}
        },
        "metadata": {}
    }

def valuation_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "valuation_signal": {"signal": "neutral", "confidence": 0.5}
        },
        "metadata": {}
    }

def researcher_bull_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "bull_signal": {"signal": "bullish", "confidence": 0.6}
        },
        "metadata": {}
    }

def researcher_bear_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "bear_signal": {"signal": "bearish", "confidence": 0.4}
        },
        "metadata": {}
    }

def debate_room_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "debate_signal": {"signal": "neutral", "confidence": 0.5}
        },
        "metadata": {}
    }

def risk_management_agent(state):
    import json
    return {
        "messages": [],
        "data": {
            "risk_signal": {"signal": "hold", "confidence": 0.5, "max_position": 10000}
        },
        "metadata": {}
    }

def portfolio_management_agent(state):
    import json
    from langchain_core.messages import HumanMessage
    
    # 提取所有信号
    data = state.get("data", {})
    
    signals = {
        "technical": data.get("technical_signal", {"signal": "neutral", "confidence": 0.5}),
        "fundamentals": data.get("fundamentals_signal", {"signal": "neutral", "confidence": 0.5}),
        "sentiment": data.get("sentiment_signal", {"signal": "neutral", "confidence": 0.5}),
        "valuation": data.get("valuation_signal", {"signal": "neutral", "confidence": 0.5}),
        "debate": data.get("debate_signal", {"signal": "neutral", "confidence": 0.5}),
        "risk": data.get("risk_signal", {"signal": "hold", "confidence": 0.5})
    }
    
    # 综合决策
    action = "hold"
    confidence = 0.5
    
    decision = {
        "action": action,
        "quantity": 0,
        "confidence": confidence,
        "agent_signals": [
            {"agent_name": "market_data", "signal": "neutral", "confidence": 0.5},
            {"agent_name": "technical_analysis", "signal": signals["technical"]["signal"], "confidence": signals["technical"]["confidence"]},
            {"agent_name": "fundamental_analysis", "signal": signals["fundamentals"]["signal"], "confidence": signals["fundamentals"]["confidence"]},
            {"agent_name": "sentiment_analysis", "signal": signals["sentiment"]["signal"], "confidence": signals["sentiment"]["confidence"]},
            {"agent_name": "valuation_analysis", "signal": signals["valuation"]["signal"], "confidence": signals["valuation"]["confidence"]},
            {"agent_name": "bull_researcher", "signal": "bullish", "confidence": 0.6},
            {"agent_name": "bear_researcher", "signal": "bearish", "confidence": 0.4},
            {"agent_name": "debate_room", "signal": signals["debate"]["signal"], "confidence": signals["debate"]["confidence"]},
            {"agent_name": "risk_management", "signal": signals["risk"]["signal"], "confidence": signals["risk"]["confidence"]},
            {"agent_name": "portfolio_management", "signal": action, "confidence": confidence}
        ],
        "reasoning": "综合分析：基于技术面、基本面、情绪面、估值等多维度分析，当前建议持有观望。",
        "risk_assessment": {
            "level": "中等",
            "stop_loss": 0.08,
            "take_profit": 0.15
        }
    }
    
    return {
        "messages": [HumanMessage(content=json.dumps(decision, ensure_ascii=False), name="portfolio_management_agent")],
        "data": state.get("data", {}),
        "metadata": state.get("metadata", {})
    }
