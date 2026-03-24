"""
股票分析相关路由模块

此模块提供与股票分析任务相关的API端点
"""

from fastapi import APIRouter
import uuid
import logging
from datetime import datetime, UTC
from typing import Dict

from ..models.api_models import (
    ApiResponse, StockAnalysisRequest, StockAnalysisResponse
)
from ..state import api_state
from ..services import execute_stock_analysis
from ..utils.api_utils import serialize_for_api, safe_parse_json
from src.tools.openrouter_config import set_ai_config

logger = logging.getLogger("analysis_router")

router = APIRouter(prefix="/api/analysis", tags=["Analysis"])


@router.post("/start", response_model=ApiResponse[StockAnalysisResponse])
async def start_stock_analysis(request: StockAnalysisRequest):
    if request.ai_config:
        set_ai_config(request.ai_config)
        logger.info("AI config set successfully")
    
    run_id = str(uuid.uuid4())

    future = api_state._executor.submit(
        execute_stock_analysis,
        request=request,
        run_id=run_id
    )

    api_state.register_analysis_task(run_id, future)
    api_state.register_run(run_id)

    response = StockAnalysisResponse(
        run_id=run_id,
        ticker=request.ticker,
        status="running",
        message="Analysis task started",
        submitted_at=datetime.now(UTC)
    )

    return ApiResponse(
        success=True,
        message="Analysis task started successfully",
        data=response
    )


@router.get("/{run_id}/status", response_model=ApiResponse[Dict])
async def get_analysis_status(run_id: str):
    task = api_state.get_analysis_task(run_id)
    run_info = api_state.get_run(run_id)

    if not run_info:
        return ApiResponse(
            success=False,
            message=f"Analysis task '{run_id}' not found",
            data=None
        )

    status_data = {
        "run_id": run_id,
        "status": run_info.status,
        "start_time": run_info.start_time,
        "end_time": run_info.end_time,
        "is_complete": run_info.status in ["completed", "error"]
    }

    if task:
        if task.done():
            if task.exception():
                status_data["error"] = str(task.exception())
                status_data["status"] = "error"
            status_data["is_complete"] = True
        else:
            status_data["is_complete"] = False

    return ApiResponse(data=status_data)


@router.get("/{run_id}/result", response_model=ApiResponse[Dict])
async def get_analysis_result(run_id: str):
    try:
        task = api_state.get_analysis_task(run_id)
        run_info = api_state.get_run(run_id)

        if not run_info:
            return ApiResponse(
                success=False,
                message=f"Analysis task '{run_id}' not found",
                data=None
            )

        if run_info.status != "completed":
            return ApiResponse(
                success=False,
                message=f"Analysis task not completed, current status: {run_info.status}",
                data={"status": run_info.status}
            )

        # Agent 名称映射
        AGENT_NAME_MAP = {
            "market_data": "market_data",
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

        agent_results = {}
        agent_signals = []
        ticker = ""
        
        # 收集所有 agent 的数据
        for agent_name in run_info.agents:
            agent_data = api_state.get_agent_data(agent_name)
            mapped_name = AGENT_NAME_MAP.get(agent_name, agent_name)
            
            if agent_data and "reasoning" in agent_data:
                reasoning_data = safe_parse_json(agent_data["reasoning"])
                if reasoning_data:
                    # 构建带中文摘要的 agent 数据
                    signal = reasoning_data.get("signal", "neutral")
                    confidence = reasoning_data.get("confidence", "0%")
                    
                    # 处理置信度格式
                    if isinstance(confidence, str):
                        if confidence.endswith("%"):
                            confidence_val = float(confidence.replace("%", "")) / 100
                        else:
                            try:
                                confidence_val = float(confidence)
                            except:
                                confidence_val = 0.5
                    else:
                        confidence_val = float(confidence) if confidence else 0.5
                    
                    # 获取或生成中文摘要
                    summary = reasoning_data.get("summary", "")
                    reasoning_text = reasoning_data.get("reasoning", "")
                    
                    if not summary and reasoning_text:
                        # 如果没有 summary，用 reasoning 的前100字作为摘要
                        summary = reasoning_text[:100] + "..." if len(reasoning_text) > 100 else reasoning_text
                    
                    agent_result = {
                        "signal": signal,
                        "confidence": confidence_val,
                        "summary": summary,
                        "reasoning": reasoning_text,
                        **serialize_for_api(reasoning_data)
                    }
                    
                    agent_results[agent_name] = agent_result
                    
                    # 添加到 agent_signals 列表
                    if mapped_name not in ["market_data", "portfolio_management"]:
                        agent_signals.append({
                            "agent_name": mapped_name,
                            "signal": signal,
                            "confidence": confidence_val,
                            "summary": summary
                        })

            if agent_name == "market_data" and agent_data and "output_state" in agent_data:
                try:
                    output = agent_data["output_state"]
                    if "data" in output and "ticker" in output["data"]:
                        ticker = output["data"]["ticker"]
                except Exception:
                    pass

        # 获取最终决策
        final_decision = None
        portfolio_data = api_state.get_agent_data("portfolio_management")
        if portfolio_data and "output_state" in portfolio_data:
            try:
                output = portfolio_data["output_state"]
                messages = output.get("messages", [])
                if messages:
                    last_message = messages[-1]
                    if hasattr(last_message, "content"):
                        final_decision = safe_parse_json(last_message.content)
            except Exception as e:
                logger.error(f"Error parsing final decision: {str(e)}")

        # 如果 final_decision 中有 agent_signals，使用它；否则用我们构建的
        if final_decision and "agent_signals" in final_decision:
            # 确保每个 signal 都有 summary
            for signal in final_decision["agent_signals"]:
                if "summary" not in signal or not signal["summary"]:
                    agent_name = signal.get("agent_name", "")
                    # 从 agent_results 中查找对应的 summary
                    for orig_name, result in agent_results.items():
                        mapped = AGENT_NAME_MAP.get(orig_name, orig_name)
                        if mapped == agent_name:
                            signal["summary"] = result.get("summary", "")
                            break
            agent_signals = final_decision["agent_signals"]

        result_data = {
            "run_id": run_id,
            "ticker": ticker,
            "stock_code": ticker,
            "completion_time": run_info.end_time,
            "decision": serialize_for_api(final_decision),
            "final_decision": serialize_for_api(final_decision),
            "agent_results": agent_results,
            "agent_signals": agent_signals
        }

        return ApiResponse(data=result_data)
    except Exception as e:
        logger.error(f"Error getting analysis result: {str(e)}")
        return ApiResponse(
            success=False,
            message=f"Error getting analysis result: {str(e)}",
            data={"error": str(e)}
        )