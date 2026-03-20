"""
前端兼容API路由模块

此模块提供与Next.js前端兼容的API端点，支持分析模块列表、任务管理等功能
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import Dict, List, Optional
from pydantic import BaseModel
import uuid
import logging
from datetime import datetime, timedelta
import threading
import json

from ..models.api_models import ApiResponse

logger = logging.getLogger("frontend_router")

# 创建路由器
router = APIRouter(prefix="/api", tags=["Frontend Compatible"])

# ============== Pydantic模型 ==============

class StartAnalysisRequest(BaseModel):
    """启动分析请求"""
    stock_code: Optional[str] = None
    ticker: Optional[str] = None
    stock_name: Optional[str] = ""
    modules: Optional[List[str]] = None
    force_refresh: Optional[bool] = False
    show_reasoning: Optional[bool] = True
    num_of_news: Optional[int] = 10
    initial_capital: Optional[float] = 100000.0
    initial_position: Optional[int] = 0

class ModuleInfo(BaseModel):
    """分析模块信息"""
    id: str
    name: str
    description: str
    cache_ttl: int  # 缓存有效期（秒）

# ============== 任务存储 ==============

_task_store: Dict[str, Dict] = {}

# ============== 分析模块定义 ==============

ANALYSIS_MODULES = [
    ModuleInfo(
        id="market_data",
        name="市场数据",
        description="获取实时行情、成交量、市值等市场数据",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="technical",
        name="技术分析",
        description="分析K线形态、技术指标，判断趋势和支撑阻力位",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="fundamental",
        name="基本面分析",
        description="分析财务报表，评估盈利能力和成长性",
        cache_ttl=604800
    ),
    ModuleInfo(
        id="sentiment",
        name="情绪分析",
        description="分析新闻和舆情，评估市场情绪",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="valuation",
        name="估值分析",
        description="计算PE、PB估值，评估合理价位",
        cache_ttl=604800
    ),
    ModuleInfo(
        id="debate",
        name="多空辩论",
        description="多空双方观点对比，综合评估投资价值",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="risk",
        name="风险评估",
        description="评估市场风险、波动率，提供止损止盈建议",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="macro",
        name="宏观分析",
        description="分析宏观经济和行业政策对个股的影响",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="macro_news",
        name="大盘新闻分析",
        description="分析沪深300相关新闻，评估大盘宏观环境",
        cache_ttl=86400
    ),
    ModuleInfo(
        id="portfolio",
        name="投资组合决策",
        description="综合所有分析，生成最终投资建议",
        cache_ttl=0
    )
]

# ============== 模块API ==============

@router.get("/modules", response_model=ApiResponse[List[Dict]])
async def get_modules():
    """获取分析模块列表
    
    返回所有可用的分析模块及其描述
    """
    modules_data = [m.dict() for m in ANALYSIS_MODULES]
    return ApiResponse(data=modules_data)


@router.get("/modules/{module_id}", response_model=ApiResponse[Dict])
async def get_module_info(module_id: str):
    """获取指定模块的详细信息"""
    for module in ANALYSIS_MODULES:
        if module.id == module_id:
            return ApiResponse(data=module.dict())
    
    return ApiResponse(
        success=False,
        message=f"模块 '{module_id}' 不存在",
        data=None
    )

# ============== 分析任务API ==============

@router.post("/analysis/start", response_model=ApiResponse[Dict])
async def start_analysis(request: StartAnalysisRequest, background_tasks: BackgroundTasks):
    """启动股票分析任务
    
    支持两种请求格式：
    1. { "stock_code": "000001", "stock_name": "平安银行" }
    2. { "ticker": "000001" }
    
    返回任务ID用于后续查询
    """
    # 兼容两种字段名
    ticker = request.stock_code or request.ticker
    
    if not ticker:
        return ApiResponse(
            success=False,
            message="股票代码不能为空",
            data=None
        )
    
    # 生成任务ID
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    
    # 初始化任务状态
    _task_store[task_id] = {
        "task_id": task_id,
        "status": "pending",
        "stock_code": ticker,
        "stock_name": request.stock_name or "",
        "progress": 0,
        "current_agent": None,
        "result": None,
        "error": None,
        "modules": request.modules or ["technical", "fundamental", "sentiment", "valuation"],
        "created_at": datetime.now().isoformat(),
        "updated_at": datetime.now().isoformat()
    }
    
    # 在后台执行分析
    def run_analysis_task():
        try:
            _task_store[task_id]["status"] = "running"
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
            
            # 调用主分析流程
            from ...src.main import run_hedge_fund
            
            portfolio = {
                "cash": request.initial_capital or 100000.0,
                "stock": request.initial_position or 0
            }
            
            current_date = datetime.now()
            yesterday = current_date - timedelta(days=1)
            start_date = (yesterday - timedelta(days=365)).strftime('%Y-%m-%d')
            end_date = yesterday.strftime('%Y-%m-%d')
            
            run_id = str(uuid.uuid4())
            
            result = run_hedge_fund(
                run_id=run_id,
                ticker=ticker,
                start_date=start_date,
                end_date=end_date,
                portfolio=portfolio,
                show_reasoning=request.show_reasoning or True,
                num_of_news=request.num_of_news or 10,
                show_summary=True
            )
            
            # 尝试解析结果
            try:
                decision = json.loads(result) if isinstance(result, str) else result
            except:
                decision = {"raw_response": str(result)}
            
            _task_store[task_id]["result"] = {
                "run_id": run_id,
                "decision": decision,
                "reasoning": decision.get("reasoning", "") if isinstance(decision, dict) else ""
            }
            _task_store[task_id]["status"] = "completed"
            _task_store[task_id]["progress"] = 100
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
            
        except Exception as e:
            import traceback
            _task_store[task_id]["status"] = "failed"
            _task_store[task_id]["error"] = str(e)
            _task_store[task_id]["traceback"] = traceback.format_exc()
            _task_store[task_id]["updated_at"] = datetime.now().isoformat()
            logger.error(f"分析任务失败: {e}")
    
    # 启动后台线程
    thread = threading.Thread(target=run_analysis_task)
    thread.start()
    
    return ApiResponse(
        success=True,
        message=f"已启动 {ticker} 的分析任务",
        data={
            "task_id": task_id,
            "status": "pending",
            "stock_code": ticker,
            "stock_name": request.stock_name
        }
    )


@router.get("/analysis/status/{task_id}", response_model=ApiResponse[Dict])
async def get_analysis_status(task_id: str):
    """获取分析任务状态
    
    返回任务进度、当前执行的Agent、错误信息等
    """
    if task_id not in _task_store:
        return ApiResponse(
            success=False,
            message=f"任务 '{task_id}' 不存在",
            data=None
        )
    
    task = _task_store[task_id]
    
    return ApiResponse(data={
        "task_id": task_id,
        "status": task["status"],
        "progress": task["progress"],
        "current_agent": task.get("current_agent"),
        "stock_code": task.get("stock_code"),
        "stock_name": task.get("stock_name"),
        "error": task.get("error"),
        "created_at": task["created_at"],
        "updated_at": task["updated_at"]
    })


@router.get("/analysis/result/{task_id}", response_model=ApiResponse[Dict])
async def get_analysis_result(task_id: str):
    """获取分析结果
    
    只有当任务状态为completed时才返回完整结果
    """
    if task_id not in _task_store:
        return ApiResponse(
            success=False,
            message=f"任务 '{task_id}' 不存在",
            data=None
        )
    
    task = _task_store[task_id]
    
    if task["status"] != "completed":
        return ApiResponse(
            success=False,
            message=f"任务尚未完成，当前状态: {task['status']}",
            data={"status": task["status"], "error": task.get("error")}
        )
    
    return ApiResponse(data={
        "task_id": task_id,
        "status": "completed",
        "stock_code": task["stock_code"],
        "stock_name": task.get("stock_name", ""),
        **task.get("result", {})
    })


@router.get("/analysis/list", response_model=ApiResponse[List[Dict]])
async def list_analysis_tasks(limit: int = 20):
    """列出最近的分析任务"""
    tasks = list(_task_store.values())
    tasks.sort(key=lambda x: x["created_at"], reverse=True)
    return ApiResponse(data=tasks[:limit])


@router.delete("/analysis/{task_id}", response_model=ApiResponse[Dict])
async def delete_analysis_task(task_id: str):
    """删除分析任务记录"""
    if task_id not in _task_store:
        return ApiResponse(
            success=False,
            message=f"任务 '{task_id}' 不存在",
            data=None
        )
    
    del _task_store[task_id]
    
    return ApiResponse(
        success=True,
        message=f"任务 '{task_id}' 已删除",
        data={"task_id": task_id}
    )


# ============== 健康检查 ==============

@router.get("/health", response_model=ApiResponse[Dict])
async def health_check():
    """API健康检查"""
    return ApiResponse(data={
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_tasks": len([t for t in _task_store.values() if t["status"] == "running"])
    })
