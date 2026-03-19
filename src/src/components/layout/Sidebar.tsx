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
import { TrendingUp, Lightbulb, ChevronRight, ChevronDown, Sparkles, RefreshCw, Maximize2, GripHorizontal, Play, Pause } from 'lucide-react'
import { MomentumRankingItem } from '@/types'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'

// 行业逻辑评分接口
interface LogicScoreItem {
  id: string
  industry: string
  weekDate: string
  policyScore: number
  earningsScore: number
  capitalScore: number
  institutionScore: number
  totalScore: number
  policyEvents?: Array<{ title: string; date: string; importance: number }>
  analysis?: string
}

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
// 多行业走势图组件
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
  // 获取所有周的日期（取第一个行业的数据作为基准）
  const allWeeks = useMemo(() => {
    const weeks = new Set<string>()
    Object.values(trendData).forEach(data => {
      data.forEach(d => weeks.add(d.weekDate))
    })
    return Array.from(weeks).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
  }, [trendData])
  if (allWeeks.length < 2 || ranking.length === 0) {
    return (
      <div className="text-xs text-muted-foreground text-center py-2">
        需要多周数据才能显示走势
      </div>
    )
  }
  // 构建各行业的数据点
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
        // 确保分数在0-7范围内，防止溢出
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
  // 格式化周日期
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
      {/* Y轴刻度 */}
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
      
      {/* X轴标签 */}
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
      
      {/* 各行业折线 */}
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
          {/* 数据点 */}
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
          {/* 非大图模式的最后一个点 */}
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
// 走势图弹窗组件
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
          {/* 大图 */}
          <div className="border rounded-lg p-4 bg-muted/20">
            <MultiIndustryTrendChart 
              trendData={trendData}
              ranking={ranking}
              width={700}
              height={350}
              showLabels={true}
            />
          </div>
          
          {/* 图例 */}
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
          
          {/* 说明 */}
          <div className="text-xs text-muted-foreground text-center">
            <p>上图显示近 {allWeeks.length} 周各行业的动量分值走势，分值范围 0-7，7 表示接近高潮</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
