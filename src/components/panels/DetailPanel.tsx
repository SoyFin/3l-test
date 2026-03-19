'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExternalLink, TrendingUp, BarChart3, Calendar, FileText, Sparkles, Copy, Check, Zap, Newspaper } from 'lucide-react'
import { IndustryDetail, Stock } from '@/types'
import AIAnalysisDialog from '@/components/AIAnalysisDialog'
import NewsPanel from '@/components/NewsPanel'

interface DetailPanelProps {
  industry: string | null
  stockCode: string | null
  onSelectStock: (code: string, name: string) => void
  onOpenAISettings?: () => void
}

// 行业分析提示词
const getIndustryPrompt = (industry: string) => {
  return `请帮我分析【${industry}行业】近期上涨的原因，重点关注：

1. **政策催化**：近期有哪些相关政策？发布时间？影响程度如何？
2. **业绩预期**：行业整体业绩趋势？是否有拐点信号？
3. **事件驱动**：有哪些关键事件推动？事件的时间节点和影响程度？
4. **资金动向**：机构资金、北向资金对该行业的态度？近期流入流出情况？
5. **供需关系**：行业供需格局是否有变化？价格走势如何？
6. **后市展望**：上涨逻辑是否可持续？需要关注哪些风险点？

请用结构化的方式输出分析结果，标注信息来源。`
}

// AI平台列表
const aiPlatforms = [
  { name: '同花顺', url: 'https://www.iwencai.com/unifiedwap/search/result' },
  { name: '豆包', url: 'https://www.doubao.com/' },
  { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa' },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn/' },
]

// 研报平台列表
const getResearchUrls = (keyword: string) => {
  const encodedKeyword = encodeURIComponent(keyword)
  return [
    { name: '慧博投研', url: `https://www.hibor.com.cn/newweb/HuiSou/s?gjc=${encodedKeyword}&sslb=1&sjfw=24&cxzd=qb%28qw%29&px=zh&bgys=&gs=&sdhy=&sdgs=&sdhgcl=&mhss=&hy=&gp=` },
    { name: '萝卜投研', url: `https://robo.datayes.com/v2/search?query=${encodedKeyword}&type=EXTERNALREPORT` },
  ]
}

