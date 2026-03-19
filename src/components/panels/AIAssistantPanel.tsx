'use client'

import { useState, useEffect } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Copy, ExternalLink, Sparkles, Check, FileText, User, Zap, Newspaper } from 'lucide-react'
import { PromptTemplate } from '@/types'
import AIAnalysisDialog from '@/components/AIAnalysisDialog'
import NewsPanel from '@/components/NewsPanel'

interface AIAssistantPanelProps {
  industry: string | null
  stockCode: string | null
  stockName?: string | null
  onOpenAISettings?: () => void
}

// AI平台列表
const aiPlatforms = [
  { name: '同花顺', url: 'https://www.iwencai.com/unifiedwap/search/result' },
  { name: '豆包', url: 'https://www.doubao.com/' },
  { name: '元宝', url: 'https://yuanbao.tencent.com/chat/naQivTmsDa' },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn/' },
]

// 研报平台列表
const getResearchUrls = (stockName: string) => {
  const encodedName = encodeURIComponent(stockName)
  return [
    { name: '慧博投研', url: `https://www.hibor.com.cn/newweb/HuiSou/s?gjc=${encodedName}&sslb=1&sjfw=24&cxzd=qb%28qw%29&px=zh&bgys=&gs=&sdhy=&sdgs=&sdhgcl=&mhss=&hy=&gp=` },
    { name: '萝卜投研', url: `https://robo.datayes.com/v2/search?query=${encodedName}&type=EXTERNALREPORT` },
  ]
}

// 生成个股提示词模板
const generateStockPromptTemplates = (stockCode?: string | null, stockName?: string | null): PromptTemplate[] => {
  const stockDisplayName = stockName || stockCode || 'XX'
  
  return [
    {
      id: 'stock-analysis',
      title: '个股诊断',
      category: 'stock',
      template: `请分析股票【${stockDisplayName}】的投资价值，对照3L体系标准判断：

**一、动量维度**
- 近期走势：是否处于上升趋势？是否明显加速？
- 相对强度：与大盘、同行相比表现如何？

**二、逻辑维度**
- 高景气：所处行业景气度如何？是否处于高增长阶段？
- 高增长：营收/净利润增速情况？（要求>30%）
- 机构认同：基金持股比例？北向资金持股情况？
- 催化剂：是否有业绩预期、政策利好、事件驱动？

**三、风险维度**
- 负债率是否超过50%？
- 商誉占比是否过高？
- 近期是否有解禁、减持计划？

请给出是否符合"3L体系"的综合判断和理由。`
    },
    {
      id: 'financial-deep',
      title: '财务深度',
      category: 'stock',
      template: `请深入分析【${stockDisplayName}】的财务状况：

**盈利能力**
- 营收增速趋势（近三年）
- 净利润增速趋势（近三年）
- 毛利率、净利率变化趋势
- ROE及分解（杜邦分析）

**成长性判断**
- 是否连续两季度增速提升？
- 扣非净利同比是否超过30%？
- 环比是否正增长？

**财务健康度**
- 资产负债率及变化
- 经营性现金流净额
- 应收账款周转率
- 存货周转率

请给出财务评分和风险提示。`
    },
    {
      id: 'valuation',
      title: '估值分析',
      category: 'stock',
      template: `请分析【${stockDisplayName}】的估值情况：

**估值指标**
- 当前PE/PB水平
- 与历史估值对比（分位数）
- 与同行业公司对比

**估值合理性**
- 成长性是否支撑当前估值
- 未来业绩预期

**投资建议**
- 当前价格是否具备安全边际
- 合理估值区间判断`
    }
  ]
}

