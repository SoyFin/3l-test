'use client'

import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, Calendar, LineChart } from 'lucide-react'
import { MomentumRankingItem } from '@/types'

interface MomentumPanelProps {
  ranking: MomentumRankingItem[]
  loading: boolean
  selectedIndustry: string | null
  onSelectIndustry: (industry: string) => void
  trendData?: Record<string, { weekDate: string; score: number }[]>
}

// 简单的趋势折线图
function MiniLineChart({ scores, color = '#3b82f6' }: { scores: number[], color?: string }) {
  if (!scores || scores.length === 0) return null

  const maxScore = Math.max(...scores, 1)
  const minScore = Math.min(...scores, 0)
  const range = maxScore - minScore || 1

  const width = 80
  const height = 24
  const padding = 2

  const points = scores.slice(-8).map((score, i) => {
    const x = padding + (i / Math.max(scores.slice(-8).length - 1, 1)) * (width - 2 * padding)
    const y = height - padding - ((score - minScore) / range) * (height - 2 * padding)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // 生成路径
  const pathD = scores.slice(-8).map((score, i) => {
    const x = padding + (i / Math.max(scores.slice(-8).length - 1, 1)) * (width - 2 * padding)
    const y = height - padding - ((score - minScore) / range) * (height - 2 * padding)
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 最后一个点 */}
      {scores.length > 0 && (
        <circle
          cx={padding + ((scores.slice(-8).length - 1) / Math.max(scores.slice(-8).length - 1, 1)) * (width - 2 * padding)}
          cy={height - padding - ((scores.slice(-8)[scores.slice(-8).length - 1] - minScore) / range) * (height - 2 * padding)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  )
}

export default function MomentumPanel({
  ranking,
  loading,
  selectedIndustry,
  onSelectIndustry,
  trendData = {}
}: MomentumPanelProps) {
  
  const getScoreColor = (color: string) => {
    switch (color) {
      case 'orange':
        return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300'
      case 'green':
        return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  const getContinuousWeeksBadge = (weeks: number) => {
    if (weeks === 0) return null
    
    let color = 'bg-blue-100 text-blue-800'
    if (weeks >= 4) color = 'bg-purple-100 text-purple-800'
    if (weeks >= 8) color = 'bg-amber-100 text-amber-800'
    
    return (
      <Badge variant="outline" className={`text-xs ${color}`}>
        {weeks === 1 ? '新上榜' : `${weeks}周`}
      </Badge>
    )
  }

  return (
    <Card className="h-full rounded-none border-0 flex flex-col">
      <CardHeader className="pb-2 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4" />
          动量排行榜
        </CardTitle>
        {ranking.length > 0 && (
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            数据日期：{ranking[0].weekDate}
          </p>
        )}
      </CardHeader>
      
      <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
        {/* 上半部分：排行榜列表 */}
        <div className="flex-shrink-0" style={{ maxHeight: '45%' }}>
          <ScrollArea className="h-full">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              </div>
            ) : ranking.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-muted-foreground px-4">
                <p>暂无数据</p>
                <p className="text-xs mt-1">请上传周度数据</p>
              </div>
            ) : (
              <div className="px-3 pb-2 space-y-0.5">
                {ranking.map((item, index) => (
                  <div
                    key={item.industry}
                    className={`
                      p-2 rounded cursor-pointer transition-all
                      ${selectedIndustry === item.industry 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'hover:bg-muted/50 border border-transparent'}
                    `}
                    onClick={() => onSelectIndustry(item.industry)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium w-4 text-center text-muted-foreground">
                          {index + 1}
                        </span>
                        <span className="text-sm font-medium truncate max-w-[80px]">{item.industry}</span>
                      </div>
                      
                      <div className="flex items-center gap-1">
                        {getContinuousWeeksBadge(item.continuousWeeks)}
                        <Badge 
                          variant="outline" 
                          className={`font-mono text-xs ${getScoreColor(item.color)}`}
                        >
                          {item.score.toFixed(1)}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="mt-0.5 text-xs text-muted-foreground flex items-center gap-2">
                      <span>上榜{item.count}</span>
                      <span>成分{item.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
        
        {/* 分割线 */}
        <div className="border-t flex-shrink-0"></div>
        
        {/* 下半部分：趋势图 */}
        <div className="flex-shrink-0 pt-2 px-3 pb-3 overflow-hidden" style={{ maxHeight: '40%' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <LineChart className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">板块动量趋势</span>
          </div>
          
          {ranking.length > 0 ? (
            <div className="space-y-1">
              {ranking.slice(0, 5).map((item, idx) => {
                const trend = trendData[item.industry] || []
                const scores = trend.map(t => t.score).reverse()
                
                // 不同颜色
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
                const color = colors[idx % colors.length]
                
                return (
                  <div 
                    key={item.industry}
                    className="flex items-center justify-between p-1.5 rounded bg-muted/30 hover:bg-muted/50 cursor-pointer"
                    onClick={() => onSelectIndustry(item.industry)}
                  >
                    <span className="text-xs font-medium w-14 truncate">{item.industry}</span>
                    <MiniLineChart scores={scores} color={color} />
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">暂无趋势数据</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
