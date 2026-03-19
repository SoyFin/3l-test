'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  ExternalLink, BarChart3, 
  FileText, Sparkles, Zap, Newspaper, Building2, Loader2, RefreshCw, Copy, Check, GripHorizontal
} from 'lucide-react'
import NewsPanel from '@/components/NewsPanel'
import { cn } from '@/lib/utils'

interface StockDetailPanelProps {
  stockCode: string | null
  stockName: string | null
  industry?: string | null
  onOpenAISettings?: () => void
}

// AI平台列表
const aiPlatforms = [
  { name: '同花顺', url: 'https://www.iwencai.com/unifiedwap/search/result' },
  { name: '豆包', url: 'https://www.doubao.com/' },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn/' },
  { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa' },
]

// 研报平台列表
const getResearchUrls = (keyword: string) => {
  const encodedKeyword = encodeURIComponent(keyword)
  return [
    { name: '慧博投研', url: `https://www.hibor.com.cn/newweb/HuiSou/s?gjc=${encodedKeyword}&sslb=1&sjfw=24&cxzd=qb%28qw%29&px=zh&bgys=&gs=&sdhy=&sdgs=&sdhgcl=&mhss=&hy=&gp=` },
    { name: '萝卜投研', url: `https://robo.datayes.com/v2/search?query=${encodedKeyword}&type=EXTERNALREPORT` },
  ]
}

// 个股分析提示词
const getStockPrompt = (code: string, name: string) => {
  return `请帮我分析【${name}(${code})】这只股票，重点关注：

1. **公司概况**：主营业务、行业地位、核心竞争力
2. **财务分析**：营收增长、利润趋势、ROE、负债情况
3. **估值分析**：PE、PB水平，与行业对比
4. **资金动向**：机构持仓变化、北向资金态度、融资余额
5. **催化剂**：近期是否有政策利好、业绩预告、重大事件
6. **风险提示**：商誉、质押、解禁、诉讼等风险因素

请用结构化的方式输出分析结果，标注信息来源。`
}

// 默认高度配置
const DEFAULT_HEIGHTS = {
  aiAnalysis: 160
}

// 最小/最大高度限制
const HEIGHT_LIMITS = {
  aiAnalysis: { min: 80, max: 300 }
}

// 空状态组件
function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center bg-muted/10">
      <div className="text-center text-muted-foreground p-6">
        <Building2 className="h-16 w-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg font-medium">选择个股查看详情</p>
        <p className="text-sm mt-1">点击中间列表中的股票查看详细信息</p>
      </div>
    </div>
  )
}

