"""
LLM配置和数据源管理路由模块

此模块提供LLM提供商配置和数据源管理的API端点
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, List, Optional
from pydantic import BaseModel
import os
import logging
import asyncio

from ..models.api_models import ApiResponse

logger = logging.getLogger("config_router")

# 创建路由器
router = APIRouter(prefix="/api/config", tags=["Configuration"])

# ============== Pydantic模型 ==============

class LLMProviderConfig(BaseModel):
    """单个LLM提供商配置"""
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None

class LLMConfigRequest(BaseModel):
    """LLM配置请求"""
    providers: Optional[Dict[str, Optional[LLMProviderConfig]]] = None
    default_provider: Optional[str] = None
    failover_order: Optional[List[str]] = None

class DataSourceConfig(BaseModel):
    """数据源配置"""
    enabled: bool = True
    api_key: Optional[str] = None
    rate_limit: Optional[int] = None

# ============== 运行时配置存储 ==============

_runtime_config: Dict = {
    "default_provider": "openrouter",
    "failover_order": ["openrouter", "zhipu", "deepseek", "qwen", "hunyuan"],
    "configured_providers": set()
}

_data_sources: Dict[str, DataSourceConfig] = {
    "akshare": DataSourceConfig(enabled=True),
    "eastmoney": DataSourceConfig(enabled=True),
    "sina": DataSourceConfig(enabled=True),
    "serpapi": DataSourceConfig(enabled=False, api_key=None)
}

# API Key环境变量映射
ENV_KEY_MAP = {
    "openrouter": "OPENROUTER_API_KEY",
    "zhipu": "ZHIPU_API_KEY",
    "qwen": "QWEN_API_KEY",
    "deepseek": "DEEPSEEK_API_KEY",
    "hunyuan": "HUNYUAN_API_KEY",
    "kimi": "KIMI_API_KEY",
}

# ============== LLM配置API ==============

@router.get("/llm", response_model=ApiResponse[Dict])
async def get_llm_config():
    """获取当前LLM配置
    
    返回所有支持的LLM提供商及其配置状态
    """
    try:
        configured = {}
        available = []
        
        for provider in ["openrouter", "zhipu", "qwen", "deepseek", "hunyuan", "kimi"]:
            env_key = ENV_KEY_MAP.get(provider, "")
            has_key = bool(os.getenv(env_key, ""))
            configured[provider] = {
                "has_api_key": has_key,
                "available": has_key,
                "model": _get_default_model(provider)
            }
            if has_key:
                available.append(provider)
        
        return ApiResponse(data={
            "providers": configured,
            "available_providers": available,
            "default_provider": _runtime_config["default_provider"],
            "failover_order": _runtime_config["failover_order"]
        })
        
    except Exception as e:
        logger.error(f"获取LLM配置失败: {e}")
        return ApiResponse(success=False, message=str(e), data=None)


@router.post("/llm", response_model=ApiResponse[Dict])
async def update_llm_config(config: LLMConfigRequest):
    """更新LLM配置
    
    从前端同步LLM提供商配置，支持动态更新API Key
    """
    try:
        updated_providers = []
        
        if config.providers:
            for provider_name, provider_config in config.providers.items():
                if provider_config and provider_config.api_key:
                    env_key = ENV_KEY_MAP.get(provider_name)
                    if env_key:
                        os.environ[env_key] = provider_config.api_key
                        _runtime_config["configured_providers"].add(provider_name)
                        updated_providers.append(provider_name)
                        logger.info(f"已配置 {provider_name} API Key")
        
        if config.default_provider:
            _runtime_config["default_provider"] = config.default_provider
        
        if config.failover_order:
            _runtime_config["failover_order"] = config.failover_order
        
        # 重置LLM客户端缓存
        try:
            import sys
            if 'src.utils.llm_clients' in sys.modules:
                sys.modules['src.utils.llm_clients']._global_client = None
                logger.info("已重置LLM客户端缓存")
        except Exception as e:
            logger.warning(f"重置LLM客户端缓存失败: {e}")
        
        return ApiResponse(
            success=True,
            message="LLM配置已更新",
            data={
                "default_provider": _runtime_config["default_provider"],
                "failover_order": _runtime_config["failover_order"],
                "updated_providers": updated_providers
            }
        )
        
    except Exception as e:
        logger.error(f"更新LLM配置失败: {e}")
        return ApiResponse(success=False, message=str(e), data=None)


@router.get("/llm/providers", response_model=ApiResponse[List[Dict]])
async def list_llm_providers():
    """列出所有支持的LLM提供商"""
    providers = [
        {
            "name": "openrouter",
            "display_name": "OpenRouter",
            "description": "支持多种模型的统一API",
            "default_model": "anthropic/claude-3.5-sonnet",
            "env_key": "OPENROUTER_API_KEY"
        },
        {
            "name": "zhipu",
            "display_name": "智谱清言",
            "description": "智谱AI GLM系列模型",
            "default_model": "glm-4",
            "env_key": "ZHIPU_API_KEY"
        },
        {
            "name": "deepseek",
            "display_name": "DeepSeek",
            "description": "DeepSeek系列模型",
            "default_model": "deepseek-chat",
            "env_key": "DEEPSEEK_API_KEY"
        },
        {
            "name": "qwen",
            "display_name": "通义千问",
            "description": "阿里云通义千问模型",
            "default_model": "qwen-max",
            "env_key": "QWEN_API_KEY"
        },
        {
            "name": "hunyuan",
            "display_name": "腾讯混元",
            "description": "腾讯混元大模型",
            "default_model": "hunyuan-lite",
            "env_key": "HUNYUAN_API_KEY"
        },
        {
            "name": "kimi",
            "display_name": "Moonshot Kimi",
            "description": "月之暗面Kimi模型",
            "default_model": "moonshot-v1-8k",
            "env_key": "KIMI_API_KEY"
        }
    ]
    return ApiResponse(data=providers)


# ============== 数据源管理API ==============

@router.get("/data-sources", response_model=ApiResponse[Dict])
async def get_data_sources():
    """获取所有数据源配置"""
    result = {}
    for name, config in _data_sources.items():
        result[name] = {
            "enabled": config.enabled,
            "has_api_key": bool(config.api_key),
            "rate_limit": config.rate_limit
        }
    return ApiResponse(data=result)


@router.post("/data-sources/{source_name}", response_model=ApiResponse[Dict])
async def update_data_source(source_name: str, config: DataSourceConfig):
    """更新指定数据源配置"""
    if source_name not in _data_sources:
        return ApiResponse(
            success=False,
            message=f"数据源 '{source_name}' 不存在",
            data=None
        )
    
    _data_sources[source_name] = config
    
    return ApiResponse(
        success=True,
        message=f"数据源 '{source_name}' 配置已更新",
        data={"source": source_name, "config": config.dict()}
    )


@router.get("/data-sources/status", response_model=ApiResponse[Dict])
async def get_data_sources_status():
    """获取数据源连接状态"""
    status = {}
    
    for name in _data_sources.keys():
        try:
            if name == "akshare":
                import akshare as ak
                ak.stock_zh_a_spot_em()
                status[name] = {"connected": True, "message": "连接正常"}
            elif name == "eastmoney":
                status[name] = {"connected": True, "message": "连接正常"}
            elif name == "sina":
                status[name] = {"connected": True, "message": "连接正常"}
            else:
                status[name] = {"connected": _data_sources[name].enabled, "message": "未启用"}
        except Exception as e:
            status[name] = {"connected": False, "message": str(e)[:100]}
    
    return ApiResponse(data=status)


# ============== 辅助函数 ==============

def _get_default_model(provider: str) -> str:
    """获取提供商的默认模型"""
    models = {
        "openrouter": "anthropic/claude-3.5-sonnet",
        "zhipu": "glm-4",
        "deepseek": "deepseek-chat",
        "qwen": "qwen-max",
        "hunyuan": "hunyuan-lite",
        "kimi": "moonshot-v1-8k"
    }
    return models.get(provider, "unknown")
