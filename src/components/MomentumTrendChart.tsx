'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'

interface TrendChartProps {
  data: { weekDate: string; score: number }[]
  width?: number
  height?: number
  className?: string
}

export function MomentumTrendChart({ 
  data, 
  width = 200, 
  height = 50,
  className 
}: TrendChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null
    
    // 按日期排序（正序）
    const sorted = [...data].sort((a, b) => 
      new Date(a.weekDate).getTime() - new Date(b.weekDate).getTime()
    )
    
    const scores = sorted.map(d => d.score)
    const maxScore = Math.max(...scores, 7)
    const minScore = Math.min(...scores, 0)
    const range = maxScore - minScore || 1
    
    // 计算坐标点
    const padding = 2
    const chartWidth = width - padding * 2
    const chartHeight = height - padding * 2
    
    const points = sorted.map((d, i) => ({
      x: padding + (i / (sorted.length - 1 || 1)) * chartWidth,
      y: padding + (1 - (d.score - minScore) / range) * chartHeight,
      score: d.score,
      weekDate: d.weekDate
    }))
    
    // 生成路径
    const pathD = points.map((p, i) => 
      `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
    ).join(' ')
    
    // 生成填充区域
    const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${height} L ${points[0]?.x || 0} ${height} Z`
    
    return { points, pathD, areaD, scores, sorted }
  }, [data, width, height])
  
  if (!chartData || chartData.points.length < 2) {
    return (
      <div 
        className={cn("flex items-center justify-center text-muted-foreground text-xs", className)}
        style={{ width, height }}
      >
        暂无走势数据
      </div>
    )
  }
  
  const lastScore = chartData.scores[chartData.scores.length - 1]
  const prevScore = chartData.scores[chartData.scores.length - 2]
  const trend = lastScore > prevScore ? 'up' : lastScore < prevScore ? 'down' : 'stable'
  
  const strokeColor = trend === 'up' ? '#22c55e' : trend === 'down' ? '#ef4444' : '#6b7280'
  const fillColor = trend === 'up' ? 'rgba(34, 197, 94, 0.1)' : trend === 'down' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)'
  
  return (
    <svg 
      width={width} 
      height={height} 
      className={cn("overflow-visible", className)}
    >
      {/* 填充区域 */}
      <path d={chartData.areaD} fill={fillColor} />
      
      {/* 折线 */}
      <path 
        d={chartData.pathD} 
        fill="none" 
        stroke={strokeColor} 
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      
      {/* 最后一个点 */}
      {chartData.points.length > 0 && (
        <circle 
          cx={chartData.points[chartData.points.length - 1].x} 
          cy={chartData.points[chartData.points.length - 1].y}
          r={3}
          fill={strokeColor}
        />
      )}
      
      {/* 高潮线（score=7） */}
      <line 
        x1={0} 
        y1={height * 0.3} 
        x2={width} 
        y2={height * 0.3}
        stroke="#f97316"
        strokeWidth={0.5}
        strokeDasharray="2,2"
        opacity={0.5}
      />
    </svg>
  )
}