export default function StockDetailPanel({
  stockCode,
  stockName,
  industry,
  onOpenAISettings
}: StockDetailPanelProps) {
  const [stockData, setStockData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('info')
  
  // AI分析状态
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string>('')
  const [aiError, setAiError] = useState<string>('')
  const [aiFromCache, setAiFromCache] = useState(false)
  const [copied, setCopied] = useState(false)
  const [config, setConfig] = useState<any>(null)
  
  // AI分析区域高度
  const [aiHeight, setAiHeight] = useState(DEFAULT_HEIGHTS.aiAnalysis)
  const [isDraggingAi, setIsDraggingAi] = useState(false)
  const aiRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  // 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_config')
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch {
        setConfig(null)
      }
    }
  }, [])
  
  // 从localStorage加载保存的高度
  useEffect(() => {
    const savedHeight = localStorage.getItem('panel_stock_ai_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.aiAnalysis.min && h <= HEIGHT_LIMITS.aiAnalysis.max) {
        setAiHeight(h)
      }
    }
  }, [])
  
  // 保存高度
  const saveHeight = useCallback((height: number) => {
    localStorage.setItem('panel_stock_ai_height', height.toString())
  }, [])
  
  // 拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingAi(true)
    startYRef.current = e.clientY
    startHeightRef.current = aiHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [aiHeight])
  
  useEffect(() => {
    if (!isDraggingAi) return
    
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY
      let newHeight = startHeightRef.current + deltaY
      newHeight = Math.max(HEIGHT_LIMITS.aiAnalysis.min, Math.min(HEIGHT_LIMITS.aiAnalysis.max, newHeight))
      setAiHeight(newHeight)
    }
    
    const handleMouseUp = () => {
      setIsDraggingAi(false)
      saveHeight(aiHeight)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingAi, aiHeight, saveHeight])

  useEffect(() => {
    if (!stockCode) {
      setStockData(null)
      setAiResult('')
      setAiError('')
      return
    }

    const fetchStockData = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/stocks?code=${stockCode}`)
        const data = await response.json()
        setStockData(data)
      } catch (error) {
        console.error('Fetch stock data error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStockData()
  }, [stockCode])

  // 当股票变化时自动触发AI分析
  useEffect(() => {
    if (stockCode && stockName && config) {
      const hasApiKey = config.zhipu?.apiKey || config.aliyun?.apiKey || 
                        config.byteDance?.apiKey || config.tencent?.apiKey
      if (hasApiKey) {
        const timer = setTimeout(() => {
          runAIAnalysis()
        }, 500)
        return () => clearTimeout(timer)
      }
    }
  }, [stockCode, stockName, config])

  // 执行AI分析
  const runAIAnalysis = async (forceRefresh = false) => {
    const provider = config?.defaultProvider || 'zhipu'
    const providerConfig = config?.[provider]
    
    if (!providerConfig?.apiKey) {
      return
    }

    setAiLoading(true)
    setAiError('')

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'stock',
          name: stockName,
          data: { code: stockCode, name: stockName, industry, fundamentals: stockData?.fundamentals },
          config: { [provider]: providerConfig, defaultProvider: provider },
          provider,
          forceRefresh
        })
      })

      const result = await response.json()

      if (result.success) {
        setAiResult(result.analysis)
        setAiFromCache(result.fromCache || false)
      } else {
        setAiError(result.error || '分析失败')
      }
    } catch (err: any) {
      setAiError(err.message || '网络请求失败')
    } finally {
      setAiLoading(false)
    }
  }

  // 复制结果
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(aiResult)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  // 空状态
  if (!stockCode || !stockName) {
    return <EmptyState />
  }

  const stockPrompt = getStockPrompt(stockCode, stockName)
  const researchUrls = getResearchUrls(stockName)

  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="border-b bg-muted/30 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-base">{stockName}</h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{stockCode}</span>
                {industry && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span>{industry}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI分析结果区域 - 可调节高度 */}
      <div 
        ref={aiRef}
        className="flex-shrink-0 px-4 py-2 border-b bg-muted/5 relative"
        style={{ height: aiHeight }}
      >
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs font-medium">AI诊断</span>
            {aiFromCache && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">缓存</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {aiResult && !aiLoading && (
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={handleCopy} title="复制">
                {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-5 w-5 p-0" 
              onClick={() => runAIAnalysis(true)}
              disabled={aiLoading}
              title="重新分析"
            >
              <RefreshCw className={`h-3 w-3 ${aiLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        
        {aiLoading ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">AI诊断中...</span>
          </div>
        ) : aiError ? (
          <div className="text-xs text-red-600 py-1">{aiError}</div>
        ) : aiResult ? (
          <ScrollArea className="h-[calc(100%-28px)]">
            <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed pr-2">
              {aiResult}
            </div>
          </ScrollArea>
        ) : (
          <div className="text-xs text-muted-foreground py-2">
            {config?.zhipu?.apiKey || config?.aliyun?.apiKey ? '准备分析...' : '请先配置AI平台'}
          </div>
        )}
        
        {/* 拖拽手柄 */}
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group z-10",
            "flex items-center justify-center",
            "hover:bg-primary/20 transition-colors",
            isDraggingAi && "bg-primary/40"
          )}
          onMouseDown={handleMouseDown}
          title="拖拽调整高度"
        >
          <GripHorizontal className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
        </div>
      </div>

      {/* 快捷操作栏 */}
      <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/10">
        {/* AI平台 */}
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {aiPlatforms.map((platform) => {
            const url = platform.name === '同花顺' 
              ? `${platform.url}?w=${encodeURIComponent(stockPrompt)}` 
              : platform.url
            return (
              <Button
                key={platform.name}
                variant="outline"
                size="sm"
                className="h-6 gap-1 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                onClick={() => window.open(url, '_blank')}
              >
                <Sparkles className="h-3 w-3" />
                {platform.name}
                <ExternalLink className="h-2.5 w-2.5 opacity-50" />
              </Button>
            )
          })}
        </div>
        
        {/* 研报网站 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {researchUrls.map((platform) => (
            <Button
              key={platform.name}
              variant="outline"
              size="sm"
              className="h-6 gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200"
              onClick={() => window.open(platform.url, '_blank')}
            >
              <FileText className="h-3 w-3" />
              {platform.name}
              <ExternalLink className="h-2.5 w-2.5 opacity-50" />
            </Button>
          ))}
        </div>
      </div>

      {/* Tab切换 */}
      <div className="flex-shrink-0 px-4 pt-2 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="h-8">
            <TabsTrigger value="info" className="text-xs px-3">基本信息</TabsTrigger>
            <TabsTrigger value="news" className="text-xs px-3">
              <Newspaper className="h-3 w-3 mr-1" />
              新闻
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : activeTab === 'info' ? (
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {stockData?.data?.fundamental ? (
                <>
                  {/* 核心指标 */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground">营收增长</div>
                      <div className="text-base font-bold">
                        {stockData.data.fundamental.revenueGrowth 
                          ? `${stockData.data.fundamental.revenueGrowth > 0 ? '+' : ''}${stockData.data.fundamental.revenueGrowth.toFixed(1)}%` 
                          : '-'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground">利润增长</div>
                      <div className="text-base font-bold">
                        {stockData.data.fundamental.profitGrowth 
                          ? `${stockData.data.fundamental.profitGrowth > 0 ? '+' : ''}${stockData.data.fundamental.profitGrowth.toFixed(1)}%` 
                          : '-'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground">ROE</div>
                      <div className="text-base font-bold">
                        {stockData.data.fundamental.roe 
                          ? `${stockData.data.fundamental.roe.toFixed(1)}%` 
                          : '-'}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/50">
                      <div className="text-xs text-muted-foreground">毛利率</div>
                      <div className="text-base font-bold">
                        {stockData.data.fundamental.grossMargin 
                          ? `${stockData.data.fundamental.grossMargin.toFixed(1)}%` 
                          : '-'}
                      </div>
                    </div>
                  </div>

                  {/* 估值指标 */}
                  <div className="p-2.5 rounded-lg border">
                    <div className="text-xs font-medium mb-1.5">估值指标</div>
                    <div className="grid grid-cols-4 gap-1 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">PE</div>
                        <div className="font-mono">{stockData.data.fundamental.pe?.toFixed(1) || '-'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">PB</div>
                        <div className="font-mono">{stockData.data.fundamental.pb?.toFixed(1) || '-'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">基金持股</div>
                        <div className="font-mono">{stockData.data.fundamental.fundHolding?.toFixed(1) || '-'}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">北向持股</div>
                        <div className="font-mono">{stockData.data.fundamental.northHolding?.toFixed(2) || '-'}%</div>
                      </div>
                    </div>
                  </div>

                  {/* 风险指标 */}
                  <div className="p-2.5 rounded-lg border">
                    <div className="text-xs font-medium mb-1.5">风险指标</div>
                    <div className="grid grid-cols-3 gap-1 text-center text-xs">
                      <div>
                        <div className="text-muted-foreground">负债率</div>
                        <div className="font-mono">{stockData.data.fundamental.debtRatio?.toFixed(1) || '-'}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">商誉</div>
                        <div className="font-mono">{stockData.data.fundamental.goodwill?.toFixed(1) || '-'}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">质押比例</div>
                        <div className="font-mono">{stockData.data.fundamental.pledgeRatio?.toFixed(1) || '-'}%</div>
                      </div>
                    </div>
                  </div>

                  {/* 标签 */}
                  {(() => {
                    const tags = stockData.data.fundamental.tags
                    // 处理tags可能是JSON字符串的情况
                    let tagsArray: string[] = []
                    if (tags) {
                      if (typeof tags === 'string') {
                        try {
                          tagsArray = JSON.parse(tags)
                        } catch {
                          tagsArray = []
                        }
                      } else if (Array.isArray(tags)) {
                        tagsArray = tags
                      }
                    }
                    return tagsArray.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {tagsArray.map((tag: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : null
                  })()}
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">暂无基本面数据</p>
                  <p className="text-xs mt-1">点击顶部"更新基本面"按钮获取数据</p>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="p-3 h-full">
            <NewsPanel keyword={stockName} type="stock" />
          </div>
        )}
      </div>
    </div>
  )
}
