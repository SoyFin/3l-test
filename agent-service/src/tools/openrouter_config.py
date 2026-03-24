"""
OpenRouter Configuration Compatibility Layer

Provides LLM call interface compatible with original repo
Directly calls AI provider APIs (Zhipu, DeepSeek, Qwen, etc.)
"""

import os
import json
import backoff
from typing import List, Dict, Optional
from dataclasses import dataclass
from src.utils.logging_config import setup_logger, SUCCESS_ICON, ERROR_ICON, WAIT_ICON

logger = setup_logger('openrouter_config')


class LLMClient:
    """LLM Client Base Class"""
    
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        raise NotImplementedError


class MockLLMClient(LLMClient):
    """Mock client that returns preset response"""
    
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        return json.dumps({
            "signal": "neutral",
            "confidence": 0.5,
            "reasoning": "AI service not configured, please set AI platform API Key in frontend settings"
        }, ensure_ascii=False)


class DirectAIClient(LLMClient):
    """Direct AI API Client - calls provider APIs directly"""
    
    def __init__(self, provider: str, api_key: str, base_url: str = None):
        import requests
        self.requests = requests
        self.provider = provider
        self.api_key = api_key
        self.base_url = base_url
        self.model = self._get_default_model()
    
    def _get_default_model(self) -> str:
        """Get default model for provider"""
        models = {
            "zhipu": "glm-4-flash",
            "deepseek": "deepseek-chat",
            "qwen": "qwen-turbo",
            "hunyuan": "hunyuan-lite",
            "kimi": "moonshot-v1-8k",
        }
        return models.get(self.provider, "glm-4-flash")
    
    def _get_api_url(self) -> str:
        """Get API URL for provider"""
        if self.base_url:
            return self.base_url.rstrip('/') + '/chat/completions'
        
        urls = {
            "zhipu": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
            "deepseek": "https://api.deepseek.com/v1/chat/completions",
            "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
            "hunyuan": "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
            "kimi": "https://api.moonshot.cn/v1/chat/completions",
        }
        return urls.get(self.provider, urls["zhipu"])
    
    @backoff.on_exception(backoff.expo, Exception, max_tries=3, max_time=120)
    def get_completion(self, messages: List[Dict], **kwargs) -> Optional[str]:
        try:
            url = self._get_api_url()
            model = kwargs.get('model', self.model)
            
            headers = {
                "Content-Type": "application/json",
                "Authorization": f"Bearer {self.api_key}"
            }
            
            payload = {
                "model": model,
                "messages": messages,
                "temperature": kwargs.get('temperature', 0.7),
                "max_tokens": kwargs.get('max_tokens', 2000)
            }
            
            logger.info(f"Calling {self.provider} API: {url}")
            logger.info(f"Model: {model}")
            
            response = self.requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=120
            )
            
            if response.status_code == 200:
                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                logger.info(f"{SUCCESS_ICON} {self.provider} API call successful")
                return content
            else:
                error_text = response.text[:500] if response.text else "No error details"
                logger.error(f"{ERROR_ICON} {self.provider} API failed: HTTP {response.status_code}")
                logger.error(f"Error details: {error_text}")
                return None
                
        except Exception as e:
            logger.error(f"{ERROR_ICON} get_completion error: {str(e)}")
            return None


# Global client instance
_client: Optional[LLMClient] = None
_ai_config: Optional[Dict] = None


def set_ai_config(config: Dict):
    """Set AI configuration"""
    global _ai_config, _client
    _ai_config = config
    _client = None  # Reset client to use new config
    provider = config.get('defaultProvider', 'unknown')
    logger.info(f"AI config updated, default provider: {provider}")


def get_client() -> LLMClient:
    """Get LLM client instance"""
    global _client
    logger.info(f"[get_client] called, current _client={bool(_client)}, _ai_config={bool(_ai_config)}")

    if _client is None:
        # Priority 1: Check _ai_config from set_ai_config()
        if _ai_config:
            provider = _ai_config.get("defaultProvider", "zhipu")
            provider_config = _ai_config.get(provider, {})
            api_key = provider_config.get("apiKey", "")
            base_url = provider_config.get("baseUrl", "")
            
            logger.info(f"Config check: provider={provider}, has_key={bool(api_key)}")

            if api_key:
                _client = DirectAIClient(provider, api_key, base_url)
                logger.info(f"{SUCCESS_ICON} Using direct AI client ({provider})")
                return _client
        
        # Priority 2: Check environment variables (set by main.py from frontend config)
        env_key_map = {
            "zhipu": ("ZHIPU_API_KEY", "https://open.bigmodel.cn/api/paas/v4/chat/completions"),
            "deepseek": ("DEEPSEEK_API_KEY", "https://api.deepseek.com/v1/chat/completions"),
            "qwen": ("QWEN_API_KEY", "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"),
            "hunyuan": ("HUNYUAN_API_KEY", "https://api.hunyuan.cloud.tencent.com/v1/chat/completions"),
            "kimi": ("KIMI_API_KEY", "https://api.moonshot.cn/v1/chat/completions"),
        }

        for provider_name, (env_key, api_url) in env_key_map.items():
            api_key = os.environ.get(env_key, "")
            if api_key:
                logger.info(f"{SUCCESS_ICON} Found {provider_name} API Key from environment variable {env_key}")
                _client = DirectAIClient(provider_name, api_key)
                return _client

        # No configuration, use mock client
        logger.warning("=" * 50)
        logger.warning("[WARNING] No AI configured, using mock client")
        logger.warning("Please check:")
        logger.warning("1. Is API Key correctly set in frontend?")
        logger.warning("2. Did you restart the backend service?")
        logger.warning("=" * 50)
        _client = MockLLMClient()
    
    return _client


def get_chat_completion(messages: List[Dict], model: str = None, max_retries: int = 3,
                        initial_retry_delay: int = 1, client_type: str = "auto",
                        api_key: str = None, base_url: str = None) -> Optional[str]:
    """
    Get chat completion result
    
    Compatible with original repo interface
    """
    try:
        client = get_client()
        kwargs = {}
        if model:
            kwargs['model'] = model
        return client.get_completion(messages=messages, **kwargs)
    except Exception as e:
        logger.error(f"{ERROR_ICON} get_chat_completion error: {str(e)}")
        return None


# Compatible data classes
@dataclass
class ChatMessage:
    content: str


@dataclass
class ChatChoice:
    message: ChatMessage


@dataclass
class ChatCompletion:
    choices: list[ChatChoice]