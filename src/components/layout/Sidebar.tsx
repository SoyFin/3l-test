'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { TrendingUp, Lightbulb, ChevronRight, ChevronDown, Sparkles, RefreshCw, Maximize2, GripHorizontal, Target, Zap, AlertCircle, Download } from 'lucide-react'
import { MomentumRankingItem } from '@/types'
import { useToast } from '@/hooks/use-toast'

// ==================== 动量模块相关接口（保留原有）====================
interface SidebarProps {
  ranking: MomentumRankingItem[]
  trendData: Record<string, { weekDate: string; score: number }[]>
  selectedIndustry: string | null
  onSelectIndustry: (industry: string) => void
  loading: boolean
}

// 行业颜色配置
const INDUSTRY_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f97316', '#8b5cf6',
  '#ec4899', '#14b8a6', '#eab308', '#6366f1', '#84cc16'
]

// 默认高度配置
const DEFAULT_HEIGHTS = {
  momentum: 300,
  logic: 280
}

// 最小/最大高度限制
const HEIGHT_LIMITS = {
  momentum: { min: 150, max: 500 },
  logic: { min: 150, max: 400 }
}

// ==================== 戴维斯双击评分相关（新增）====================
const DAVIS_DIMENSIONS = [
  { key: 'performance_inflection', name: '业绩拐点', weight: 0.25, color: '#ef4444' },
  { key: 'valuation_score', name: '估值评分', weight: 0.20, color: '#f97316' },
  { key: 'supply_barrier', name: '供给壁垒', weight: 0.15, color: '#eab308' },
  { key: 'risk_exclusion', name: '风险排除', weight: 0.10, color: '#84cc16' },
  { key: 'logic_change', name: '逻辑质变', weight: 0.15, color: '#22c55e' },
  { key: 'momentum_factor', name: '动量因子', weight: 0.10, color: '#06b6d4' },
  { key: 'northbound_fund', name: '北向资金', weight: 0.05, color: '#8b5cf6' },
] as const

interface DavisScoreItem {
  id: string
  industryName: string
  industryCode: string
  industryType: 'value' | 'cycle' | 'consumption' | 'growth'
  totalScore: number
  dimensions: {
    performance_inflection: number
    valuation_score: number
    supply_barrier: number
    risk_exclusion: number
    logic_change: number
    momentum_factor: number
    northbound_fund: number
  }
  recommendation: string
  keyLogic: string
  riskWarning: string
  scoreDate: string
  createdAt: string
}

const industryTypeLabels: Record<string, string> = {
  value: '价值型',
  cycle: '周期型',
  consumption: '消费型',
  growth: '成长型',
}

const industryTypeColors: Record<string, string> = {
  value: 'bg-blue-100 text-blue-800',
  cycle: 'bg-orange-100 text-orange-800',
  consumption: 'bg-pink-100 text-pink-800',
  growth: 'bg-green-100 text-green-800',
}

