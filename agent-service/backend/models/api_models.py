"""
API data models
"""

from pydantic import BaseModel, Field
from typing import Dict, List, Any, Optional, TypeVar, Generic
from datetime import datetime, UTC

T = TypeVar('T')


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "Success"
    data: Optional[T] = None
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AgentInfo(BaseModel):
    name: str
    description: str
    state: str = "idle"
    last_run: Optional[datetime] = None


class RunInfo(BaseModel):
    run_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    agents: List[str] = []


class AIConfig(BaseModel):
    api_key: str = Field(..., description="AI service API key")
    base_url: Optional[str] = Field(None, description="AI service base URL")
    model: Optional[str] = Field(None, description="Model name")


class StockAnalysisRequest(BaseModel):
    ticker: str = Field(..., description="Stock ticker, e.g. '002848'")
    show_reasoning: bool = Field(True, description="Show analysis reasoning")
    num_of_news: int = Field(5, description="Number of news articles (1-100)", ge=1, le=100)
    initial_capital: float = Field(100000.0, description="Initial capital", gt=0)
    initial_position: int = Field(0, description="Initial position", ge=0)
    ai_config: Optional[AIConfig] = Field(None, description="AI configuration")

    class Config:
        json_schema_extra = {
            "example": {
                "ticker": "002848",
                "show_reasoning": True,
                "num_of_news": 5,
                "initial_capital": 100000.0,
                "initial_position": 0,
                "ai_config": {
                    "api_key": "sk-xxxx",
                    "base_url": "https://api.openai.com/v1",
                    "model": "gpt-4"
                }
            }
        }


class StockAnalysisResponse(BaseModel):
    run_id: str = Field(..., description="Analysis task ID")
    ticker: str = Field(..., description="Stock ticker")
    status: str = Field(..., description="Task status: running, completed, error")
    message: str = Field(..., description="Status message")
    submitted_at: datetime = Field(..., description="Submission time")
    completed_at: Optional[datetime] = Field(None, description="Completion time")