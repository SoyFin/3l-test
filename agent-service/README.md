# 3L投研 - 深度分析服务

基于多Agent协同的A股深度分析Python服务。

## 功能模块

| 模块 | 说明 | 缓存有效期 |
|------|------|-----------|
| 技术分析 | K线形态、MA/RSI/MACD、趋势判断、支撑阻力位 | 1天 |
| 基本面分析 | 财务报表、ROE/毛利率、盈利能力、成长性 | 3个月 |
| 情绪分析 | 新闻舆情、市场情绪、利好利空判断 | 1天 |
| 估值分析 | PE/PB估值、行业对比、合理价位 | 3个月 |
| 多空辩论 | 多空观点对比、综合评估 | 1天 |
| 风险评估 | 波动率、最大回撤、止损止盈建议 | 1天 |
| 宏观分析 | 宏观经济、行业政策、热点主题 | 1周 |

## 安装

```bash
cd agent-service
pip install -r requirements.txt
```

## 配置

创建 `.env` 文件：

```env
# LLM配置（可选，用于高级分析）
LLM_PROVIDER=aihubmix
LLM_API_KEY=your-api-key
LLM_MODEL=gpt-4o-mini

# 数据服务（可选）
SERPAPI_KEY=your-serpapi-key

# 服务配置
AGENT_PORT=8001
```

> 注意：基础分析功能无需LLM配置，可使用技术指标和数据分析。LLM用于生成更智能的分析报告。

## 启动

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

## API接口

### 服务状态
```
GET /
GET /health
```

### 启动分析
```
POST /api/analysis/start
{
  "stock_code": "SZ002594",
  "stock_name": "比亚迪",
  "industry": "汽车",
  "modules": null,  // null表示全部模块，或指定 ["technical", "fundamental"]
  "force_refresh": false
}
```

### 查询任务状态
```
GET /api/analysis/status/{task_id}
```

响应：
```json
{
  "task_id": "xxx",
  "stock_code": "SZ002594",
  "status": "running",  // pending, running, completed, failed, partial
  "progress": 50,
  "current_module": "sentiment",
  "completed_modules": ["technical", "fundamental"],
  "failed_modules": {}
}
```

### 获取分析结果
```
GET /api/analysis/result/{task_id}
```

### 获取股票最新分析
```
GET /api/analysis/result/stock/{stock_code}
```

### 获取通知
```
GET /api/notifications?unreadOnly=true&limit=20
PUT /api/notifications/{id}/read
```

## 数据源

| 数据源 | 用途 | 优先级 |
|--------|------|--------|
| akshare | A股行情、财务数据 | 1 (最高) |
| 东方财富 | 新闻、个股数据 | 5 |
| 新浪财经 | 新闻、资金流向 | 10 |
| SerpAPI | 搜索聚合（备用） | 20 |

## 目录结构

```
agent-service/
├── main.py              # FastAPI入口
├── requirements.txt     # 依赖
├── config/
│   └── settings.py      # 配置管理
├── data_sources/
│   ├── base.py          # 数据源基类
│   ├── akshare_source.py # Akshare实现
│   ├── eastmoney_source.py # 东方财富实现
│   ├── sina_source.py   # 新浪财经实现
│   ├── serpapi_source.py # SerpAPI实现
│   └── manager.py       # 数据源管理器
└── agents/
    ├── base.py          # Agent基类
    ├── technical_agent.py # 技术分析
    ├── fundamental_agent.py # 基本面分析
    ├── sentiment_agent.py # 情绪分析
    ├── valuation_agent.py # 估值分析
    ├── debate_agent.py  # 多空辩论
    ├── risk_agent.py    # 风险评估
    └── macro_agent.py   # 宏观分析
```

## 与Next.js集成

在Next.js项目中设置环境变量：

```env
AGENT_SERVICE_URL=http://localhost:8001
```

调用API示例：

```typescript
// 启动分析
const response = await fetch('/api/analysis', {
  method: 'POST',
  body: JSON.stringify({
    stockCode: 'SZ002594',
    stockName: '比亚迪',
  })
})

// 轮询状态
const status = await fetch(`/api/analysis/status?taskId=${taskId}`)
```

## 注意事项

1. **Python依赖**：需要安装akshare、pandas、numpy、fastapi等
2. **网络访问**：需要能访问akshare数据源（可能需要代理）
3. **缓存策略**：结果会缓存到SQLite数据库，避免重复分析
4. **并发限制**：建议单实例最多处理3个并发分析任务