// ==================== 多行业走势图组件（保留原有）====================
function MultiIndustryTrendChart({
  trendData,
  ranking,
  width = 200,
  height = 80,
  showLabels = false
}: {
  trendData: Record<string, { weekDate: string; score: number }[]>
  ranking: MomentumRankingItem[]
  width?: number
  height?: number
  showLabels?: boolean
}) {
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>()
    Object.values(trendData).forEach(data => {
      data.forEach(d => weeks.add(d.weekDate))
    })
    return Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [trendData])

  const chartData = useMemo(() => {
    const maxScore = 7
    const minScore = 0
    const range = maxScore - minScore || 1
    const padding = showLabels ? 30 : 5
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    return ranking.slice(0, 10).map((item, index) => {
      const industryData = trendData[item.industry] || []
      const dataMap = new Map(industryData.map(d => [d.weekDate, d.score]))

      const points = allWeeks.map((week, i) => {
        const rawScore = dataMap.get(week) ?? 0
        const score = Math.max(0, Math.min(7, rawScore))
        const x = padding + (i / (allWeeks.length - 1 || 1)) * chartWidth
        const y = padding + (1 - (score - minScore) / range) * chartHeight
        return { x, y, score, week }
      })
      const pathD = points.map((p, i) =>
        `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
      ).join(' ')
      return {
        industry: item.industry,
        color: INDUSTRY_COLORS[index % INDUSTRY_COLORS.length],
        pathD,
        points,
        lastScore: points[points.length - 1]?.score || 0
      }
    })
  }, [trendData, ranking, allWeeks, width, height, showLabels])

  if (allWeeks.length < 2 || ranking.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        需要多周数据才能显示走势
      </div>
    )
  }

  const formatWeekDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr)
      return `${date.getMonth() + 1}/${date.getDate()}`
    } catch {
      return dateStr
    }
  }

  return (
    <svg width={width} height={height} className="overflow-visible">
      {showLabels && [0, 3.5, 7].map((score, i) => {
        const y = 30 + (1 - score / 7) * (height - 60)
        return (
          <g key={i}>
            <text x={5} y={y + 3} fontSize={10} fill="hsl(var(--muted-foreground))">
              {score}
            </text>
            <line
              x1={25}
              y1={y}
              x2={width - 5}
              y2={y}
              stroke="hsl(var(--border))"
              strokeWidth={0.5}
              strokeDasharray={score === 7 ? "4,2" : "none"}
            />
          </g>
        )
      })}

      {showLabels && allWeeks.map((week, i) => {
        const x = 30 + (i / (allWeeks.length - 1 || 1)) * (width - 60)
        return (
          <text
            key={week}
            x={x}
            y={height - 5}
            fontSize={9}
            fill="hsl(var(--muted-foreground))"
            textAnchor="middle"
          >
            {formatWeekDate(week)}
          </text>
        )
      })}

      {chartData.map((line, index) => (
        <g key={line.industry}>
          <path
            d={line.pathD}
            fill="none"
            stroke={line.color}
            strokeWidth={showLabels ? 2 : 1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.8}
          />
          {showLabels && line.points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={3}
              fill={line.color}
              opacity={i === line.points.length - 1 ? 1 : 0.6}
            />
          ))}
          {!showLabels && line.points.length > 0 && (
            <circle
              cx={line.points[line.points.length - 1].x}
              cy={line.points[line.points.length - 1].y}
              r={2}
              fill={line.color}
            />
          )}
        </g>
      ))}
    </svg>
  )
}

// ==================== 走势图弹窗组件（保留原有）====================
function TrendChartDialog({
  open,
  onOpenChange,
  trendData,
  ranking
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  trendData: Record<string, { weekDate: string; score: number }[]>
  ranking: MomentumRankingItem[]
}) {
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>()
    Object.values(trendData).forEach(data => {
      data.forEach(d => weeks.add(d.weekDate))
    })
    return Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [trendData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            动量走势图
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-muted/20">
            <MultiIndustryTrendChart
              trendData={trendData}
              ranking={ranking}
              width={700}
              height={350}
              showLabels={true}
            />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center">
            {ranking.slice(0, 10).map((item, index) => (
              <div key={item.industry} className="flex items-center gap-1.5">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: INDUSTRY_COLORS[index] }}
                />
                <span className="text-xs">{item.industry}</span>
                <span className="text-xs text-muted-foreground">({item.score.toFixed(1)})</span>
              </div>
            ))}
          </div>

          <div className="text-xs text-muted-foreground text-center">
            <p>上图显示近 {allWeeks.length} 周各行业的动量分值走势，分值范围 0-7，7 表示接近高潮</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ==================== 动量模块（保留原有）====================
function MomentumModule({
  ranking,
  trendData,
  selectedIndustry,
  onSelectIndustry,
  loading,
  expanded,
  onToggle
}: SidebarProps & { expanded: boolean; onToggle: () => void }) {
  const [chartDialogOpen, setChartDialogOpen] = useState(false)
  const [contentHeight, setContentHeight] = useState(DEFAULT_HEIGHTS.momentum)
  const [isDragging, setIsDragging] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    const savedHeight = localStorage.getItem('panel_momentum_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.momentum.min && h <= HEIGHT_LIMITS.momentum.max) {
        setContentHeight(h)
      }
    }
  }, [])

  const saveHeight = useCallback((height: number) => {
    localStorage.setItem('panel_momentum_height', height.toString())
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!expanded) return
    e.preventDefault()
    setIsDragging(true)
    startYRef.current = e.clientY
    startHeightRef.current = contentHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [expanded, contentHeight])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current
      let newHeight = startHeightRef.current + deltaY
      newHeight = Math.max(HEIGHT_LIMITS.momentum.min, Math.min(HEIGHT_LIMITS.momentum.max, newHeight))
      setContentHeight(newHeight)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      saveHeight(contentHeight)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, contentHeight, saveHeight])

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">动量主线</span>
          <Badge variant="secondary" className="text-xs h-4 px-1.5">
            {ranking.length}
          </Badge>
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div
          ref={contentRef}
          className="relative flex flex-col overflow-hidden"
          style={{ height: contentHeight }}
        >
          {ranking.length > 0 && Object.keys(trendData).length > 0 && (
            <div className="flex-shrink-0 mx-2 mb-2 p-2 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs font-medium text-muted-foreground">
                  上榜行业近{Math.max(...Object.values(trendData).map(d => d.length), 0)}周走势
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => setChartDialogOpen(true)}
                  title="放大查看"
                >
                  <Maximize2 className="h-3 w-3 text-muted-foreground" />
                </Button>
              </div>
              <MultiIndustryTrendChart
                trendData={trendData}
                ranking={ranking}
                width={180}
                height={70}
              />
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                {ranking.slice(0, 5).map((item, index) => (
                  <button
                    key={item.industry}
                    onClick={() => onSelectIndustry(item.industry)}
                    className="flex items-center gap-1 text-[10px] hover:opacity-80"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: INDUSTRY_COLORS[index] }}
                    />
                    <span className="truncate max-w-[40px]">{item.industry}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 pb-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                </div>
              ) : ranking.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-8">
                  暂无数据
                </div>
              ) : (
                <div className="space-y-1">
                  {ranking.map((item, index) => (
                    <button
                      key={item.industry}
                      onClick={() => onSelectIndustry(item.industry)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                        selectedIndustry === item.industry
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded text-xs flex items-center justify-center font-medium",
                        item.score >= 7 ? "bg-orange-100 text-orange-700" :
                        item.score > 1 ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm truncate">{item.industry}</span>
                      <div className="flex items-center gap-1">
                        {item.continuousWeeks > 1 && (
                          <Badge variant="outline" className="text-[10px] h-4 px-1">
                            {item.continuousWeeks}周
                          </Badge>
                        )}
                        <span className={cn(
                          "text-xs font-medium tabular-nums",
                          item.score >= 7 ? "text-orange-600" :
                          item.score > 1 ? "text-green-600" :
                          "text-gray-500"
                        )}>
                          {item.score.toFixed(1)}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group z-10",
              "flex items-center justify-center",
              "hover:bg-primary/20 transition-colors",
              isDragging && "bg-primary/40"
            )}
            onMouseDown={handleMouseDown}
            title="拖拽调整高度"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
        </div>
      )}

      <TrendChartDialog
        open={chartDialogOpen}
        onOpenChange={setChartDialogOpen}
        trendData={trendData}
        ranking={ranking}
      />
    </div>
  )
}

// ==================== 最强逻辑模块（替换为戴维斯双击评分）====================
function LogicModule({
  expanded,
  onToggle,
  selectedIndustry,
  onSelectIndustry
}: {
  expanded: boolean
  onToggle: () => void
  selectedIndustry: string | null
  onSelectIndustry: (industry: string) => void
}) {
  const { toast } = useToast()
  const [davisScores, setDavisScores] = useState<DavisScoreItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string>('all')
  const [contentHeight, setContentHeight] = useState(DEFAULT_HEIGHTS.logic)
  const [isDragging, setIsDragging] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  useEffect(() => {
    const savedHeight = localStorage.getItem('panel_logic_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.logic.min && h <= HEIGHT_LIMITS.logic.max) {
        setContentHeight(h)
      }
    }
  }, [])

  const saveHeight = useCallback((height: number) => {
    localStorage.setItem('panel_logic_height', height.toString())
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!expanded) return
    e.preventDefault()
    setIsDragging(true)
    startYRef.current = e.clientY
    startHeightRef.current = contentHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
  }, [expanded, contentHeight])

  useEffect(() => {
    if (!isDragging) return
    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startYRef.current
      let newHeight = startHeightRef.current + deltaY
      newHeight = Math.max(HEIGHT_LIMITS.logic.min, Math.min(HEIGHT_LIMITS.logic.max, newHeight))
      setContentHeight(newHeight)
    }
    const handleMouseUp = () => {
      setIsDragging(false)
      saveHeight(contentHeight)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, contentHeight, saveHeight])

  // 获取戴维斯评分数据（调用合并后的logic接口）
  const fetchDavisScores = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/logic')
      if (!response.ok) {
        throw new Error('获取数据失败')
      }
      const data = await response.json()
      setDavisScores(data.scores || data.ranking || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
    } finally {
      setLoading(false)
    }
  }

  // 刷新评分（带AI分析增强）
  const refreshScores = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/logic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'davis_refresh' })
      })
      if (!response.ok) {
        throw new Error('刷新评分失败')
      }
      const data = await response.json()
      setDavisScores(data.scores || data.ranking || [])
      toast({
        title: '刷新成功',
        description: `已完成 ${data.scores?.length || 0} 个行业AI增强评分`
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误')
      toast({
        title: '刷新失败',
        description: err instanceof Error ? err.message : '未知错误',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  // 导出报告
  const exportReport = () => {
    const reportData = {
      exportTime: new Date().toISOString(),
      scores: davisScores
    }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `davis-score-report-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast({
      title: '导出成功',
      description: '评分报告已下载'
    })
  }

  // 初始加载
  useEffect(() => {
    if (expanded) {
      fetchDavisScores()
    }
  }, [expanded])

  // 按类型筛选
  const filteredScores = selectedType === 'all'
    ? davisScores
    : davisScores.filter(s => s.industryType === selectedType)

  // 获取分数颜色
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-blue-600'
    if (score >= 40) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 获取分数背景
  const getScoreBg = (score: number) => {
    if (score >= 80) return 'bg-green-50 border-green-200'
    if (score >= 60) return 'bg-blue-50 border-blue-200'
    if (score >= 40) return 'bg-yellow-50 border-yellow-200'
    return 'bg-red-50 border-red-200'
  }

  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-sm">最强逻辑</span>
          {davisScores.length > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1.5">
              {davisScores.length}
            </Badge>
          )}
          {loading && (
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div
          ref={contentRef}
          className="relative overflow-hidden flex flex-col"
          style={{ height: contentHeight }}
        >
          {/* 操作按钮 */}
          <div className="flex gap-1 px-2 py-1.5 flex-shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs flex-1"
              onClick={refreshScores}
              disabled={loading}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
              {loading ? '刷新中...' : '刷新评分'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={exportReport}
              disabled={davisScores.length === 0}
              title="导出报告"
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>

          {/* 类型筛选 */}
          <div className="flex gap-1 px-2 mb-1.5 flex-wrap flex-shrink-0">
            <button
              onClick={() => setSelectedType('all')}
              className={cn(
                "px-2 py-0.5 text-[10px] rounded transition-colors",
                selectedType === 'all' ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/80"
              )}
            >
              全部
            </button>
            {Object.entries(industryTypeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSelectedType(key)}
                className={cn(
                  "px-2 py-0.5 text-[10px] rounded transition-colors",
                  selectedType === key ? "bg-amber-500 text-white" : "bg-muted hover:bg-muted/80"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 错误提示 */}
          {error && (
            <div className="flex items-center gap-2 px-2 mb-1.5 flex-shrink-0">
              <div className="flex items-center gap-1.5 p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-600 flex-1">
                <AlertCircle className="w-3 h-3 flex-shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* 评分列表 */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-2 pb-2">
              {loading && davisScores.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
                </div>
              ) : filteredScores.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-6">
                  <Zap className="w-6 h-6 mx-auto mb-2 opacity-50" />
                  <p>暂无评分数据</p>
                  <button
                    onClick={refreshScores}
                    className="mt-2 text-amber-600 hover:text-amber-700"
                  >
                    点击刷新获取数据
                  </button>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredScores.map((item, index) => (
                    <button
                      key={item.id || index}
                      onClick={() => onSelectIndustry(item.industryName)}
                      className={cn(
                        "w-full p-2 rounded-lg border transition-colors cursor-pointer",
                        "hover:shadow-sm",
                        selectedIndustry === item.industryName
                          ? "ring-2 ring-amber-500/50"
                          : "",
                        getScoreBg(item.totalScore)
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] px-1 py-0.5 rounded",
                            industryTypeColors[item.industryType]
                          )}>
                            {industryTypeLabels[item.industryType]}
                          </span>
                          <span className="text-xs font-medium text-slate-800 truncate max-w-[80px]">
                            {item.industryName}
                          </span>
                        </div>
                        <span className={cn(
                          "text-sm font-bold tabular-nums",
                          getScoreColor(item.totalScore)
                        )}>
                          {item.totalScore.toFixed(1)}
                        </span>
                      </div>

                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden flex">
                        {DAVIS_DIMENSIONS.map((dim) => {
                          const value = item.dimensions[dim.key as keyof typeof item.dimensions] || 0
                          return (
                            <div
                              key={dim.key}
                              style={{
                                width: `${dim.weight * 100}%`,
                                backgroundColor: dim.color,
                                opacity: 0.3 + (value / 100) * 0.7
                              }}
                              className="h-full transition-opacity"
                            />
                          )
                        })}
                      </div>

                      {item.keyLogic && (
                        <p className="text-[10px] text-slate-600 mt-1 line-clamp-1">
                          {item.keyLogic}
                        </p>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* 维度图例 */}
          <div className="px-2 pt-1.5 border-t border-border flex-shrink-0 bg-background">
            <div className="grid grid-cols-4 gap-0.5 text-[9px] text-muted-foreground">
              {DAVIS_DIMENSIONS.slice(0, 4).map((dim) => (
                <div key={dim.key} className="flex items-center gap-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: dim.color }}
                  />
                  <span>{dim.name} {Math.round(dim.weight * 100)}%</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-0.5 text-[9px] text-muted-foreground mt-0.5">
              {DAVIS_DIMENSIONS.slice(4).map((dim) => (
                <div key={dim.key} className="flex items-center gap-0.5">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: dim.color }}
                  />
                  <span>{dim.name} {Math.round(dim.weight * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 拖拽手柄 */}
          <div
            className={cn(
              "absolute bottom-0 left-0 right-0 h-1.5 cursor-row-resize group z-10",
              "flex items-center justify-center",
              "hover:bg-primary/20 transition-colors",
              isDragging && "bg-primary/40"
            )}
            onMouseDown={handleMouseDown}
            title="拖拽调整高度"
          >
            <GripHorizontal className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-60 transition-opacity" />
          </div>
        </div>
      )}
    </div>
  )
}

// ==================== 主Sidebar组件====================
export default function Sidebar({
  ranking,
  trendData,
  selectedIndustry,
  onSelectIndustry,
  loading
}: SidebarProps) {
  const [momentumExpanded, setMomentumExpanded] = useState(true)
  const [logicExpanded, setLogicExpanded] = useState(false)

  return (
    <div className="h-full flex flex-col bg-muted/30">
      {/* Logo区域 */}
      <div className="p-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-sm">3L投研</h1>
            <p className="text-[10px] text-muted-foreground">v2.1 工作台</p>
          </div>
        </div>
      </div>

      {/* 模块列表 */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <MomentumModule
          ranking={ranking}
          trendData={trendData}
          selectedIndustry={selectedIndustry}
          onSelectIndustry={onSelectIndustry}
          loading={loading}
          expanded={momentumExpanded}
          onToggle={() => setMomentumExpanded(!momentumExpanded)}
        />
        <LogicModule
          expanded={logicExpanded}
          onToggle={() => setLogicExpanded(!logicExpanded)}
          selectedIndustry={selectedIndustry}
          onSelectIndustry={onSelectIndustry}
        />
      </div>

      {/* 底部状态 */}
      <div className="p-2 border-t border-border text-center flex-shrink-0">
        <span className="text-[10px] text-muted-foreground">
          数据更新: {ranking[0]?.weekDate ? new Date(ranking[0].weekDate).toLocaleDateString() : '-'}
        </span>
      </div>
    </div>
  )
}