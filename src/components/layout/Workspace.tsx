'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  TrendingUp, Calendar, Newspaper, FileText, Sparkles, 
  ExternalLink, BarChart3, Loader2, RefreshCw, Copy, Check, Zap, GripHorizontal
} from 'lucide-react'
import { IndustryDetail, Stock } from '@/types'
import NewsPanel from '@/components/NewsPanel'
import { cn } from '@/lib/utils'

interface WorkspaceProps {
  industry: string | null
  onSelectStock: (code: string, name: string) => void
  selectedStockCode: string | null
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

// 行业分析提示词
const getIndustryPrompt = (industry: string, data: IndustryDetail | null) => {
  return `请帮我分析【${industry}行业】近期上涨的原因，重点关注：

1. **政策催化**：近期有哪些相关政策？发布时间？影响程度如何？
2. **业绩预期**：行业整体业绩趋势？是否有拐点信号？
3. **事件驱动**：有哪些关键事件推动？事件的时间节点和影响程度？
4. **资金动向**：机构资金、北向资金对该行业的态度？近期流入流出情况？
5. **供需关系**：行业供需格局是否有变化？价格走势如何？
6. **后市展望**：上涨逻辑是否可持续？需要关注哪些风险点？

当前动量数据：
- 动量分值：${data?.score || '未知'}
- 上榜股票：${data?.count || 0}只
- 连续上榜：${data?.continuousWeeks || 0}周

请用结构化的方式输出分析结果，标注信息来源。`
}

// AI分析缓存键
const getAI_CACHE_KEY = (type: string, name: string) => `ai_cache_${type}_${name}`

// 从缓存获取AI分析结果
const getCachedAnalysis = (type: string, name: string): { result: string; timestamp: number } | null => {
  try {
    const cacheKey = getAI_CACHE_KEY(type, name)
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const data = JSON.parse(cached)
      // 缓存有效期：7天
      const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000
      if (Date.now() - data.timestamp < CACHE_DURATION) {
        return data
      }
    }
  } catch (e) {
    console.error('读取缓存失败:', e)
  }
  return null
}

