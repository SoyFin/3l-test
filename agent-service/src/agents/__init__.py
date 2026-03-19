"""
Agent modules for A-Share Investment Analysis
"""

from .state import AgentState, show_agent_reasoning, show_workflow_status
from .market_data import market_data_agent
from .technicals import technical_analyst_agent
from .fundamentals import fundamentals_agent
from .sentiment import sentiment_agent
from .valuation import valuation_agent
from .researcher_bull import researcher_bull_agent
from .researcher_bear import researcher_bear_agent
from .debate_room import debate_room_agent
from .risk_manager import risk_management_agent
from .portfolio_manager import portfolio_management_agent

# 兼容别名
technical_analyst_agent = technical_analyst_agent
fundamentals_agent = fundamentals_agent
sentiment_agent = sentiment_agent
valuation_agent = valuation_agent
researcher_bull_agent = researcher_bull_agent
researcher_bear_agent = researcher_bear_agent
debate_room_agent = debate_room_agent
risk_management_agent = risk_management_agent
portfolio_management_agent = portfolio_management_agent

__all__ = [
    'AgentState',
    'show_agent_reasoning',
    'show_workflow_status',
    'market_data_agent',
    'technical_analyst_agent',
    'technicals_agent',
    'fundamentals_agent',
    'sentiment_agent',
    'valuation_agent',
    'researcher_bull_agent',
    'researcher_bear_agent',
    'debate_room_agent',
    'risk_management_agent',
    'portfolio_management_agent'
]
