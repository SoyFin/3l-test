'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface DrawerLayoutProps {
  // 左侧固定区域
  leftPanel: React.ReactNode
  // 中间抽屉区域（可展开/收起）
  drawerPanel: React.ReactNode
  // 右侧AI助手区域
  rightPanel?: React.ReactNode
  // 抽屉是否默认展开
  defaultExpanded?: boolean
  // 抽屉最小宽度（收起状态）
  minDrawerWidth?: number
  // 抽屉最大宽度（展开状态）
  maxDrawerWidth?: number
  // 左侧面板宽度
  leftWidth?: number
  // 右侧面板宽度
  rightWidth?: number
  // 当抽屉内容变化时是否自动展开
  autoExpandOnContent?: boolean
  // 是否有内容可展示
  hasDrawerContent?: boolean
}

export function DrawerLayout({
  leftPanel,
  drawerPanel,
  rightPanel,
  defaultExpanded = false,
  minDrawerWidth = 0,
  maxDrawerWidth = 500,
  leftWidth = 220,
  rightWidth = 0,
  autoExpandOnContent = true,
  hasDrawerContent = false
}: DrawerLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [drawerWidth, setDrawerWidth] = useState(defaultExpanded ? maxDrawerWidth : minDrawerWidth)
  const [isResizing, setIsResizing] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 当内容变化时自动展开
  useEffect(() => {
    if (autoExpandOnContent && hasDrawerContent && !isExpanded) {
      setIsExpanded(true)
      setDrawerWidth(maxDrawerWidth)
    }
  }, [hasDrawerContent, autoExpandOnContent, isExpanded, maxDrawerWidth])
  
  // 切换抽屉状态
  const toggleDrawer = useCallback(() => {
    setIsExpanded(prev => {
      const newState = !prev
      setDrawerWidth(newState ? maxDrawerWidth : minDrawerWidth)
      return newState
    })
  }, [maxDrawerWidth, minDrawerWidth])
  
  // 关闭抽屉
  const closeDrawer = useCallback(() => {
    setIsExpanded(false)
    setDrawerWidth(minDrawerWidth)
  }, [minDrawerWidth])
  
  // 拖拽调整宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
  }, [])
  
  useEffect(() => {
    if (!isResizing) return
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return
      
      const containerRect = containerRef.current.getBoundingClientRect()
      const newWidth = containerRect.right - e.clientX - (rightPanel ? rightWidth : 0)
      
      // 限制宽度范围
      if (newWidth >= minDrawerWidth && newWidth <= maxDrawerWidth) {
        setDrawerWidth(newWidth)
        if (newWidth <= minDrawerWidth + 50) {
          setIsExpanded(false)
        } else {
          setIsExpanded(true)
        }
      }
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isResizing, minDrawerWidth, maxDrawerWidth, rightPanel, rightWidth])
  
  return (
    <div ref={containerRef} className="flex h-full overflow-hidden">
      {/* 左侧固定区域 */}
      <div 
        className="flex-shrink-0 h-full border-r border-border bg-muted/20"
        style={{ width: leftWidth }}
      >
        {leftPanel}
      </div>
      
      {/* 中间抽屉区域 */}
      <div 
        className={cn(
          "h-full transition-all duration-300 ease-in-out overflow-hidden relative",
          isResizing && "transition-none"
        )}
        style={{ width: drawerWidth }}
      >
        {/* 抽屉内容 */}
        <div className="h-full flex flex-col">
          {/* 抽屉头部 */}
          {isExpanded && hasDrawerContent && (
            <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/10">
              <span className="text-xs text-muted-foreground">详情面板</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={closeDrawer}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {/* 抽屉内容区域 */}
          <div className="flex-1 overflow-hidden">
            {drawerPanel}
          </div>
        </div>
        
        {/* 拖拽手柄 */}
        {isExpanded && (
          <div
            className={cn(
              "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-primary/20",
              isResizing && "bg-primary/30"
            )}
            onMouseDown={handleMouseDown}
          />
        )}
      </div>
      
      {/* 抽屉展开/收起按钮 */}
      {hasDrawerContent && (
        <button
          onClick={toggleDrawer}
          className={cn(
            "absolute z-10 flex items-center justify-center w-5 h-10 bg-background border border-border rounded-r-lg shadow-sm",
            "hover:bg-muted/50 transition-colors",
            "top-1/2 -translate-y-1/2"
          )}
          style={{ 
            left: isExpanded ? leftWidth + drawerWidth - 2 : leftWidth - 2 
          }}
        >
          {isExpanded ? (
            <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      )}
      
      {/* 右侧AI助手区域 */}
      {rightPanel && isExpanded && (
        <div 
          className="flex-shrink-0 h-full border-l border-border"
          style={{ width: rightWidth }}
        >
          {rightPanel}
        </div>
      )}
    </div>
  )
}
