'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  Bot, Sparkles, TrendingUp, TrendingDown, Minus, 
  Loader2, Play, RefreshCw, CheckCircle2, Clock,
  BarChart3, AlertCircle, Lightbulb, Target, AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeepAnalysisPanelProps {
  stockCode: string
  stockName: string
  industry?: string | null
}

// Agent 定义
const AGENTS = [
  { id: 'market_data', name: '市场数据', icon: BarChart3 },
  { id: 'technical_analysis', name: '技术分析', icon: TrendingUp },
  { id: 'fundamental_analysis', name: '基本面', icon: Target },
  { id: 'sentiment_analysis', name: '情绪分析', icon: Lightbulb },
  { id: 'valuation_analysis', name: '估值分析', icon: BarChart3 },
  { id: 'bull_researcher', name: '多方研究', icon: TrendingUp },
  { id: 'bear_researcher', name: '空方研究', icon: TrendingDown },
  { id: 'debate_room', name: '多空辩论', icon: Bot },
  { id: 'risk_management', name: '风险评估', icon: AlertCircle },
  { id: 'portfolio_management', name: '投资决策', icon: Sparkles },
]

type AgentStatus = 'pending' | 'running' | 'completed' | 'error'

interface AgentResult {
  status: AgentStatus
  signal?: 'bullish' | 'bearish' | 'neutral'
  confidence?: number
  summary?: string
}

interface AnalysisResult {
  action: string
  confidence: number
  reasoning: string
  agent_signals: Array<{
    agent_name: string
    signal: string
    confidence: number
  }>
  risk_assessment?: {
    level: string
    stop_loss: number
    take_profit: number
  }
}

// Agent名称映射
const AGENT_NAME_MAP: Record<string, string> = {
  'market_data': 'market_data',
  'technical_analysis': 'technical_analysis',
  'technical_analyst_agent': 'technical_analysis',
  'fundamental_analysis': 'fundamental_analysis',
  'fundamentals_agent': 'fundamental_analysis',
  'sentiment_analysis': 'sentiment_analysis',
  'sentiment_agent': 'sentiment_analysis',
  'valuation_analysis': 'valuation_analysis',
  'valuation_agent': 'valuation_analysis',
  'bull_researcher': 'bull_researcher',
  'researcher_bull_agent': 'bull_researcher',
  'bear_researcher': 'bear_researcher',
  'researcher_bear_agent': 'bear_researcher',
  'debate_room': 'debate_room',
  'debate_room_agent': 'debate_room',
  'risk_management': 'risk_management',
  'risk_management_agent': 'risk_management',
  'portfolio_management': 'portfolio_management',
  'portfolio_management_agent': 'portfolio_management',
}

const getCacheKey = (stockCode: string) => `deep_analysis_v3_${stockCode}`

