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
    }

    if task:
        if task.done():
            if task.exception():
                status_data["error"] = str(task.exception())
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

        agent_results = {}
        ticker = ""
        for agent_name in run_info.agents:
            agent_data = api_state.get_agent_data(agent_name)
            if agent_data and "reasoning" in agent_data:
                reasoning_data = safe_parse_json(agent_data["reasoning"])
                agent_results[agent_name] = serialize_for_api(reasoning_data)

            if agent_name == "market_data" and agent_data and "output_state" in agent_data:
                try:
                    output = agent_data["output_state"]
                    if "data" in output and "ticker" in output["data"]:
                        ticker = output["data"]["ticker"]
                except Exception:
                    pass

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

        result_data = {
            "run_id": run_id,
            "ticker": ticker,
            "completion_time": run_info.end_time,
            "final_decision": serialize_for_api(final_decision),
            "agent_results": agent_results
        }

        return ApiResponse(data=result_data)
    except Exception as e:
        logger.error(f"Error getting analysis result: {str(e)}")
        return ApiResponse(
            success=False,
            message=f"Error getting analysis result: {str(e)}",
            data={"error": str(e)}
        )