// 动量模块
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
  
  // 从localStorage加载保存的高度
  useEffect(() => {
    const savedHeight = localStorage.getItem('panel_momentum_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.momentum.min && h <= HEIGHT_LIMITS.momentum.max) {
        setContentHeight(h)
      }
    }
  }, [])
  
  // 保存高度
  const saveHeight = useCallback((height: number) => {
    localStorage.setItem('panel_momentum_height', height.toString())
  }, [])
  
  // 拖拽处理
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
      // 下拉增加高度，上拉减少高度
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
          {/* 多行业走势图区域 */}
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
              {/* 图例 */}
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
          
          {/* 排行列表 - flex-1让它占满剩余空间 */}
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
      
      {/* 走势图弹窗 */}
      <TrendChartDialog
        open={chartDialogOpen}
        onOpenChange={setChartDialogOpen}
        trendData={trendData}
        ranking={ranking}
      />
    </div>
  )
}
// 逻辑模块 - 使用后台任务系统
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
  const [logicRanking, setLogicRanking] = useState<LogicScoreItem[]>([])
  const [loading, setLoading] = useState(false)
  const [contentHeight, setContentHeight] = useState(DEFAULT_HEIGHTS.logic)
  const [isDragging, setIsDragging] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)
  // 任务状态
  const [taskProgress, setTaskProgress] = useState<{
    status: string
    totalTasks: number
    completedTasks: number
    failedTasks: number
    currentIndustry: string | null
    progress: number
  } | null>(null)
  const [isWorkerRunning, setIsWorkerRunning] = useState(false)
  // 从localStorage加载保存的高度
  useEffect(() => {
    const savedHeight = localStorage.getItem('panel_logic_height')
    if (savedHeight) {
      const h = parseInt(savedHeight)
      if (h >= HEIGHT_LIMITS.logic.min && h <= HEIGHT_LIMITS.logic.max) {
        setContentHeight(h)
      }
    }
  }, [])
  // 保存高度
  const saveHeight = useCallback((height: number) => {
    localStorage.setItem('panel_logic_height', height.toString())
  }, [])
  // 拖拽处理
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
      // 下拉增加高度，上拉减少高度
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
  // 加载逻辑评分数据
  useEffect(() => {
    if (expanded && logicRanking.length === 0) {
      fetchLogicRanking()
    }
  }, [expanded])
  // 定时获取任务进度
  useEffect(() => {
    if (!expanded) return
    const fetchProgress = async () => {
      try {
        const res = await fetch('/api/policy-task')
        const data = await res.json()
        if (data.success && data.hasTask) {
          setTaskProgress(data.progress)
        } else {
          setTaskProgress(null)
        }
      } catch (error) {
        console.error('Fetch progress error:', error)
      }
    }
    fetchProgress()
    const interval = setInterval(fetchProgress, 10000)
    return () => clearInterval(interval)
  }, [expanded])
  const fetchLogicRanking = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/logic')
      const data = await response.json()
      if (data.ranking) {
        setLogicRanking(data.ranking)
      }
    } catch (error: any) {
      console.error('Fetch logic ranking error:', error)
    } finally {
      setLoading(false)
    }
  }
  // 处理单个任务
  const processNextTask = async (batchId: string) => {
    try {
      const res = await fetch('/api/policy-task/worker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId })
      })
      return await res.json()
    } catch (error) {
      return { success: false, error: '请求失败' }
    }
  }
  // 任务执行循环
  const runWorkerLoop = useCallback(async (batchId: string) => {
    setIsWorkerRunning(true)
    while (true) {
      // 检查是否应该继续
      const progressRes = await fetch('/api/policy-task?batchId=' + batchId)
      const progressData = await progressRes.json()
      if (!progressData.hasTask || progressData.progress?.status === 'paused') {
        setIsWorkerRunning(false)
        break
      }
      // 处理下一个任务
      const result = await processNextTask(batchId)
      // 刷新进度
      const progressUpdate = await fetch('/api/policy-task?batchId=' + batchId)
      const progressUpdateData = await progressUpdate.json()
      if (progressUpdateData.hasTask) {
        setTaskProgress(progressUpdateData.progress)
      }
      // 检查是否完成
      if (!result.needWait || result.status === 'completed' || result.status === 'failed') {
        setIsWorkerRunning(false)
        if (result.status === 'completed') {
          toast({
            title: '更新完成',
            description: result.message || '政策数据更新完成'
          })
          // 刷新排名
          fetchLogicRanking()
        }
        break
      }
      // 等待指定时间
      const waitMs = result.waitMs || 30000
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }
  }, [toast])
  // 启动更新任务
  const handleStartTask = async () => {
    try {
      const res = await fetch('/api/policy-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' })
      })
      const data = await res.json()
      if (data.success) {
        toast({
          title: '任务已启动',
          description: data.message
        })
        // 开始执行循环
        runWorkerLoop(data.batchId)
      } else {
        toast({
          title: '启动失败',
          description: data.error || '请稍后重试',
          variant: 'destructive'
        })
      }
    } catch (error) {
      toast({
        title: '启动失败',
        description: '请求失败',
        variant: 'destructive'
      })
    }
  }
  // 暂停任务
  const handlePauseTask = async () => {
    if (!taskProgress) return
    try {
      const res = await fetch('/api/policy-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'pause', batchId: taskProgress.batchId })
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: '任务已暂停' })
      }
    } catch (error) {
      toast({ title: '暂停失败', variant: 'destructive' })
    }
  }
  // 恢复任务
  const handleResumeTask = async () => {
    if (!taskProgress) return
    try {
      const res = await fetch('/api/policy-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resume', batchId: taskProgress.batchId })
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: '任务已恢复' })
        runWorkerLoop(taskProgress.batchId)
      }
    } catch (error) {
      toast({ title: '恢复失败', variant: 'destructive' })
    }
  }
  // 手动计算评分
  const handleCalculateScores = async () => {
    try {
      const res = await fetch('/api/policy-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'calculate' })
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: '评分计算完成', description: data.message })
        fetchLogicRanking()
      } else {
        toast({ title: '计算失败', description: data.error, variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: '计算失败', variant: 'destructive' })
    }
  }
  // 渲染任务状态
  const renderTaskStatus = () => {
    if (!taskProgress) return null
    const statusColors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      running: 'bg-blue-100 text-blue-600',
      completed: 'bg-green-100 text-green-600',
      failed: 'bg-red-100 text-red-600',
      paused: 'bg-yellow-100 text-yellow-600'
    }
    const statusLabels: Record<string, string> = {
      pending: '等待中',
      running: '进行中',
      completed: '已完成',
      failed: '失败',
      paused: '已暂停'
    }
    return (
      <div className="px-2 mb-2 p-2 bg-muted/50 rounded text-xs">
        <div className="flex items-center justify-between mb-1">
          <Badge variant="outline" className={cn('text-[10px] h-4', statusColors[taskProgress.status])}>
            {statusLabels[taskProgress.status]}
          </Badge>
          <span className="text-muted-foreground">
            {taskProgress.completedTasks}/{taskProgress.totalTasks}
          </span>
        </div>
        <Progress value={taskProgress.progress} className="h-1" />
        {taskProgress.currentIndustry && (
          <div className="mt-1 text-muted-foreground truncate">
            当前: {taskProgress.currentIndustry}
          </div>
        )}
      </div>
    )
  }
  // 渲染操作按钮
  const renderActions = () => {
    if (!taskProgress) {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs flex-1"
          onClick={handleStartTask}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          更新政策数据
        </Button>
      )
    }
    if (taskProgress.status === 'running') {
      return (
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs flex-1"
          onClick={handlePauseTask}
        >
          <Pause className="h-3 w-3 mr-1" />
          暂停任务
        </Button>
      )
    }
    if (taskProgress.status === 'paused') {
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs flex-1"
            onClick={handleResumeTask}
          >
            <Play className="h-3 w-3 mr-1" />
            继续任务
          </Button>
        </div>
      )
    }
    if (taskProgress.status === 'completed' || taskProgress.status === 'failed') {
      return (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs"
            onClick={handleCalculateScores}
          >
            重算评分
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs flex-1"
            onClick={handleStartTask}
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            重新更新
          </Button>
        </div>
      )
    }
    return null
  }
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-sm">最强逻辑</span>
          {logicRanking.length > 0 && (
            <Badge variant="secondary" className="text-xs h-4 px-1.5">
              {logicRanking.length}
            </Badge>
          )}
          {isWorkerRunning && (
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
          className="relative"
          style={{ height: contentHeight }}
        >
          {/* 任务状态 */}
          {renderTaskStatus()}
          {/* 操作按钮 */}
          <div className="px-2 mb-2 flex gap-1">
            {renderActions()}
          </div>
          {/* 排行列表 */}
          <ScrollArea className="h-[calc(100%-120px)]">
            <div className="px-2">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-amber-500" />
                </div>
              ) : logicRanking.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-4">
                  <p className="mb-2">暂无逻辑评分数据</p>
                  <p className="text-[10px]">点击"更新政策数据"获取最新数据</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {logicRanking.map((item, index) => (
                    <button
                      key={item.id}
                      onClick={() => onSelectIndustry(item.industry)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors",
                        selectedIndustry === item.industry
                          ? "bg-amber-500/10 text-amber-700"
                          : "hover:bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "w-5 h-5 rounded text-xs flex items-center justify-center font-medium",
                        item.totalScore >= 7 ? "bg-amber-100 text-amber-700" :
                        item.totalScore >= 5 ? "bg-green-100 text-green-700" :
                        "bg-gray-100 text-gray-600"
                      )}>
                        {index + 1}
                      </span>
                      <span className="flex-1 text-sm truncate">{item.industry}</span>
                      <span className={cn(
                        "text-xs font-medium tabular-nums",
                        item.totalScore >= 7 ? "text-amber-600" :
                        item.totalScore >= 5 ? "text-green-600" :
                        "text-gray-500"
                      )}>
                        {item.totalScore.toFixed(1)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
          {/* 评分说明 */}
          <div className="px-3 pt-2 border-t border-border absolute bottom-6 left-0 right-0 bg-background">
            <div className="text-[10px] text-muted-foreground space-y-0.5">
              <div className="flex justify-between">
                <span>政策催化</span>
                <span>35%</span>
              </div>
              <div className="flex justify-between">
                <span>业绩预期</span>
                <span>30%</span>
              </div>
              <div className="flex justify-between">
                <span>资金流向</span>
                <span>20%</span>
              </div>
              <div className="flex justify-between">
                <span>机构关注</span>
                <span>15%</span>
              </div>
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