export default function DetailPanel({
  industry,
  stockCode,
  onSelectStock,
  onOpenAISettings
}: DetailPanelProps) {
  const [detail, setDetail] = useState<IndustryDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [aiDialogOpen, setAIDialogOpen] = useState(false)
  const [newsDialogOpen, setNewsDialogOpen] = useState(false)
  const [news, setNews] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('stocks')

  useEffect(() => {
    if (!industry) {
      setDetail(null)
      return
    }

    const fetchDetail = async () => {
      setLoading(true)
      try {
        const response = await fetch(`/api/momentum?industry=${encodeURIComponent(industry)}`)
        const data = await response.json()
        setDetail(data)
      } catch (error) {
        console.error('Fetch detail error:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDetail()
  }, [industry])

  const handleCopyPrompt = async (prompt: string) => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  // 处理新闻AI分析
  const handleAnalyzeNews = (newsData: any[]) => {
    setNews(newsData)
    setNewsDialogOpen(true)
  }

  // 正面标签（绿色）
  const getPositiveTagBadge = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null
    const positiveKeywords = ['高增', 'ROE', '高毛利', '高景气']
    const positiveTags = tags.filter(tag => positiveKeywords.some(kw => tag.includes(kw)))
    if (positiveTags.length === 0) return null
    return positiveTags.map((tag, i) => (
      <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300">
        {tag}
      </Badge>
    ))
  }

  // 风险标签（红色）
  const getRiskTagBadge = (tags?: string[]) => {
    if (!tags || tags.length === 0) return null
    const riskKeywords = ['负债', '商誉', '质押']
    const riskTags = tags.filter(tag => riskKeywords.some(kw => tag.includes(kw)))
    if (riskTags.length === 0) return null
    return riskTags.map((tag, i) => (
      <Badge key={i} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300">
        {tag}
      </Badge>
    ))
  }

  // 获取分数样式
  const getScoreBadgeClass = (score: number | undefined) => {
    if (score === undefined || score === null) return 'bg-gray-100 text-gray-600'
    if (score >= 7) return 'bg-orange-100 text-orange-800'
    if (score > 1) return 'bg-green-100 text-green-800'
    return 'bg-gray-100 text-gray-600'
  }

  if (!industry) {
    return (
      <Card className="h-full rounded-none border-0 flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请从左侧选择一个行业</p>
          <p className="text-sm mt-2">查看行业详情和入选个股</p>
        </CardContent>
      </Card>
    )
  }

  const industryPrompt = getIndustryPrompt(industry)
  const researchUrls = getResearchUrls(industry)

  return (
    <>
      <Card className="h-full rounded-none border-0 flex flex-col">
        <CardHeader className="pb-1 flex-shrink-0 pt-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-4 w-4" />
              {industry}
            </CardTitle>
            {detail && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${getScoreBadgeClass(detail.score)}`}>
                  {typeof detail.score === 'number' ? detail.score.toFixed(1) : '-'}分
                </Badge>
                {detail.continuousWeeks > 0 && (
                  <Badge variant="outline" className="text-xs bg-blue-100 text-blue-800">
                    {detail.continuousWeeks}周
                  </Badge>
                )}
              </div>
            )}
          </div>
          
          {detail && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {detail.weekDate || '-'}
              </span>
              <span>上榜{detail.count || 0}只</span>
              <span>成分{detail.total || 0}只</span>
            </div>
          )}
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : detail ? (
            <>
              {/* 上半部分：提示词和平台 */}
              <div className="flex-shrink-0 p-2 border-b bg-muted/10">
                {/* AI一键分析按钮 */}
                <Button
                  variant="default"
                  size="sm"
                  className="w-full h-8 mb-2 gap-2"
                  onClick={() => setAIDialogOpen(true)}
                >
                  <Zap className="h-4 w-4" />
                  AI一键分析
                </Button>
                
                {/* 提示词 */}
                <div className="flex items-center gap-1 mb-2">
                  <FileText className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs font-medium">行业分析提示词</span>
                  <Button variant="ghost" size="sm" className="h-5 px-1.5 text-xs" onClick={() => handleCopyPrompt(industryPrompt)}>
                    {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                
                {/* AI平台 */}
                <div className="flex flex-wrap gap-1 mb-1">
                  {aiPlatforms.map((platform) => {
                    const url = platform.name === '同花顺' ? `${platform.url}?w=${encodeURIComponent(industryPrompt)}` : platform.url
                    return (
                      <Button key={platform.name} variant="outline" size="sm" className="h-6 px-2 text-xs gap-1" onClick={() => window.open(url, '_blank')}>
                        <Sparkles className="h-3 w-3" />
                        {platform.name}
                        <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                      </Button>
                    )
                  })}
                </div>
                
                {/* 研报平台 */}
                <div className="flex flex-wrap gap-1">
                  {researchUrls.map((platform) => (
                    <Button key={platform.name} variant="outline" size="sm" className="h-6 px-2 text-xs gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700" onClick={() => window.open(platform.url, '_blank')}>
                      <FileText className="h-3 w-3" />
                      {platform.name}
                      <ExternalLink className="h-2.5 w-2.5 opacity-50" />
                    </Button>
                  ))}
                </div>
              </div>

              {/* Tab切换 */}
              <div className="flex-shrink-0 px-2 pt-2 border-b">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="h-7">
                    <TabsTrigger value="stocks" className="text-xs px-3">
                      成分股 ({detail.count || 0})
                    </TabsTrigger>
                    <TabsTrigger value="news" className="text-xs px-3">
                      <Newspaper className="h-3 w-3 mr-1" />
                      新闻
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 内容区 */}
              <div className="flex-1 overflow-hidden">
                {activeTab === 'stocks' ? (
                  <ScrollArea className="h-full">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-10 text-center py-1.5">#</TableHead>
                          <TableHead className="w-16 py-1.5">代码</TableHead>
                          <TableHead className="py-1.5">名称</TableHead>
                          <TableHead className="w-20 text-right py-1.5">近20日涨幅</TableHead>
                          <TableHead className="py-1.5">标签</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detail.stocks || []).map((stock, index) => (
                          <TableRow key={stock.code} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelectStock(stock.code, stock.name)}>
                            <TableCell className="text-center text-muted-foreground py-1.5">{index + 1}</TableCell>
                            <TableCell className="font-mono text-xs py-1.5">{stock.code}</TableCell>
                            <TableCell className="font-medium py-1.5">
                              {stock.name}
                              <span className="text-xs text-muted-foreground ml-1">→</span>
                            </TableCell>
                            <TableCell className="text-right font-mono py-1.5">
                              <span className={stock.change > 0 ? 'text-red-600' : stock.change < 0 ? 'text-green-600' : ''}>
                                {stock.change > 0 ? '+' : ''}{typeof stock.change === 'number' ? stock.change.toFixed(2) : '-'}%
                              </span>
                            </TableCell>
                            <TableCell className="py-1.5">
                              <div className="flex flex-wrap gap-0.5">
                                {getPositiveTagBadge(stock.fundamentals?.tags as string[])}
                                {getRiskTagBadge(stock.fundamentals?.tags as string[])}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                ) : (
                  <div className="p-2 h-full">
                    <NewsPanel keyword={`${industry}行业`} type="industry" onAnalyze={handleAnalyzeNews} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">无数据</div>
          )}
        </CardContent>
      </Card>

      {/* AI分析对话框 */}
      <AIAnalysisDialog
        open={aiDialogOpen}
        onOpenChange={setAIDialogOpen}
        type="industry"
        name={industry}
        data={detail}
        onOpenSettings={onOpenAISettings}
      />

      {/* 新闻AI解读对话框 */}
      <AIAnalysisDialog
        open={newsDialogOpen}
        onOpenChange={setNewsDialogOpen}
        type="news"
        name={industry}
        news={news}
        newsType="industry"
        onOpenSettings={onOpenAISettings}
      />
    </>
  )
}
