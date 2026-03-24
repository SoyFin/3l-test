'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Progress } from '@/components/ui/progress'
import { 
  Bot, Sparkles, TrendingUp, TrendingDown, Minus, 
  Loader2, Play, RefreshCw, CheckCircle2, Clock,
  BarChart3, AlertCircle, Lightbulb, Target, AlertTriangle,
  X, ChevronRight, Users, Shield, Building2, Newspaper,
  Calculator, ArrowUpCircle, ArrowDownCircle, Briefcase
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DeepAnalysisPanelProps {
  stockCode: string
  stockName: string
  industry?: string | null
}

// Agent 定义
const AGENTS = [
  { 
    id: 'market_data', 
    name: '市场数据分析师', 
    description: '收集和预处理市场数据',
    icon: BarChart3,
    color: 'bg-blue-500',
    colorLight: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  { 
    id: 'technical_analysis', 
    name: '技术分析师', 
    description: '分析价格趋势、成交量、动量等技术指标',
    icon: TrendingUp,
    color: 'bg-purple-500',
    colorLight: 'bg-purple-50 text-purple-700 border-purple-200'
  },
  { 
    id: 'fundamental_analysis', 
    name: '基本面分析师', 
    description: '分析公司财务指标和经营状况',
    icon: Building2,
    color: 'bg-green-500',
    colorLight: 'bg-green-50 text-green-700 border-green-200'
  },
  { 
    id: 'sentiment_analysis', 
    name: '情绪分析师', 
    description: '分析市场新闻和舆论数据',
    icon: Newspaper,
    color: 'bg-orange-500',
    colorLight: 'bg-orange-50 text-orange-700 border-orange-200'
  },
  { 
    id: 'valuation_analysis', 
    name: '估值分析师', 
    description: '评估股票的内在价值',
    icon: Calculator,
    color: 'bg-cyan-500',
    colorLight: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  },
  { 
    id: 'bull_researcher', 
    name: '多头研究员', 
    description: '从多头角度进行深入研究',
    icon: ArrowUpCircle,
    color: 'bg-emerald-500',
    colorLight: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  { 
    id: 'bear_researcher', 
    name: '空头研究员', 
    description: '从空头角度进行深入研究',
    icon: ArrowDownCircle,
    color: 'bg-red-500',
    colorLight: 'bg-red-50 text-red-700 border-red-200'
  },
  { 
    id: 'debate_room', 
    name: '辩论室', 
    description: '综合多空观点进行辩论分析',
    icon: Users,
    color: 'bg-indigo-500',
    colorLight: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  { 
    id: 'risk_management', 
    name: '风险管理师', 
    description: '评估风险并设定交易限制',
    icon: Shield,
    color: 'bg-amber-500',
    colorLight: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  { 
    id: 'portfolio_management', 
    name: '投资组合经理', 
    description: '综合所有信号做出最终决策',
    icon: Briefcase,
    color: 'bg-pink-500',
    colorLight: 'bg-pink-50 text-pink-700 border-pink-200'
  },
]

type AgentStatus = 'pending' | 'running' | 'completed' | 'error'

interface AgentResult {
  status: AgentStatus
  signal?: 'bullish' | 'bearish' | 'neutral'
  confidence?: number
  summary?: string
  reasoning?: string
  details?: Record<string, any>
}

interface AnalysisResult {
  action: string
  confidence: number
  reasoning: string
  agent_signals: Array<{
    agent_name: string
    signal: string
    confidence: number
    summary?: string
    reasoning?: string
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

const getCacheKey = (stockCode: string) => `deep_analysis_v5_${stockCode}`

// 安全地访问localStorage
function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    // 隐私模式或存储不可用时返回null
    return null
  }
}

function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    // 静默失败
    return false
  }
}

// 将任意值转换为可显示的字符串
function toDisplayString(value: any): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return '[对象]'
    }
  }
  return String(value)
}

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
  
  // 选中的Agent用于查看详情
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  
  const pollingRef = useRef<NodeJS.Timeout | null>(null)
  const pollingCountRef = useRef(0)
  const MAX_POLLING_ATTEMPTS = 150 // 5分钟超时 (150 * 2秒)

  // 从缓存加载
  useEffect(() => {
    if (!stockCode) return
    const cached = safeGetLocalStorage(getCacheKey(stockCode))
    if (cached) {
      try {
        const data = JSON.parse(cached)
        if (data.finalDecision && data.timestamp) {
          const cacheAge = Date.now() - data.timestamp
          if (cacheAge < 4 * 60 * 60 * 1000) { // 4小时缓存
            setFinalDecision(data.finalDecision)
            setAgentResults(data.agentResults || {})
            setUsedCache(true)
            return
          }
        }
      } catch (e) {
        console.error('Failed to parse cache:', e)
      }
    }
    setFinalDecision(null)
    setAgentResults({})
    setUsedCache(false)
  }, [stockCode])

  // 清理轮询
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  // 同步AI配置到后端
  const syncAIConfig = useCallback(async () => {
    try {
      const saved = localStorage.getItem('ai_config')
      if (!saved) return false

      const config = JSON.parse(saved)

      // 构建后端需要的配置格式
      const backendConfig = {
        providers: {} as Record<string, { api_key: string }>,
        default_provider: config.defaultProvider || 'zhipu'
      }

      // 转换配置格式
      if (config.zhipu?.apiKey) {
        backendConfig.providers.zhipu = { api_key: config.zhipu.apiKey }
      }
      if (config.tencent?.apiKey) {
        backendConfig.providers.hunyuan = { api_key: config.tencent.apiKey }
      }
      if (config.aliyun?.apiKey) {
        backendConfig.providers.qwen = { api_key: config.aliyun.apiKey }
      }
      if (config.byteDance?.apiKey) {
        backendConfig.providers.deepseek = { api_key: config.byteDance.apiKey }
      }

      // 如果没有任何provider配置，返回false
      if (Object.keys(backendConfig.providers).length === 0) {
        return false
      }

      // 同步到后端
      const response = await fetch('/api/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backendConfig)
      })

      return response.ok
    } catch (e) {
      console.error('同步AI配置失败:', e)
      return false
    }
  }, [])

  // 启动分析
  const startAnalysis = useCallback(async () => {
    if (isRunning || !stockCode) return

    // 先同步AI配置到后端
    await syncAIConfig()

    setIsRunning(true)
    setProgress(0)
    setFinalDecision(null)
    setUsedCache(false)
    setError(null)
    setAgentResults({})
    setSelectedAgent(null)
    pollingCountRef.current = 0

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
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || '启动分析失败')
      }
      
      const data = await response.json()
      if (!data.task_id) {
        throw new Error('未获取到任务ID')
      }
      
      setTaskId(data.task_id)
      
      // 开始轮询
      let currentProgress = 0
      pollingRef.current = setInterval(async () => {
        pollingCountRef.current++
        
        // 超时检查
        if (pollingCountRef.current > MAX_POLLING_ATTEMPTS) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          setError('分析超时，请稍后重试')
          setIsRunning(false)
          return
        }
        
        try {
          const statusResponse = await fetch(`/api/agent/analyze?taskId=${data.task_id}`)

          if (!statusResponse.ok) {
            // 如果是404，说明任务不存在（后端重启了），需要重新创建任务
            if (statusResponse.status === 404) {
              console.log('任务不存在，重新创建任务...')
              if (pollingRef.current) {
                clearInterval(pollingRef.current)
                pollingRef.current = null
              }
              // 清除旧缓存
              safeSetLocalStorage(getCacheKey(stockCode), '')
              // 重新启动分析
              setIsRunning(false)
              setTimeout(() => startAnalysis(), 1000)
              return
            }
            throw new Error('获取状态失败')
          }

          const statusData = await statusResponse.json()

          if (statusData.status === 'completed') {
            const resultResponse = await fetch(`/api/agent/result/${data.task_id}`)

            if (!resultResponse.ok) {
              // 如果是404，说明结果不存在（后端可能重启了），需要重新分析
              if (resultResponse.status === 404) {
                console.log('结果不存在，重新创建任务...')
                if (pollingRef.current) {
                  clearInterval(pollingRef.current)
                  pollingRef.current = null
                }
                // 清除旧缓存
                safeSetLocalStorage(getCacheKey(stockCode), '')
                // 重新启动分析
                setIsRunning(false)
                setTimeout(() => startAnalysis(), 1000)
                return
              }
              throw new Error('获取结果失败')
            }
            
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
                    summary: signal.summary,
                    reasoning: signal.reasoning || signal.summary,
                    details: signal.details || {}
                  }
                })
              }
              setAgentResults(agentResultsMap)
              setProgress(100)
              
              // 保存缓存
              safeSetLocalStorage(getCacheKey(stockCode), JSON.stringify({
                finalDecision: resultData.decision,
                agentResults: agentResultsMap,
                timestamp: Date.now()
              }))
            }
            
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            setIsRunning(false)
            setCurrentAgent(null)
            
          } else if (statusData.status === 'failed') {
            setError(statusData.error || '分析失败')
            if (pollingRef.current) {
              clearInterval(pollingRef.current)
              pollingRef.current = null
            }
            setIsRunning(false)
          } else if (statusData.status === 'running') {
            currentProgress = Math.min(currentProgress + 10, 90)
            setProgress(currentProgress)
            if (statusData.current_agent) {
              setCurrentAgent(statusData.current_agent)
              // 更新当前运行的Agent状态
              setAgentResults(prev => ({
                ...prev,
                [statusData.current_agent]: { status: 'running' }
              }))
            }
          }
        } catch (pollError) {
          console.error('Polling error:', pollError)
          // 记录错误但不中断轮询，允许重试
        }
      }, 2000)
      
    } catch (e: any) {
      console.error('Start analysis error:', e)
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

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'buy': return <Badge className="bg-green-500 text-white">买入</Badge>
      case 'sell': return <Badge className="bg-red-500 text-white">卖出</Badge>
      default: return <Badge className="bg-gray-500 text-white">持有</Badge>
    }
  }

  const getSignalBadge = (signal?: string) => {
    switch (signal) {
      case 'bullish': return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">看涨</Badge>
      case 'bearish': return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">看跌</Badge>
      default: return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">中性</Badge>
    }
  }

  // 获取选中的Agent详情
  const selectedAgentData = selectedAgent ? AGENTS.find(a => a.id === selectedAgent) : null
  const selectedAgentResult = selectedAgent ? agentResults[selectedAgent] : null

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
              {currentAgent ? `正在执行: ${AGENTS.find(a => a.id === currentAgent)?.name || currentAgent}` : '准备就绪'}
            </div>
          </div>
        )}
        
        {/* Agent卡片网格 - 可点击，显示信号 */}
        <div className="grid grid-cols-5 gap-1.5 mt-3">
          {AGENTS.map(agent => {
            const result = agentResults[agent.id]
            const status = result?.status || 'pending'
            const isSelected = selectedAgent === agent.id
            const Icon = agent.icon

            // 获取信号信息
            const signal = result?.signal
            const confidence = result?.confidence
            const signalColor = signal === 'bullish' ? 'text-red-500' :
                               signal === 'bearish' ? 'text-green-500' : 'text-yellow-500'

            return (
              <div
                key={agent.id}
                onClick={() => status === 'completed' && setSelectedAgent(isSelected ? null : agent.id)}
                className={cn(
                  "flex flex-col items-center justify-center p-2 rounded-lg text-xs transition-all border",
                  status === 'pending' && "bg-muted/30 text-muted-foreground border-transparent",
                  status === 'running' && "bg-primary/10 text-primary border-primary/30 animate-pulse",
                  status === 'completed' && "cursor-pointer hover:shadow-md",
                  status === 'completed' && !isSelected && `${agent.colorLight} hover:shadow-sm`,
                  status === 'completed' && isSelected && `${agent.color} text-white shadow-md`,
                  status === 'error' && "bg-red-50 text-red-700 border-red-200"
                )}
                title={`${agent.name}: ${agent.description}`}
              >
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center mb-1",
                  status === 'completed' && !isSelected && agent.color,
                  status === 'completed' && isSelected && "bg-white/20",
                  status === 'pending' && "bg-muted",
                  status === 'running' && "bg-primary/20",
                  status === 'error' && "bg-red-100"
                )}>
                  {status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-white" /> :
                   status === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> :
                   status === 'error' ? <AlertCircle className="h-4 w-4" /> :
                   <Icon className="h-4 w-4" />}
                </div>
                <span className="text-[10px] font-medium truncate w-full text-center">
                  {agent.name.replace('分析师', '').replace('师', '').replace('员', '')}
                </span>
                {/* 显示信号和置信度 */}
                {status === 'completed' && confidence !== undefined && (
                  <span className={cn("text-[9px] font-bold", isSelected ? "text-white/90" : signalColor)}>
                    {(confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 分析结果区域 */}
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Agent详情面板 */}
          {selectedAgentData && selectedAgentResult && (
            <div className="p-3 rounded-lg border-2 shadow-sm animate-in fade-in-0 slide-in-from-top-2 duration-200"
                 style={{ borderColor: selectedAgentData.color.replace('bg-', '') }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", selectedAgentData.color)}>
                    <selectedAgentData.icon className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <h4 className="text-sm font-medium">{selectedAgentData.name}</h4>
                    <p className="text-xs text-muted-foreground">{selectedAgentData.description}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setSelectedAgent(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">信号:</span>
                    {getSignalBadge(selectedAgentResult.signal)}
                  </div>
                  {selectedAgentResult.confidence !== undefined && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">置信度:</span>
                      <Progress value={selectedAgentResult.confidence * 100} className="w-16 h-2" />
                      <span className={cn("text-xs font-medium", getScoreColor(selectedAgentResult.confidence))}>
                        {(selectedAgentResult.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                  )}
                </div>
                
                {selectedAgentResult.reasoning && (
                  <div className="p-2.5 rounded-lg bg-muted/30">
                    <div className="text-xs font-medium mb-1">详细分析</div>
                    <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-60">{toDisplayString(selectedAgentResult.reasoning)}</pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {finalDecision ? (
            <>
              {/* 最终决策 */}
              <div className="p-3 rounded-lg border bg-gradient-to-r from-blue-50/50 to-purple-50/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">投资建议</span>
                  </div>
                  {getActionBadge(finalDecision.action)}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                  <span>置信度: <span className={cn("font-medium", getScoreColor(finalDecision.confidence))}>
                    {(finalDecision.confidence * 100).toFixed(0)}%
                  </span></span>
                  <Progress value={finalDecision.confidence * 100} className="flex-1 h-1.5" />
                </div>
                {finalDecision.reasoning && (
                  <div className="mt-2 p-2 rounded bg-white/50 text-sm whitespace-pre-wrap">{toDisplayString(finalDecision.reasoning)}</div>
                )}
              </div>

              {finalDecision.risk_assessment && (
                <div className="p-3 rounded-lg border bg-orange-50/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-orange-600" />
                    <span className="text-xs font-medium text-orange-700">风险提示</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-white/50">
                      <span className="text-muted-foreground">风险等级：</span>
                      <span className="font-medium">{finalDecision.risk_assessment.level}</span>
                    </div>
                    <div className="p-2 rounded bg-white/50">
                      <span className="text-muted-foreground">止损位：</span>
                      <span className="font-medium text-green-600">{(finalDecision.risk_assessment.stop_loss * 100).toFixed(0)}%</span>
                    </div>
                    <div className="p-2 rounded bg-white/50">
                      <span className="text-muted-foreground">止盈位：</span>
                      <span className="font-medium text-red-600">{(finalDecision.risk_assessment.take_profit * 100).toFixed(0)}%</span>
                    </div>
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
