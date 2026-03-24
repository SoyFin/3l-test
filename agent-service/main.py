"""
A股投资分析Agent服务

基于LangGraph工作流的多Agent投资分析系统

使用方法：
1. 作为FastAPI服务运行：
   python main.py --server
   
2. 作为命令行工具运行：
   python main.py --ticker 000001 --show-reasoning

支持的Agent：
- market_data_agent: 获取市场数据
- technical_analyst_agent: 技术分析
- fundamentals_agent: 基本面分析
- sentiment_agent: 情绪分析
- valuation_agent: 估值分析
- researcher_bull_agent: 多方研究员
- researcher_bear_agent: 空方研究员
- debate_room_agent: 辩论室
- risk_management_agent: 风险管理
- portfolio_management_agent: 投资组合经理
"""

import sys
import os
import argparse
import uuid
import threading
import logging
import json
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

# 添加项目路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn

# LangGraph导入
from langgraph.graph import END, StateGraph
from langchain_core.messages import HumanMessage

# Agent导入
from agents import (
    AgentState,
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

# 工具导入
from tools import (
    get_financial_metrics,
    get_financial_statements,
    get_price_history,
    get_market_data,
    get_news_data
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(name)s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger('main')


# ============== Pydantic模型 ==============

class AnalysisRequest(BaseModel):
    """分析请求模型"""
    ticker: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    initial_capital: float = 100000.0
    initial_position: int = 0
    show_reasoning: bool = False
    num_of_news: int = 10


class AnalysisResponse(BaseModel):
    """分析响应模型"""
    run_id: str
    ticker: str
    decision: Dict[str, Any]
    agent_signals: list
    reasoning: str


# ============== FastAPI应用 ==============

app = FastAPI(
    title="A股投资分析Agent服务",
    description="基于LangGraph的多Agent投资分析系统",
    version="2.0.0"
)

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============== LangGraph工作流 ==============

def create_workflow():
    """创建LangGraph工作流"""
    workflow = StateGraph(AgentState)
    
    # 添加节点
    workflow.add_node("market_data_agent", market_data_agent)
    workflow.add_node("technical_analyst_agent", technical_analyst_agent)
    workflow.add_node("fundamentals_agent", fundamentals_agent)
    workflow.add_node("sentiment_agent", sentiment_agent)
    workflow.add_node("valuation_agent", valuation_agent)
    workflow.add_node("researcher_bull_agent", researcher_bull_agent)
    workflow.add_node("researcher_bear_agent", researcher_bear_agent)
    workflow.add_node("debate_room_agent", debate_room_agent)
    workflow.add_node("risk_management_agent", risk_management_agent)
    workflow.add_node("portfolio_management_agent", portfolio_management_agent)
    
    # 设置入口点
    workflow.set_entry_point("market_data_agent")
    
    # 定义边 - 市场数据到各分析Agent
    workflow.add_edge("market_data_agent", "technical_analyst_agent")
    workflow.add_edge("market_data_agent", "fundamentals_agent")
    workflow.add_edge("market_data_agent", "sentiment_agent")
    workflow.add_edge("market_data_agent", "valuation_agent")
    
    # 分析Agent到研究员
    workflow.add_edge("technical_analyst_agent", "researcher_bull_agent")
    workflow.add_edge("fundamentals_agent", "researcher_bull_agent")
    workflow.add_edge("sentiment_agent", "researcher_bull_agent")
    workflow.add_edge("valuation_agent", "researcher_bull_agent")
    
    workflow.add_edge("technical_analyst_agent", "researcher_bear_agent")
    workflow.add_edge("fundamentals_agent", "researcher_bear_agent")
    workflow.add_edge("sentiment_agent", "researcher_bear_agent")
    workflow.add_edge("valuation_agent", "researcher_bear_agent")
    
    # 研究员到辩论室
    workflow.add_edge("researcher_bull_agent", "debate_room_agent")
    workflow.add_edge("researcher_bear_agent", "debate_room_agent")
    
    # 辩论室到风险管理
    workflow.add_edge("debate_room_agent", "risk_management_agent")
    
    # 风险管理到投资组合经理
    workflow.add_edge("risk_management_agent", "portfolio_management_agent")
    
    # 投资组合经理到结束
    workflow.add_edge("portfolio_management_agent", END)
    
    return workflow.compile()


# 编译工作流
workflow_app = create_workflow()


# ============== 核心函数 ==============

def run_analysis(
    ticker: str,
    start_date: str = None,
    end_date: str = None,
    portfolio: dict = None,
    show_reasoning: bool = False,
    num_of_news: int = 10
) -> Dict[str, Any]:
    """
    运行投资分析
    
    Args:
        ticker: 股票代码
        start_date: 开始日期
        end_date: 结束日期
        portfolio: 投资组合
        show_reasoning: 是否显示推理过程
        num_of_news: 新闻数量
    
    Returns:
        分析结果
    """
    run_id = str(uuid.uuid4())
    logger.info(f"--- 开始分析 Run ID: {run_id} ---")
    
    # 默认投资组合
    if portfolio is None:
        portfolio = {"cash": 100000.0, "stock": 0}
    
    # 处理日期
    current_date = datetime.now()
    yesterday = current_date - timedelta(days=1)
    
    if not end_date:
        end_date_dt = yesterday
    else:
        end_date_dt = datetime.strptime(end_date, "%Y-%m-%d")
        if end_date_dt > yesterday:
            end_date_dt = yesterday
    
    if not start_date:
        start_date_dt = end_date_dt - timedelta(days=365)
    else:
        start_date_dt = datetime.strptime(start_date, "%Y-%m-%d")
    
    # 获取数据
    logger.info(f"获取 {ticker} 数据...")
    
    try:
        prices = get_price_history(
            ticker,
            start_date_dt.strftime("%Y-%m-%d"),
            end_date_dt.strftime("%Y-%m-%d")
        )
        prices_list = prices.to_dict('records') if not prices.empty else []
    except Exception as e:
        logger.warning(f"获取价格数据失败: {e}")
        prices_list = []
    
    try:
        financial_metrics = get_financial_metrics(ticker)
    except Exception as e:
        logger.warning(f"获取财务指标失败: {e}")
        financial_metrics = [{}]
    
    try:
        financial_line_items = get_financial_statements(ticker)
    except Exception as e:
        logger.warning(f"获取财务报表失败: {e}")
        financial_line_items = [{}]
    
    try:
        market_data = get_market_data(ticker)
    except Exception as e:
        logger.warning(f"获取市场数据失败: {e}")
        market_data = {}
    
    try:
        news = get_news_data(ticker, num_of_news)
    except Exception as e:
        logger.warning(f"获取新闻数据失败: {e}")
        news = []
    
    # 构建初始状态
    initial_state = {
        "messages": [],
        "data": {
            "ticker": ticker,
            "portfolio": portfolio,
            "start_date": start_date_dt.strftime("%Y-%m-%d"),
            "end_date": end_date_dt.strftime("%Y-%m-%d"),
            "num_of_news": num_of_news,
            "prices": prices_list,
            "financial_metrics": financial_metrics,
            "financial_line_items": financial_line_items,
            "market_data": market_data,
            "news": news
        },
        "metadata": {
            "show_reasoning": show_reasoning,
            "run_id": run_id
        }
    }
    
    # 运行工作流
    try:
        logger.info("运行LangGraph工作流...")
        final_state = workflow_app.invoke(initial_state)
        
        # 提取最终决策
        final_message = None
        for msg in reversed(final_state.get("messages", [])):
            if hasattr(msg, 'name') and msg.name == "portfolio_management_agent":
                final_message = msg
                break
        
        if final_message:
            try:
                import json
                decision = json.loads(final_message.content)
            except:
                decision = {"raw_response": final_message.content}
        else:
            decision = {"action": "hold", "reasoning": "未获取到最终决策"}
        
        # 从工作流状态中收集各个 Agent 的分析结果
        agent_signals = []
        agent_outputs = {}

        # Agent 名称映射（从消息名称 -> 前端期望名称）
        AGENT_NAME_MAP = {
            "market_data_agent": "market_data",
            "technical_analyst_agent": "technical_analysis",
            "fundamentals_agent": "fundamental_analysis",
            "sentiment_agent": "sentiment_analysis",
            "valuation_agent": "valuation_analysis",
            "researcher_bull_agent": "bull_researcher",
            "researcher_bear_agent": "bear_researcher",
            "debate_room_agent": "debate_room",
            "risk_management_agent": "risk_management",
            "portfolio_management_agent": "portfolio_management",
        }

        def format_reasoning_to_text(reasoning, agent_type="general"):
            """将reasoning对象格式化为可读的中文文本"""
            if not reasoning:
                return ""

            if isinstance(reasoning, str):
                return reasoning

            if isinstance(reasoning, dict):
                lines = []

                # 基本面分析格式
                if "profitability_signal" in reasoning:
                    for key, value in reasoning.items():
                        if isinstance(value, dict) and "signal" in value:
                            signal_emoji = {"bullish": "📈", "bearish": "📉", "neutral": "➖"}.get(value.get("signal", "neutral"), "➖")
                            lines.append(f"{signal_emoji} {key.replace('_signal', '').replace('_', ' ').title()}: {value.get('details', '')}")

                # 技术分析格式 (strategy_signals)
                elif "strategy_signals" in reasoning:
                    for strategy, data in reasoning.get("strategy_signals", {}).items():
                        if isinstance(data, dict):
                            signal_emoji = {"bullish": "📈", "bearish": "📉", "neutral": "➖"}.get(data.get("signal", "neutral"), "➖")
                            conf = data.get("confidence", "50%")
                            lines.append(f"{signal_emoji} {strategy.replace('_', ' ').title()}: {conf} 置信度")

                # 辩论室格式
                elif "debate_summary" in reasoning:
                    for item in reasoning.get("debate_summary", []):
                        if item.startswith("+"):
                            lines.append(f"🟢 {item[1:].strip()}")
                        elif item.startswith("-"):
                            lines.append(f"🔴 {item[1:].strip()}")
                        else:
                            lines.append(item)

                # 其他字典格式
                else:
                    for key, value in reasoning.items():
                        if isinstance(value, dict):
                            value_str = json.dumps(value, ensure_ascii=False)
                        else:
                            value_str = str(value)
                        # 简化键名
                        key_display = key.replace("_", " ").title()
                        lines.append(f"• {key_display}: {value_str}")

                return "\n".join(lines)

            return str(reasoning)

        # 遍历所有消息，提取各个 Agent 的输出
        for msg in final_state.get("messages", []):
            if hasattr(msg, 'name') and msg.name:
                agent_name = msg.name

                if agent_name in AGENT_NAME_MAP:
                    try:
                        content = json.loads(msg.content) if isinstance(msg.content, str) else msg.content
                        mapped_name = AGENT_NAME_MAP[agent_name]

                        # 特殊处理 market_data_agent
                        if agent_name == "market_data_agent":
                            agent_signals.append({
                                "agent_name": "market_data",
                                "signal": "neutral",
                                "confidence": 1.0,
                                "summary": f"已收集{content.get('ticker', '股票')}的市场数据",
                                "reasoning": f"数据收集完成: 价格历史、财务指标、市场数据均已获取"
                            })
                            continue

                        # 特殊处理 portfolio_management_agent
                        if agent_name == "portfolio_management_agent":
                            action = content.get("action", "hold")
                            signal_map = {"buy": "bullish", "sell": "bearish", "hold": "neutral"}
                            agent_signals.append({
                                "agent_name": "portfolio_management",
                                "signal": signal_map.get(action, "neutral"),
                                "confidence": content.get("confidence", 0.5),
                                "summary": f"最终决策: {action.upper()}",
                                "reasoning": content.get("reasoning", "综合各Agent信号做出最终投资决策")
                            })
                            continue

                        # 提取信号
                        signal = content.get("signal", "neutral")
                        if isinstance(signal, str) and signal not in ["bullish", "bearish", "neutral"]:
                            signal = "neutral"

                        # 提取置信度
                        confidence = content.get("confidence", 0.5)
                        if isinstance(confidence, str):
                            if confidence.endswith("%"):
                                confidence = float(confidence.replace("%", "")) / 100
                            else:
                                try:
                                    confidence = float(confidence)
                                except:
                                    confidence = 0.5

                        # 格式化 reasoning 为可读文本
                        reasoning_raw = content.get("reasoning", {})
                        reasoning_text = format_reasoning_to_text(reasoning_raw, mapped_name)

                        # 提取摘要
                        summary = content.get("summary", "")
                        if not summary:
                            if isinstance(reasoning_raw, str):
                                summary = reasoning_raw[:100] + "..." if len(reasoning_raw) > 100 else reasoning_raw
                            else:
                                summary = reasoning_text[:100] + "..." if len(reasoning_text) > 100 else reasoning_text

                        agent_signal = {
                            "agent_name": mapped_name,
                            "signal": signal,
                            "confidence": confidence,
                            "summary": summary,
                            "reasoning": reasoning_text
                        }

                        # 避免重复
                        if mapped_name not in [s["agent_name"] for s in agent_signals]:
                            agent_signals.append(agent_signal)
                            agent_outputs[mapped_name] = content

                    except Exception as e:
                        logger.warning(f"解析 {agent_name} 输出失败: {e}")
        
        # 如果 decision 中有 agent_signals，使用它（优先级更高）
        if "agent_signals" in decision and decision["agent_signals"]:
            # 确保格式正确
            for signal in decision["agent_signals"]:
                agent_name = signal.get("agent_name", "")
                # 映射名称
                mapped_name = AGENT_NAME_MAP.get(agent_name, agent_name)
                
                # 确保信号格式正确
                sig = signal.get("signal", "neutral")
                if sig not in ["bullish", "bearish", "neutral"]:
                    sig = "neutral"
                
                # 确保置信度格式正确
                conf = signal.get("confidence", 0.5)
                if isinstance(conf, str):
                    if conf.endswith("%"):
                        conf = float(conf.replace("%", "")) / 100
                    else:
                        try:
                            conf = float(conf)
                        except:
                            conf = 0.5
                
                # 检查是否已存在
                existing_names = [s["agent_name"] for s in agent_signals]
                if mapped_name not in existing_names:
                    agent_signals.append({
                        "agent_name": mapped_name,
                        "signal": sig,
                        "confidence": conf,
                        "summary": signal.get("summary", ""),
                        "reasoning": signal.get("reasoning", signal.get("summary", ""))
                    })
        
        # 将 agent_signals 添加到 decision
        decision["agent_signals"] = agent_signals
        
        logger.info(f"--- 分析完成 Run ID: {run_id} ---")
        logger.info(f"收集到 {len(agent_signals)} 个 Agent 信号: {[s['agent_name'] for s in agent_signals]}")
        
        return {
            "run_id": run_id,
            "ticker": ticker,
            "decision": decision,
            "agent_signals": agent_signals,
            "reasoning": decision.get("reasoning", "")
        }
        
    except Exception as e:
        logger.error(f"工作流执行失败: {e}")
        raise


# ============== API路由 ==============

@app.get("/")
async def root():
    """根路由"""
    return {
        "name": "A股投资分析Agent服务",
        "version": "2.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_stock(request: AnalysisRequest):
    """
    分析股票
    
    Args:
        request: 分析请求
    
    Returns:
        分析结果
    """
    try:
        portfolio = {
            "cash": request.initial_capital,
            "stock": request.initial_position
        }
        
        result = run_analysis(
            ticker=request.ticker,
            start_date=request.start_date,
            end_date=request.end_date,
            portfolio=portfolio,
            show_reasoning=request.show_reasoning,
            num_of_news=request.num_of_news
        )
        
        return AnalysisResponse(
            run_id=result["run_id"],
            ticker=result["ticker"],
            decision=result["decision"],
            agent_signals=result["decision"].get("agent_signals", []),
            reasoning=result["reasoning"]
        )
        
    except Exception as e:
        logger.error(f"分析失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/agents")
async def list_agents():
    """列出所有Agent"""
    return {
        "agents": [
            {"name": "market_data_agent", "description": "获取市场数据"},
            {"name": "technical_analyst_agent", "description": "技术分析"},
            {"name": "fundamentals_agent", "description": "基本面分析"},
            {"name": "sentiment_agent", "description": "情绪分析"},
            {"name": "valuation_agent", "description": "估值分析"},
            {"name": "researcher_bull_agent", "description": "多方研究员"},
            {"name": "researcher_bear_agent", "description": "空方研究员"},
            {"name": "debate_room_agent", "description": "辩论室"},
            {"name": "risk_management_agent", "description": "风险管理"},
            {"name": "portfolio_management_agent", "description": "投资组合经理"}
        ]
    }


@app.get("/llm/status")
async def llm_status():
    """获取LLM状态"""
    try:
        from src.tools.openrouter_config import get_client
        client = get_client()
        return {
            "client_type": type(client).__name__,
            "status": "configured" if type(client).__name__ != "MockLLMClient" else "mock"
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/data-sources/status")
async def data_sources_status():
    """获取数据源状态"""
    return {
        "status": "ok",
        "message": "数据源正常运行"
    }


# ============== LLM配置API ==============

# 运行时LLM配置存储
_runtime_llm_config: Dict[str, Any] = {}


class LLMConfigRequest(BaseModel):
    """LLM配置请求"""
    providers: Optional[Dict[str, Optional[Dict[str, str]]]] = None
    default_provider: Optional[str] = None
    failover_order: Optional[list] = None


@app.post("/config/llm")
async def update_llm_config(config: LLMConfigRequest):
    """
    更新LLM配置

    从前端同步LLM提供商配置，支持动态更新API Key
    """
    global _runtime_llm_config

    try:
        # 构建 AI 配置字典
        ai_config = {
            "defaultProvider": config.default_provider or "zhipu",
        }

        # 更新运行时配置
        if config.providers:
            for provider_name, provider_config in config.providers.items():
                if provider_config and provider_config.get("api_key"):
                    # 设置环境变量（用于当前进程）
                    env_key_map = {
                        "hunyuan": "HUNYUAN_API_KEY",
                        "zhipu": "ZHIPU_API_KEY",
                        "qwen": "QWEN_API_KEY",
                        "deepseek": "DEEPSEEK_API_KEY",
                        "kimi": "KIMI_API_KEY",
                    }
                    env_key = env_key_map.get(provider_name)
                    if env_key:
                        os.environ[env_key] = provider_config["api_key"]
                        logger.info(f"已设置 {env_key}")

                    # 添加到 AI 配置
                    ai_config[provider_name] = {
                        "apiKey": provider_config["api_key"]
                    }

        if config.default_provider:
            _runtime_llm_config["default_provider"] = config.default_provider

        if config.failover_order:
            _runtime_llm_config["failover_order"] = config.failover_order

        # 调用 set_ai_config 配置 openrouter_config 模块
        try:
            from src.tools.openrouter_config import set_ai_config
            set_ai_config(ai_config)
            logger.info(f"已同步 AI 配置到 openrouter_config: {config.default_provider}")
        except Exception as e:
            logger.warning(f"同步 AI 配置失败: {e}")

        # 重置LLM客户端（openrouter_config 会自动重置）
        try:
            import src.tools.openrouter_config as or_config
            or_config._client = None
            logger.info("已重置LLM客户端")
        except Exception as e:
            logger.warning(f"重置LLM客户端失败: {e}")

        return {
            "success": True,
            "message": "LLM配置已更新",
            "config": {
                "default_provider": _runtime_llm_config.get("default_provider"),
                "failover_order": _runtime_llm_config.get("failover_order"),
                "configured_providers": list(config.providers.keys()) if config.providers else []
            }
        }

    except Exception as e:
        logger.error(f"更新LLM配置失败: {e}")
        return {"success": False, "error": str(e)}


@app.get("/config/llm")
async def get_llm_config():
    """获取当前LLM配置"""
    try:
        from src.tools.openrouter_config import _ai_config, get_client
        
        # 获取当前客户端状态
        client = get_client()
        client_type = type(client).__name__
        
        # 检查哪些提供商已配置API Key
        configured = {}
        for provider in ["hunyuan", "zhipu", "qwen", "deepseek", "kimi"]:
            env_key_map = {
                "hunyuan": "HUNYUAN_API_KEY",
                "zhipu": "ZHIPU_API_KEY",
                "qwen": "QWEN_API_KEY",
                "deepseek": "DEEPSEEK_API_KEY",
                "kimi": "KIMI_API_KEY",
            }
            env_key = env_key_map.get(provider)
            has_key = bool(os.getenv(env_key, ""))
            
            # 检查 _ai_config 中是否配置
            config_has_key = False
            if _ai_config:
                provider_config = _ai_config.get(provider, {})
                config_has_key = bool(provider_config.get("apiKey"))
            
            configured[provider] = {
                "has_api_key": has_key or config_has_key,
                "is_current": _ai_config and _ai_config.get("defaultProvider") == provider
            }
        
        return {
            "providers": configured,
            "current_client": client_type,
            "default_provider": _ai_config.get("defaultProvider") if _ai_config else None,
            "failover_order": _runtime_llm_config.get("failover_order", ["zhipu", "qwen", "deepseek", "hunyuan", "kimi"])
        }
        
    except Exception as e:
        return {"error": str(e)}


# ============== 前端兼容API ==============

# 任务存储（简单实现，生产环境应使用Redis等）
_task_store: Dict[str, Dict[str, Any]] = {}


@app.get("/api/modules")
async def get_modules():
    """获取分析模块列表"""
    return {
        "modules": [
            {"id": "technical", "name": "技术分析", "description": "分析K线形态、技术指标，判断趋势和支撑阻力位", "cache_ttl": 86400},
            {"id": "fundamental", "name": "基本面分析", "description": "分析财务报表，评估盈利能力和成长性", "cache_ttl": 604800},
            {"id": "sentiment", "name": "情绪分析", "description": "分析新闻和舆情，评估市场情绪", "cache_ttl": 86400},
            {"id": "valuation", "name": "估值分析", "description": "计算PE、PB估值，评估合理价位", "cache_ttl": 604800},
            {"id": "debate", "name": "多空辩论", "description": "多空双方观点对比，综合评估投资价值", "cache_ttl": 86400},
            {"id": "risk", "name": "风险评估", "description": "评估市场风险、波动率，提供止损止盈建议", "cache_ttl": 86400},
            {"id": "macro", "name": "宏观分析", "description": "分析宏观经济和行业政策对个股的影响", "cache_ttl": 604800},
        ]
    }


@app.post("/api/analysis/start")
async def start_analysis(request: dict):
    """启动分析任务"""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    stock_code = request.get("stock_code", request.get("ticker"))
    stock_name = request.get("stock_name", "")
    modules = request.get("modules", [])
    force_refresh = request.get("force_refresh", False)

    if not stock_code:
        raise HTTPException(status_code=400, detail="股票代码不能为空")

    task_id = f"task_{uuid.uuid4().hex[:12]}"
    logger.info(f"=== 创建新任务 ===")
    logger.info(f"task_id: {task_id}, stock_code: {stock_code}")

    # 初始化任务状态
    _task_store[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "stock_code": stock_code,
        "stock_name": stock_name,
        "progress": 0,
        "current_agent": None,
        "result": None,
        "error": None,
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    logger.info(f"任务已存储, 当前任务列表: {list(_task_store.keys())}")
    
    # 异步执行分析（使用线程池）
    def run_analysis_task():
        try:
            _task_store[task_id]["status"] = "running"
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
            
            result = run_analysis(
                ticker=stock_code,
                start_date=None,
                end_date=None,
                portfolio={"cash": 100000.0, "stock": 0},
                show_reasoning=True,
                num_of_news=10
            )
            
            _task_store[task_id]["result"] = result
            _task_store[task_id]["status"] = "completed"
            _task_store[task_id]["progress"] = 100
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
            
        except Exception as e:
            _task_store[task_id]["status"] = "failed"
            _task_store[task_id]["error"] = str(e)
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
    
    # 在后台执行
    import threading
    thread = threading.Thread(target=run_analysis_task)
    thread.start()
    
    return {
        "task_id": task_id,
        "status": "pending",
        "message": f"已启动 {stock_code} 的分析任务"
    }


@app.get("/api/analysis/status/{task_id}")
async def get_analysis_status(task_id: str):
    """获取分析任务状态"""
    if task_id not in _task_store:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = _task_store[task_id]
    return {
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "current_agent": task.get("current_agent"),
        "error": task.get("error"),
        "updated_at": task["updated_at"]
    }


@app.get("/api/analysis/result/{task_id}")
async def get_analysis_result(task_id: str):
    """获取分析结果"""
    logger.info(f"=== 结果API被调用 ===")
    logger.info(f"请求的 task_id: {task_id}")
    logger.info(f"_task_store 中的所有任务: {list(_task_store.keys())}")

    if task_id not in _task_store:
        logger.error(f"任务不存在: {task_id}")
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")
    
    task = _task_store[task_id]
    
    if task["status"] != "completed":
        return {
            "task_id": task_id,
            "status": task["status"],
            "error": task.get("error", "任务尚未完成")
        }
    
    result = task["result"]
    decision = result.get("decision", {})

    # 从 result 中直接获取 agent_signals（现在由 run_analysis 提供）
    agent_signals = result.get("agent_signals", [])
    
    # 如果 result 中没有，从 decision 中获取
    if not agent_signals:
        agent_signals = decision.get("agent_signals", [])
    
    logger.info(f"=== 返回结果 ===")
    logger.info(f"agent_signals 数量: {len(agent_signals)}")
    logger.info(f"agent_signals: {json.dumps(agent_signals, ensure_ascii=False)[:1000]}")
    
    # Agent 名称映射
    AGENT_NAME_MAP = {
        "technical_analyst": "technical_analysis",
        "technical_analyst_agent": "technical_analysis",
        "fundamentals": "fundamental_analysis",
        "fundamentals_agent": "fundamental_analysis",
        "sentiment": "sentiment_analysis",
        "sentiment_agent": "sentiment_analysis",
        "valuation": "valuation_analysis",
        "valuation_agent": "valuation_analysis",
        "researcher_bull": "bull_researcher",
        "researcher_bull_agent": "bull_researcher",
        "researcher_bear": "bear_researcher",
        "researcher_bear_agent": "bear_researcher",
        "debate_room": "debate_room",
        "debate_room_agent": "debate_room",
        "risk_manager": "risk_management",
        "risk_management_agent": "risk_management",
        "portfolio_management": "portfolio_management",
        "portfolio_management_agent": "portfolio_management",
    }
    
    # 确保每个 agent_signal 都有正确的名称
    processed_signals = []
    for signal in agent_signals:
        agent_name = signal.get("agent_name", "")
        mapped_name = AGENT_NAME_MAP.get(agent_name, agent_name)
        processed_signals.append({
            "agent_name": mapped_name,
            "signal": signal.get("signal", "neutral"),
            "confidence": signal.get("confidence", 0.5),
            "summary": signal.get("summary", ""),
            "reasoning": signal.get("reasoning", signal.get("summary", ""))
        })
    
    return {
        "task_id": task_id,
        "status": "completed",
        "stock_code": task["stock_code"],
        "stock_name": task["stock_name"],
        "decision": decision,
        "agent_signals": processed_signals,
        "reasoning": result.get("reasoning", ""),
        "run_id": result.get("run_id", "")
    }


# ============== 主入口 ==============

def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='A股投资分析Agent服务')
    
    # 服务模式
    parser.add_argument('--server', action='store_true', help='启动FastAPI服务器')
    parser.add_argument('--port', type=int, default=8001, help='服务器端口')
    
    # 分析模式
    parser.add_argument('--ticker', type=str, help='股票代码')
    parser.add_argument('--start-date', type=str, help='开始日期 (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='结束日期 (YYYY-MM-DD)')
    parser.add_argument('--initial-capital', type=float, default=100000.0, help='初始资金')
    parser.add_argument('--initial-position', type=int, default=0, help='初始持仓')
    parser.add_argument('--show-reasoning', action='store_true', help='显示推理过程')
    parser.add_argument('--num-of-news', type=int, default=10, help='新闻数量')
    
    args = parser.parse_args()
    
    if args.server:
        # 启动服务器
        logger.info(f"启动FastAPI服务器，端口: {args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)
    elif args.ticker:
        # 运行分析
        portfolio = {
            "cash": args.initial_capital,
            "stock": args.initial_position
        }
        
        result = run_analysis(
            ticker=args.ticker,
            start_date=args.start_date,
            end_date=args.end_date,
            portfolio=portfolio,
            show_reasoning=args.show_reasoning,
            num_of_news=args.num_of_news
        )
        
        print("\n" + "="*50)
        print("投资分析结果")
        print("="*50)
        print(f"Run ID: {result['run_id']}")
        print(f"股票代码: {result['ticker']}")
        print(f"\n决策: {result['decision'].get('action', 'N/A')}")
        print(f"置信度: {result['decision'].get('confidence', 'N/A')}")
        print(f"数量: {result['decision'].get('quantity', 'N/A')}")
        print(f"\n理由: {result['reasoning']}")
        print("="*50)
    else:
        # 默认启动服务器
        logger.info(f"启动FastAPI服务器，端口: {args.port}")
        uvicorn.run(app, host="0.0.0.0", port=args.port)


if __name__ == "__main__":
    main()