export default function AIAssistantPanel({
  industry,
  stockCode,
  stockName,
  onOpenAISettings
}: AIAssistantPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [aiDialogOpen, setAIDialogOpen] = useState(false)
  const [newsDialogOpen, setNewsDialogOpen] = useState(false)
  const [news, setNews] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('analysis')

  useEffect(() => {
    if (stockCode) {
      setTemplates(generateStockPromptTemplates(stockCode, stockName))
    } else {
      setTemplates([])
    }
  }, [stockCode, stockName])

  const handleCopy = async (template: string, id: string) => {
    try {
      await navigator.clipboard.writeText(template)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  // 处理新闻AI分析
  const handleAnalyzeNews = (newsData: any[]) => {
    setNews(newsData)
    setNewsDialogOpen(true)
  }

  // 没有选择个股时显示提示
  if (!stockCode) {
    return (
      <Card className="h-full rounded-none border-0 flex items-center justify-center">
        <CardContent className="text-center text-muted-foreground">
          <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>请从中间列表选择个股</p>
          <p className="text-sm mt-2">查看个股分析选项</p>
        </CardContent>
      </Card>
    )
  }

  const researchUrls = getResearchUrls(stockName || stockCode || '')
  const stockPrompt = generateStockPromptTemplates(stockCode, stockName)[0].template

  return (
    <>
      <Card className="h-full rounded-none border-0 flex flex-col">
        <CardHeader className="pb-2 flex-shrink-0 pt-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <CardTitle className="text-base">{stockName || stockCode}</CardTitle>
          </div>
          <Badge variant="outline" className="w-fit mt-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
            个股分析
          </Badge>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <div className="px-3 pt-2 border-b">
              <TabsList className="h-8">
                <TabsTrigger value="analysis" className="text-xs px-3">
                  <Sparkles className="h-3 w-3 mr-1" />
                  AI分析
                </TabsTrigger>
                <TabsTrigger value="news" className="text-xs px-3">
                  <Newspaper className="h-3 w-3 mr-1" />
                  新闻
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="analysis" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-[calc(100vh-260px)]">
                <div className="p-3 space-y-3">
                  {/* AI一键分析 */}
                  <Button variant="default" size="sm" className="w-full h-8 gap-2" onClick={() => setAIDialogOpen(true)}>
                    <Zap className="h-4 w-4" />
                    AI一键诊断
                  </Button>

                  {/* 提示词模板 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">提示词模板</span>
                    </div>
                    
                    <div className="space-y-1.5">
                      {templates.map((template) => (
                        <div key={template.id} className="p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{template.title}</span>
                            <Button variant="ghost" size="sm" className="h-6 gap-1 text-xs" onClick={() => handleCopy(template.template, template.id)}>
                              {copiedId === template.id ? (
                                <>
                                  <Check className="h-3 w-3 text-green-600" />
                                  已复制
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  复制
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI平台 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">AI平台</span>
                      <span className="text-xs text-muted-foreground">（复制提示词后使用）</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      {aiPlatforms.map((platform) => {
                        const url = platform.name === '同花顺' ? `${platform.url}?w=${encodeURIComponent(stockPrompt)}` : platform.url
                        return (
                          <Button key={platform.name} variant="outline" size="sm" className="justify-start gap-1.5 h-8 text-xs" onClick={() => window.open(url, '_blank')}>
                            {platform.name}
                            <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                          </Button>
                        )
                      })}
                    </div>
                  </div>

                  {/* 研报平台 */}
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-sm font-medium">研报平台</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-1.5">
                      {researchUrls.map((platform) => (
                        <Button key={platform.name} variant="outline" size="sm" className="justify-start gap-1.5 h-8 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 dark:text-amber-200 dark:border-amber-700" onClick={() => window.open(platform.url, '_blank')}>
                          {platform.name}
                          <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                        </Button>
                      ))}
                    </div>
                  </div>
                  
                  {/* 同花顺个股查询 */}
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-xs font-medium mb-1.5">同花顺个股详情</p>
                    <Button variant="default" size="sm" className="w-full h-8 text-xs" onClick={() => window.open(`https://www.iwencai.com/unifiedwap/result?w=${encodeURIComponent(stockName || stockCode || '')}`, '_blank')}>
                      查看个股详情
                      <ExternalLink className="h-3.5 w-3.5 ml-2" />
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="news" className="flex-1 overflow-hidden mt-0">
              <div className="h-[calc(100vh-260px)] p-2">
                <NewsPanel keyword={stockName || stockCode || ''} type="stock" onAnalyze={handleAnalyzeNews} />
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* AI分析对话框 */}
      <AIAnalysisDialog
        open={aiDialogOpen}
        onOpenChange={setAIDialogOpen}
        type="stock"
        name={stockName || stockCode || ''}
        data={{ code: stockCode, name: stockName, industry }}
        onOpenSettings={onOpenAISettings}
      />

      {/* 新闻AI解读对话框 */}
      <AIAnalysisDialog
        open={newsDialogOpen}
        onOpenChange={setNewsDialogOpen}
        type="news"
        name={stockName || stockCode || ''}
        news={news}
        newsType="stock"
        onOpenSettings={onOpenAISettings}
      />
    </>
  )
}
