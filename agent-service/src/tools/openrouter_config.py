"""
OpenRouter 配置兼容层

提供与原仓库兼容的 LLM 调用接口
使用 3L 投研平台的 AI API
"""

import os
import json
import backoff
from typing import List, Dict, Optional
from dataclasses import dataclass
from src.utils.logging_config import setup_logger, SUCCESS_ICON, ERROR_ICON, WAIT_ICON

logger = setup_logger('openrouter_config')


class LLMClient:
    """LLM客户端基类"""
    
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        raise NotImplementedError


class MockLLMClient(LLMClient):
    """模拟客户端，返回预设响应"""
    
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        # 返回中性信号
        return json.dumps({
            "signal": "neutral",
            "confidence": 0.5,
            "reasoning": "AI服务未配置，请在前端设置中配置AI平台API Key"
        }, ensure_ascii=False)


class PlatformAIClient(LLMClient):
    """3L平台AI客户端"""
    
    def __init__(self):
        import requests
        self.requests = requests
        self.api_url = os.getenv("PLATFORM_CHAT_API", "http://localhost:3000/api/ai/chat")
    
    @backoff.on_exception(backoff.expo, Exception, max_tries=3, max_time=120)
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        try:
            # 获取AI配置
            ai_config = getattr(PlatformAIClient, '_ai_config', None) or {}
            provider = ai_config.get("defaultProvider", "zhipu")
            
            response = self.requests.post(
                self.api_url,
                json={
                    "messages": messages,
                    "provider": provider,
                    "config": ai_config
                },
                headers={"Content-Type": "application/json"},
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    return result.get("content", "")
                else:
                    logger.error(f"{ERROR_ICON} AI调用失败: {result.get('error')}")
                    return None
            else:
                logger.error(f"{ERROR_ICON} API调用失败: HTTP {response.status_code}")
                return None
        except Exception as e:
            logger.error(f"{ERROR_ICON} get_completion 发生错误: {str(e)}")
            return None


# 全局客户端实例
_client: Optional[LLMClient] = None
_ai_config: Optional[Dict] = None


def set_ai_config(config: Dict):
    """设置AI配置"""
    global _ai_config, _client
    _ai_config = config
    PlatformAIClient._ai_config = config
    _client = None  # 重置客户端
    logger.info(f"AI配置已更新，默认提供商: {config.get('defaultProvider', '未知')}")


def get_client() -> LLMClient:
    """获取LLM客户端"""
    global _client
    if _client is None:
        # 检查是否有配置
        if _ai_config:
            provider = _ai_config.get("defaultProvider", "zhipu")
            provider_config = _ai_config.get(provider, {})
            if provider_config.get("apiKey"):
                _client = PlatformAIClient()
                PlatformAIClient._ai_config = _ai_config
                logger.info(f"使用平台AI客户端 ({provider})")
                return _client
        
        # 没有配置，使用模拟客户端
        logger.warning("未配置AI，使用模拟客户端")
        _client = MockLLMClient()
    return _client


def get_chat_completion(messages: List[Dict], model: str = None, max_retries: int = 3,
                        initial_retry_delay: int = 1, client_type: str = "auto",
                        api_key: str = None, base_url: str = None) -> Optional[str]:
    """
    获取聊天完成结果
    
    兼容原仓库接口
    
    Args:
        messages: 消息列表，OpenAI 格式
        model: 模型名称（可选）
        max_retries: 最大重试次数
        initial_retry_delay: 初始重试延迟（秒）
        client_type: 客户端类型
        api_key: API 密钥（兼容参数）
        base_url: API 基础 URL（兼容参数）
        
    Returns:
        str: 模型回答内容或 None
    """
    try:
        client = get_client()
        return client.get_completion(messages=messages)
    except Exception as e:
        logger.error(f"{ERROR_ICON} get_chat_completion 发生错误: {str(e)}")
        return None


# 兼容原仓库的数据类
@dataclass
class ChatMessage:
    content: str


@dataclass
class ChatChoice:
    message: ChatMessage


@dataclass
class ChatCompletion:
    choices: list[ChatChoice]
