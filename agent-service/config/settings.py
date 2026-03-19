"""
配置管理模块
支持从环境变量和数据库读取配置
"""
import os
from typing import Optional
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()


class LLMConfig(BaseModel):
    """LLM配置"""
    provider: str = "aihubmix"  # aihubmix, openai, gemini, zhipu
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    model: str = "gpt-4o-mini"
    temperature: float = 0.7
    max_tokens: int = 4000


class DataSourceConfig(BaseModel):
    """数据源配置"""
    # SerpAPI
    serpapi_key: Optional[str] = None
    
    # 数据源优先级
    stock_data_priority: list[str] = ["akshare", "baostock", "sina", "yfinance"]
    news_data_priority: list[str] = ["sina", "eastmoney", "cls", "10jqka", "serpapi"]


class CacheConfig(BaseModel):
    """缓存配置"""
    # 技术分析缓存：1天
    technical_ttl: int = 86400
    # 基本面分析缓存：至下次财报（最长3个月）
    fundamental_ttl: int = 7776000
    # 情绪分析缓存：1天
    sentiment_ttl: int = 86400
    # 估值分析缓存：至下次财报
    valuation_ttl: int = 7776000
    # 多空辩论缓存：1天
    debate_ttl: int = 86400
    # 风险评估缓存：1天
    risk_ttl: int = 86400
    # 宏观分析缓存：1周
    macro_ttl: int = 604800


class AppConfig(BaseModel):
    """应用配置"""
    # 服务配置
    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False
    
    # 数据库
    database_url: str = "sqlite:///../db/custom.db"
    
    # 配置实例
    llm: LLMConfig = LLMConfig()
    data_source: DataSourceConfig = DataSourceConfig()
    cache: CacheConfig = CacheConfig()
    
    # 任务队列
    max_concurrent_tasks: int = 3
    task_timeout: int = 300  # 5分钟


def load_config() -> AppConfig:
    """加载配置"""
    # 从环境变量加载
    config = AppConfig(
        host=os.getenv("AGENT_HOST", "0.0.0.0"),
        port=int(os.getenv("AGENT_PORT", "8001")),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        database_url=os.getenv("DATABASE_URL", "sqlite:///../db/custom.db"),
        llm=LLMConfig(
            provider=os.getenv("LLM_PROVIDER", "aihubmix"),
            api_key=os.getenv("LLM_API_KEY") or os.getenv("AIHUBMIX_API_KEY"),
            base_url=os.getenv("LLM_BASE_URL") or os.getenv("AIHUBMIX_BASE_URL"),
            model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        ),
        data_source=DataSourceConfig(
            serpapi_key=os.getenv("SERPAPI_KEY"),
        ),
        max_concurrent_tasks=int(os.getenv("MAX_CONCURRENT_TASKS", "3")),
    )
    
    return config


# 全局配置实例
config = load_config()