// 保存AI分析结果到缓存
const saveCachedAnalysis = (type: string, name: string, result: string) => {
  try {
    const cacheKey = getAI_CACHE_KEY(type, name)
    localStorage.setItem(cacheKey, JSON.stringify({
      result,
      timestamp: Date.now()
    }))
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

// 默认高度配置
const DEFAULT_HEIGHTS = {
  aiAnalysis: 200
}
const HEIGHT_LIMITS = {
  aiAnalysis: { min: 100, max: 400 }
}

export default function Workspace({
  industry,
  onSelectStock,
  selectedStockCode,
  onOpenAISettings
}: WorkspaceProps) {
  const [detail, setDetail] = useState<IndustryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [newsDialogOpen, setNewsDialogOpen] = useState(false)
  const [news, setNews] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('stocks')
  
  // AI分析状态 - 直接显示在页面上
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<string>('')
  const [aiError, setAiError] = useState<string>('')
  const [aiFromCache, setAiFromCache] = useState(false)
  const [copied, setCopied] = useState(false)
  const [config, setConfig] = useState<any>(null)
  
  // AI分析区域高度
  const [aiHeight, setAiHeight] = useState(DEFAULT_HEIGHTS.aiAnalysis)
  const [isDraggingAi, setIsDraggingAi] = useState(false)
  const startYRef = React.useRef(0)
  const startHeightRef = React.useRef(0)

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
    const savedHeight = localStorage.getItem('panel_industry_ai_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.aiAnalysis.min && h <= HEIGHT_LIMITS.aiAnalysis.max) {
        setAiHeight(h)
      }
    }
  }, [])
  
  // 保存高度
  const saveHeight = (height: number) => {
    localStorage.setItem('panel_industry_ai_height', height.toString())
  }
  
  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingAi(true)
    startYRef.current = e.clientY
    startHeightRef.current = aiHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }
  
  useEffect(() => {
    if (!isDraggingAi) return
    
    const handleMouseMove = (e: MouseEvent) => {
      // 下拉增加高度，上拉减少高度（与左边栏保持一致）
      const deltaY = e.clientY - startYRef.current
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
  }, [isDraggingAi, aiHeight])

  // 当行业变化时加载数据
  useEffect(() => {
    if (!industry) {
      setDetail(null)
      setAiResult('')
      setAiError('')
      return
    }

    const fetchDetail = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/momentum?industry=${encodeURIComponent(industry)}`)
        const data = await response.json()
        setDetail(data)
        
        // 数据加载完成后，检查缓存或触发AI分析
        const cached = getCachedAnalysis('industry', industry)
        if (cached) {
          setAiResult(cached.result)
          setAiFromCache(true)
        } else {
          // 自动触发AI分析
          runAIAnalysis(data)
        }
      } catch (error) {
        console.error('Fetch detail error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [industry])

  // 执行AI分析
  const runAIAnalysis = async (dataOverride?: IndustryDetail | null, forceRefresh = false) => {
    const provider = config?.defaultProvider || 'zhipu'
    const providerConfig = config?.[provider]
    
    if (!providerConfig?.apiKey) {
      setAiError('请先配置AI平台')
      return
    }

    // 如果不是强制刷新，先检查缓存
    if (!forceRefresh) {
      const cached = getCachedAnalysis('industry', industry!)
      if (cached) {
        setAiResult(cached.result)
        setAiFromCache(true)
        return
      }
    }

    setAiLoading(true)
    setAiError('')
    setAiFromCache(false)

    try {
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'industry',
          name: industry,
          data: dataOverride || detail,
          config: { [provider]: providerConfig, defaultProvider: provider },
          provider
        })
      })

      const result = await response.json()

      if (result.success) {
        setAiResult(result.analysis)
        // 保存到缓存
        saveCachedAnalysis('industry', industry!, result.analysis)
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

  const handleAnalyzeNews = (newsData: any[]) => {
    setNews(newsData)
    setNewsDialogOpen(true)
  }

  // 标签处理
  const getPositiveTagBadge = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null
    const positiveKeywords = ['高增', 'ROE', '高毛利', '高景气']
    const positiveTags = tags.filter(tag => positiveKeywords.some(kw => tag.includes(kw)))
    if (positiveTags.length === 0) return null
    return positiveTags.map((tag, i) => (
      <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
        {tag}
      </Badge>
    ))
  }

  const getRiskTagBadge = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null
    const riskKeywords = ['负债', '商誉', '质押']
    const riskTags = tags.filter(tag => riskKeywords.some(kw => tag.includes(kw)))
    if (riskTags.length === 0) return null
    return riskTags.map((tag, i) => (
      <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
        {tag}
      </Badge>
    ))
  }

  const getScoreBadgeClass = (score: number | undefined) => {
    if (score === undefined || score === null) return 'bg-gray-100 text-gray-600'
    if (score >= 7) return 'bg-orange-100 text-orange-800'
    if (score > 1) return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-600'
  }

  // 空状态
  if (!industry) {
    return (
      <div className="h-full flex items-center justify-center bg-muted/10">
        <div className="text-center text-muted-foreground">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">选择一个行业开始分析</p>
          <p className="text-sm mt-1">从左侧动量排行榜点击行业查看详情</p>
        </div>
      </div>
    )
  }

  const industryPrompt = getIndustryPrompt(industry, detail)
  const researchUrls = getResearchUrls(industry)

  return (
    <>
      <div className="h-full flex flex-col">
        {/* 标题栏 */}
        <div className="border-b bg-muted/30 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{industry}</h2>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  {detail && (
                    <>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {detail.weekDate ? new Date(detail.weekDate).toLocaleDateString() : '-'}
                      </span>
                      <span>上榜{detail.count || 0}只</span>
                      <span>成分{detail.total || 0}只</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {detail && (
              <div className="flex items-center gap-2">
                <Badge className={`text-sm font-bold ${getScoreBadgeClass(detail.score)}`}>
                  {typeof detail.score === 'number' ? detail.score.toFixed(1) : '-'}分
                </Badge>
                {detail.continuousWeeks > 0 && (
                  <Badge variant="outline" className="text-sm bg-blue-50 text-blue-700 border-blue-200">
                    连续{detail.continuousWeeks}周
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 内容区 */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : detail ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* AI分析结果区域 - 直接显示在页面上 */}
            <div 
              className="flex-shrink-0 px-4 py-2 border-b bg-muted/5 relative"
              style={{ height: aiHeight }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">AI行业分析</span>
                  {aiFromCache && (
                    <Badge variant="outline" className="text-[10px] h-4 px-1">缓存</Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {aiResult && !aiLoading && (
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} title="复制">
                      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-6 w-6 p-0" 
                    onClick={() => runAIAnalysis(detail, true)}
                    disabled={aiLoading}
                    title="刷新分析"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
              
              {aiLoading ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">AI正在分析中，请稍候...</span>
                </div>
              ) : aiError ? (
                <div className="text-sm text-red-600 py-2">{aiError}</div>
              ) : aiResult ? (
                <ScrollArea className="h-[calc(100%-32px)]">
                  <div className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed pr-2">
                    {aiResult}
                  </div>
                </ScrollArea>
              ) : (
                <div className="text-sm text-muted-foreground py-4">
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
            <div className="flex-shrink-0 px-4 py-2 border-b bg-muted/10 flex items-center gap-2 flex-wrap">
              {aiPlatforms.map((platform) => {
                const url = platform.name === '同花顺' 
                  ? `${platform.url}?w=${encodeURIComponent(industryPrompt)}` 
                  : platform.url
                return (
                  <Button
                    key={platform.name}
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => window.open(url, '_blank')}
                  >
                    <Sparkles className="h-3 w-3" />
                    {platform.name}
                    <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                  </Button>
                )
              })}
              
              <div className="h-4 w-px bg-border mx-1" />
              
              {researchUrls.map((platform) => (
                <Button
                  key={platform.name}
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                  onClick={() => window.open(platform.url, '_blank')}
                >
                  <FileText className="h-3 w-3" />
                  {platform.name}
                  <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                </Button>
              ))}
            </div>

            {/* Tab切换 */}
            <div className="flex-shrink-0 px-4 pt-3 border-b">
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="stocks" className="text-xs px-4">
                    成分股 ({detail.count || 0})
                  </TabsTrigger>
                  <TabsTrigger value="news" className="text-xs px-4">
                    <Newspaper className="h-3 w-3 mr-1" />
                    相关新闻
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 内容 */}
            <div className="flex-1 overflow-hidden">
              {activeTab === 'stocks' ? (
                <ScrollArea className="h-full">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-10 text-center py-2">#</TableHead>
                        <TableHead className="w-20 py-2">代码</TableHead>
                        <TableHead className="py-2">名称</TableHead>
                        <TableHead className="w-24 text-right py-2">20日涨幅</TableHead>
                        <TableHead className="py-2">标签</TableHead>
                        <TableHead className="w-10 py-2"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(detail.stocks || []).map((stock, index) => (
                        <TableRow 
                          key={stock.code} 
                          className={cn(
                            "cursor-pointer",
                            selectedStockCode === stock.code && "bg-primary/5"
                          )}
                          onClick={() => onSelectStock(stock.code, stock.name)}
                        >
                          <TableCell className="text-center text-muted-foreground py-2">
                            {index + 1}
                          </TableCell>
                          <TableCell className="font-mono text-xs py-2">
                            {stock.code}
                          </TableCell>
                          <TableCell className="font-medium py-2">
                            {stock.name}
                          </TableCell>
                          <TableCell className="text-right font-mono py-2">
                            <span className={stock.change > 0 ? 'text-red-600' : stock.change < 0 ? 'text-green-600' : ''}>
                              {stock.change > 0 ? '+' : ''}{typeof stock.change === 'number' ? stock.change.toFixed(2) : '-'}%
                            </span>
                          </TableCell>
                          <TableCell className="py-2">
                            <div className="flex flex-wrap gap-0.5">
                              {getPositiveTagBadge(stock.fundamentals?.tags as string[])}
                              {getRiskTagBadge(stock.fundamentals?.tags as string[])}
                            </div>
                          </TableCell>
                          <TableCell className="py-2">
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              ) : (
                <div className="p-4 h-full">
                  <NewsPanel keyword={`${industry}行业`} type="industry" onAnalyze={handleAnalyzeNews} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            无数据
          </div>
        )}
      </div>

      {/* 新闻AI解读对话框 */}
      {newsDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium">AI新闻解读</h3>
              <Button variant="ghost" size="sm" onClick={() => setNewsDialogOpen(false)}>关闭</Button>
            </div>
            <ScrollArea className="p-4 h-[60vh]">
              <div className="text-sm whitespace-pre-wrap">{news.map(n => n.title).join('\n')}</div>
            </ScrollArea>
          </div>
        </div>
      )}
    </>
  )
}

import React from 'react'
