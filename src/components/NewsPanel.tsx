'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Loader2, 
  ExternalLink, 
  RefreshCw, 
  Newspaper,
  Sparkles,
  Clock,
  AlertCircle
} from 'lucide-react'

interface NewsItem {
  title: string
  source: string
  date: string
  url: string
  snippet: string
}

interface NewsPanelProps {
  keyword: string
  type?: 'industry' | 'stock'
  onAnalyze?: (news: NewsItem[]) => void
}

export default function NewsPanel({ keyword, type = 'stock', onAnalyze }: NewsPanelProps) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchNews = async () => {
    if (!keyword) return
    
    setLoading(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/news?keyword=${encodeURIComponent(keyword)}&type=${type}&limit=10`)
      const data = await response.json()
      
      if (data.success) {
        setNews(data.news)
        if (data.news.length === 0 && data.message) {
          setError(data.message)
        }
      } else {
        setError(data.error || '获取新闻失败')
      }
    } catch (err: any) {
      setError(err.message || '网络错误')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (keyword) {
      fetchNews()
    }
  }, [keyword])

  // 格式化日期
  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === 'N/A') return '未知'
    try {
      const date = new Date(dateStr)
      return date.toLocaleDateString('zh-CN', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  // 判断新闻情感倾向
  const getNewsSentiment = (title: string, snippet: string) => {
    const text = (title + snippet).toLowerCase()
    const positiveKeywords = ['上涨', '增长', '利好', '突破', '创新高', '盈利', '收获', '利好', '涨停', '大涨']
    const negativeKeywords = ['下跌', '亏损', '利空', '跌停', '下滑', '风险', '警示', '处罚', '暴跌', '大跌']
    
    let positiveCount = 0
    let negativeCount = 0
    
    positiveKeywords.forEach(k => {
      if (text.includes(k)) positiveCount++
    })
    negativeKeywords.forEach(k => {
      if (text.includes(k)) negativeCount++
    })
    
    if (positiveCount > negativeCount) return 'positive'
    if (negativeCount > positiveCount) return 'negative'
    return 'neutral'
  }

  return (
    <Card className="h-full border-0 shadow-none">
      <CardHeader className="pb-2 pt-0 px-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Newspaper className="h-4 w-4" />
            相关新闻
          </CardTitle>
          <div className="flex items-center gap-2">
            {onAnalyze && news.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onAnalyze(news)}
                className="h-7 text-xs"
              >
                <Sparkles className="h-3 w-3 mr-1" />
                AI解读
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchNews}
              disabled={loading}
              className="h-7 w-7 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {keyword && (
          <p className="text-xs text-muted-foreground mt-1">
            搜索：{keyword}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-0 px-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-xs text-muted-foreground">获取新闻中...</span>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-8 text-destructive">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span className="text-xs">{error}</span>
          </div>
        ) : news.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Newspaper className="h-8 w-8 mb-2" />
            <span className="text-xs">暂无相关新闻</span>
          </div>
        ) : (
          <ScrollArea className="h-[350px] pr-2">
            <div className="space-y-2">
              {news.map((item, index) => {
                const sentiment = getNewsSentiment(item.title, item.snippet)
                return (
                  <div 
                    key={index} 
                    className="border rounded-lg p-2 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-medium hover:text-primary line-clamp-2 flex-1"
                      >
                        {item.title}
                      </a>
                      <Badge 
                        variant="outline" 
                        className={`text-[10px] shrink-0 px-1 py-0 ${
                          sentiment === 'positive' ? 'bg-green-50 text-green-700 border-green-200' :
                          sentiment === 'negative' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {sentiment === 'positive' ? '利好' : 
                         sentiment === 'negative' ? '利空' : '中性'}
                      </Badge>
                    </div>
                    {item.snippet && (
                      <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                        {item.snippet}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" />
                        {formatDate(item.date)}
                      </span>
                      <span>•</span>
                      <span>{item.source}</span>
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="ml-auto hover:text-primary"
                      >
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  )
}
