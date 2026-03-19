'use client'

import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { GripVertical } from 'lucide-react'

// 默认宽度配置
const DEFAULT_WIDTHS = {
  sidebar: 260,
  rightPanel: 400
}

// 最小/最大宽度限制
const WIDTH_LIMITS = {
  sidebar: { min: 200, max: 400 },
  rightPanel: { min: 300, max: 600 }
}

interface ResizableLayoutProps {
  sidebar: ReactNode
  workspace: ReactNode
  rightPanel: ReactNode
}

export default function ResizableLayout({
  sidebar,
  workspace,
  rightPanel
}: ResizableLayoutProps) {
  // 从localStorage加载保存的宽度
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTHS.sidebar)
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_WIDTHS.rightPanel)
  
  // 拖拽状态
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false)
  const [isDraggingRight, setIsDraggingRight] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // 初始化时加载保存的宽度
  useEffect(() => {
    const savedSidebarWidth = localStorage.getItem('layout_sidebar_width')
    const savedRightPanelWidth = localStorage.getItem('layout_right_panel_width')
    
    if (savedSidebarWidth) {
      const width = parseInt(savedSidebarWidth)
      if (width >= WIDTH_LIMITS.sidebar.min && width <= WIDTH_LIMITS.sidebar.max) {
        setSidebarWidth(width)
      }
    }
    
    if (savedRightPanelWidth) {
      const width = parseInt(savedRightPanelWidth)
      if (width >= WIDTH_LIMITS.rightPanel.min && width <= WIDTH_LIMITS.rightPanel.max) {
        setRightPanelWidth(width)
      }
    }
  }, [])

  // 保存宽度到localStorage
  const saveWidths = useCallback(() => {
    localStorage.setItem('layout_sidebar_width', sidebarWidth.toString())
    localStorage.setItem('layout_right_panel_width', rightPanelWidth.toString())
  }, [sidebarWidth, rightPanelWidth])

  // 鼠标移动处理
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!containerRef.current) return
    
    const containerRect = containerRef.current.getBoundingClientRect()
    
    if (isDraggingSidebar) {
      // 左侧边栏拖拽
      let newWidth = e.clientX - containerRect.left
      newWidth = Math.max(WIDTH_LIMITS.sidebar.min, Math.min(WIDTH_LIMITS.sidebar.max, newWidth))
      setSidebarWidth(newWidth)
    }
    
    if (isDraggingRight) {
      // 右侧面板拖拽
      let newWidth = containerRect.right - e.clientX
      newWidth = Math.max(WIDTH_LIMITS.rightPanel.min, Math.min(WIDTH_LIMITS.rightPanel.max, newWidth))
      setRightPanelWidth(newWidth)
    }
  }, [isDraggingSidebar, isDraggingRight])

  // 鼠标释放处理
  const handleMouseUp = useCallback(() => {
    if (isDraggingSidebar || isDraggingRight) {
      saveWidths()
    }
    setIsDraggingSidebar(false)
    setIsDraggingRight(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [isDraggingSidebar, isDraggingRight, saveWidths])

  // 注册全局鼠标事件
  useEffect(() => {
    if (isDraggingSidebar || isDraggingRight) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingSidebar, isDraggingRight, handleMouseMove, handleMouseUp])

  // 双击重置宽度
  const handleDoubleClick = (panel: 'sidebar' | 'right') => {
    if (panel === 'sidebar') {
      setSidebarWidth(DEFAULT_WIDTHS.sidebar)
      localStorage.setItem('layout_sidebar_width', DEFAULT_WIDTHS.sidebar.toString())
    } else {
      setRightPanelWidth(DEFAULT_WIDTHS.rightPanel)
      localStorage.setItem('layout_right_panel_width', DEFAULT_WIDTHS.rightPanel.toString())
    }
  }

  return (
    <div ref={containerRef} className="flex-1 flex overflow-hidden relative">
      {/* 左侧导航栏 */}
      <div 
        className="flex-shrink-0 border-r border-border bg-muted/20 overflow-hidden relative"
        style={{ width: sidebarWidth }}
      >
        {sidebar}
        
        {/* 拖拽手柄 */}
        <div
          className={cn(
            "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group z-10",
            "hover:bg-primary/30 transition-colors",
            isDraggingSidebar && "bg-primary/50"
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            setIsDraggingSidebar(true)
          }}
          onDoubleClick={() => handleDoubleClick('sidebar')}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-l opacity-0 group-hover:opacity-100 transition-opacity bg-border" />
        </div>
      </div>
      
      {/* 中间工作区 */}
      <div className="flex-1 overflow-hidden border-r border-border relative">
        {workspace}
      </div>
      
      {/* 右侧详情栏 */}
      <div 
        className="flex-shrink-0 overflow-hidden bg-muted/10 relative"
        style={{ width: rightPanelWidth }}
      >
        {/* 拖拽手柄 */}
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group z-10",
            "hover:bg-primary/30 transition-colors",
            isDraggingRight && "bg-primary/50"
          )}
          onMouseDown={(e) => {
            e.preventDefault()
            setIsDraggingRight(true)
          }}
          onDoubleClick={() => handleDoubleClick('right')}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-12 rounded-r opacity-0 group-hover:opacity-100 transition-opacity bg-border" />
        </div>
        
        {rightPanel}
      </div>
      
      {/* 拖拽时的遮罩 */}
      {(isDraggingSidebar || isDraggingRight) && (
        <div className="absolute inset-0 z-20" />
      )}
    </div>
  )
}