export default function DeepAnalysisPanel({
  stockCode,
  stockName,
  industry
}: DeepAnalysisPanelProps) {
  const [agentResults, setAgentResults] = useState<Record<string, AgentResult>>({})
  const [currentAgent, setCurrentAgent] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [finalDecision, setFinalDecision] = useState<AnalysisResult | null>(null)
  const [usedCache, setUsedCache] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // 从缓存加载
  useEffect(() => {
    if (!stockCode) return
    const cached = localStorage.getItem(getCacheKey(stockCode))
    if (cached) {
      try {
        const data = JSON.parse(cached)
        if (data.finalDecision && data.timestamp) {
          const cacheAge = Date.now() - data.timestamp
          if (cacheAge < 4 * 60 * 60 * 1000) {
            setFinalDecision(data.finalDecision)
            setAgentResults(data.agentResults || {})
            setUsedCache(true)
            return
          }
        }
      } catch (e) {}
    }
    setFinalDecision(null)
    setAgentResults({})
    setUsedCache(false)
  }, [stockCode])

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [])

  // 启动分析
  const startAnalysis = useCallback(async () => {
    if (isRunning || !stockCode) return
    
    setIsRunning(true)
    setProgress(0)
    setFinalDecision(null)
    setUsedCache(false)
    setError(null)
    setAgentResults({})
    
    try {
      const response = await fetch('/api/agent/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stock_code: stockCode,
          stock_name: stockName,
          modules: null,
          force_refresh: true
        })
      })
      
      if (!response.ok) throw new Error('启动分析失败')
      
      const data = await response.json()
      setTaskId(data.task_id)
      
      // 开始轮询
      let currentProgress = 0
      pollingRef.current = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/agent/analyze?taskId=${data.task_id}`)
          const statusData = await statusResponse.json()
          
          if (statusData.status === 'completed') {
            const resultResponse = await fetch(`/api/agent/result/${data.task_id}`)
            const resultData = await resultResponse.json()
            
            if (resultData.decision) {
              setFinalDecision(resultData.decision)
              
              // 构建Agent结果
              const agentResultsMap: Record<string, AgentResult> = {}
              if (resultData.decision.agent_signals) {
                resultData.decision.agent_signals.forEach((signal: any) => {
                  const agentId = AGENT_NAME_MAP[signal.agent_name] || signal.agent_name || signal.agent
                  agentResultsMap[agentId] = {
                    status: 'completed',
                    signal: signal.signal,
                    confidence: signal.confidence,
                    summary: signal.summary
                  }
                })
              }
              setAgentResults(agentResultsMap)
              setProgress(100)
              
              // 保存缓存
              localStorage.setItem(getCacheKey(stockCode), JSON.stringify({
                finalDecision: resultData.decision,
                agentResults: agentResultsMap,
                timestamp: Date.now()
              }))
            }
            
            if (pollingRef.current) clearInterval(pollingRef.current)
            setIsRunning(false)
            setCurrentAgent(null)
            
          } else if (statusData.status === 'failed') {
            setError(statusData.error || '分析失败')
            if (pollingRef.current) clearInterval(pollingRef.current)
            setIsRunning(false)
          } else if (statusData.status === 'running') {
            currentProgress = Math.min(currentProgress + 10, 90)
            setProgress(currentProgress)
            if (statusData.current_agent) {
              setCurrentAgent(statusData.current_agent)
            }
          }
        } catch (e) {}
      }, 2000)
      
    } catch (e: any) {
      setError(e.message || '启动分析失败')
      setIsRunning(false)
    }
  }, [isRunning, stockCode, stockName])

  const getTrendIcon = (signal?: string) => {
    switch (signal) {
      case 'bullish': return <TrendingUp className="h-4 w-4 text-red-500" />
      case 'bearish': return <TrendingDown className="h-4 w-4 text-green-500" />
      default: return <Minus className="h-4 w-4 text-yellow-500" />
    }
  }

  const getScoreColor = (confidence: number) => {
    if (confidence >= 0.7) return 'text-red-500'
    if (confidence >= 0.5) return 'text-yellow-500'
    return 'text-green-500'
  }

  const getActionText = (action: string) => {
    switch (action) {
      case 'buy': return '建议买入'
      case 'sell': return '建议卖出'
      default: return '建议持有'
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Agent进度区域 */}
      <div className="flex-shrink-0 p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Agent分析引擎</span>
            {usedCache && <Badge variant="outline" className="text-xs">缓存</Badge>}
          </div>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={startAnalysis} disabled={isRunning}>
            {isRunning ? (
              <><Loader2 className="h-3 w-3 animate-spin" />分析中</>
            ) : (
              <><Play className="h-3 w-3" />{finalDecision ? '重新分析' : '开始分析'}</>
            )}
          </Button>
        </div>
        
        {error && (
          <div className="mb-2 p-2 rounded bg-destructive/10 text-destructive text-xs flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />{error}
          </div>
        )}
        
        {(isRunning || progress > 0) && (
          <div className="space-y-1.5">
            <Progress value={progress} className="h-1.5" />
            <div className="text-xs text-muted-foreground">
              {currentAgent ? `正在执行: ${currentAgent}` : '准备就绪'}
            </div>
          </div>
        )}
        
        {/* Agent状态网格 */}
        <div className="grid grid-cols-5 gap-1 mt-2">
          {AGENTS.map(agent => {
            const result = agentResults[agent.id]
            const status = result?.status || 'pending'
            return (
              <div
                key={agent.id}
                className={cn(
                  "flex items-center justify-center p-1.5 rounded text-xs transition-colors",
                  status === 'pending' && "bg-muted/50 text-muted-foreground",
                  status === 'running' && "bg-primary/20 text-primary animate-pulse",
                  status === 'completed' && "bg-green-100 text-green-700",
                  status === 'error' && "bg-red-100 text-red-700"
                )}
                title={agent.name}
              >
                {status === 'completed' ? <CheckCircle2 className="h-3 w-3" /> :
                 status === 'running' ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 status === 'error' ? <AlertCircle className="h-3 w-3" /> :
                 <Clock className="h-3 w-3" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* 分析结果区域 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {finalDecision ? (
            <>
              <div className="p-3 rounded-lg border bg-card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">投资建议</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(finalDecision.action === 'buy' ? 'bullish' : finalDecision.action === 'sell' ? 'bearish' : 'neutral')}
                    <span className={cn("text-lg font-bold", getScoreColor(finalDecision.confidence))}>
                      {getActionText(finalDecision.action)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  置信度: <span className={cn("font-medium", getScoreColor(finalDecision.confidence))}>
                    {(finalDecision.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {finalDecision.reasoning && (
                  <div className="mt-2 text-sm">{finalDecision.reasoning}</div>
                )}
              </div>

              {finalDecision.risk_assessment && (
                <div className="p-3 rounded-lg border bg-orange-50/50">
                  <div className="text-xs font-medium text-orange-700 mb-1.5">风险提示</div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-muted-foreground">风险等级：</span><span className="font-medium">{finalDecision.risk_assessment.level}</span></div>
                    <div><span className="text-muted-foreground">止损位：</span><span className="font-medium text-green-600">{(finalDecision.risk_assessment.stop_loss * 100).toFixed(0)}%</span></div>
                    <div><span className="text-muted-foreground">止盈位：</span><span className="font-medium text-red-600">{(finalDecision.risk_assessment.take_profit * 100).toFixed(0)}%</span></div>
                  </div>
                </div>
              )}

              {finalDecision.agent_signals && finalDecision.agent_signals.length > 0 && (
                <div className="p-3 rounded-lg border">
                  <div className="text-xs font-medium mb-2">各维度分析</div>
                  <div className="space-y-1.5">
                    {finalDecision.agent_signals.map((signal, index) => (
                      <div key={index} className="flex items-center justify-between text-xs p-1.5 rounded bg-muted/30">
                        <div className="flex items-center gap-1.5">
                          {getTrendIcon(signal.signal)}
                          <span className="text-muted-foreground">{signal.agent_name || signal.agent}</span>
                        </div>
                        <span className={cn("font-medium",
                          signal.signal === 'bullish' ? "text-red-500" :
                          signal.signal === 'bearish' ? "text-green-500" : "text-yellow-500"
                        )}>
                          {(signal.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">点击"开始分析"运行Agent分析引擎</p>
              <p className="text-xs text-muted-foreground/70 mt-1">将从多个维度对{stockName}进行深度分析</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
