'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Bot, X, ChevronUp, ChevronDown, Maximize2, Minimize2, 
  Loader2, Copy, Check, RefreshCw, Settings, Sparkles, Cloud, Crown
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIProvider {
  id: string
  name: string
  icon: any
}

const AI_PROVIDERS: AIProvider[] = [
  { id: 'zhipu', name: '智谱AI', icon: Sparkles },
  { id: 'aliyun', name: '阿里云', icon: Cloud },
  { id: 'byteDance', name: '字节跳动', icon: Bot },
  { id: 'tencent', name: '腾讯混元', icon: Crown },
]

interface FloatingAssistantProps {
  stockCode: string | null
  stockName: string | null
  industry: string | null
  onOpenSettings?: () => void
}

export default function FloatingAssistant({
  stockCode,
  stockName,
  industry,
  onOpenSettings
}: FloatingAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMinimized, setIsMinimized] = useState(true)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  const [config, setConfig] = useState<any>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)

  // 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_config')
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig)
        setConfig(parsed)
        setSelectedProvider(parsed.defaultProvider || 'zhipu')
      } catch {
        setConfig(null)
      }
    }
  }, [])

  // 获取已配置的平台列表
  const getConfiguredProviders = () => {
    if (!config) return []
    return AI_PROVIDERS.filter(p => {
      const providerConfig = config[p.id]
      return providerConfig?.apiKey && providerConfig.apiKey.length > 0
    })
  }

  const configuredProviders = getConfiguredProviders()
  const hasConfig = configuredProviders.length > 0

  // 拖拽功能
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isExpanded) return
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    })
  }

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset])

  // AI分析
  const handleAnalyze = async () => {
    if (!stockCode && !stockName && !industry) {
      setError('请先选择股票或行业')
      return
    }

    const providerConfig = config?.[selectedProvider]
    if (!providerConfig?.apiKey) {
      const provider = AI_PROVIDERS.find(p => p.id === selectedProvider)
      setError(`请先配置${provider?.name || selectedProvider}`)
      return
    }

    setLoading(true)
    setError('')
    setResult('')

    try {
      const type = stockCode ? 'stock' : 'industry'
      const name = stockName || industry || ''
      
      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          name,
          data: stockCode ? { code: stockCode, name: stockName, industry } : null,
          config: { 
            [selectedProvider]: providerConfig,
            defaultProvider: selectedProvider
          },
          provider: selectedProvider
        })
      })

      const data = await response.json()

      if (data.success) {
        setResult(data.analysis)
        setIsMinimized(false)
      } else {
        setError(data.error || '分析失败')
      }
    } catch (err: any) {
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  // 最小化状态 - 显示为小气泡
  if (!isOpen || isMinimized) {
    return (
      <div
        className={cn(
          "fixed z-50 transition-all duration-200",
          isDragging && "cursor-grabbing"
        )}
        style={{ 
          right: position.x, 
          bottom: position.y,
        }}
      >
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          className={cn(
            "bg-primary text-primary-foreground rounded-full shadow-lg cursor-pointer",
            "flex items-center gap-2 px-3 py-2",
            "hover:shadow-xl transition-shadow",
            isDragging && "cursor-grabbing"
          )}
          onClick={() => {
            if (!isDragging) {
              setIsOpen(true)
              setIsMinimized(false)
            }
          }}
        >
          <Bot className="h-4 w-4" />
          <span className="text-sm font-medium">AI助手</span>
          {hasConfig && (
            <span className="w-2 h-2 rounded-full bg-green-400" />
          )}
        </div>
      </div>
    )
  }

  // 展开状态
  return (
    <div
      className={cn(
        "fixed z-50 bg-background border rounded-lg shadow-2xl transition-all duration-200",
        isExpanded 
          ? "inset-4 md:inset-8" 
          : "w-80 h-96 right-4 bottom-4",
        isDragging && !isExpanded && "cursor-grabbing"
      )}
      style={!isExpanded ? { 
        right: position.x, 
        bottom: position.y,
      } : undefined}
    >
      {/* 标题栏 */}
      <div 
        className={cn(
          "flex items-center justify-between px-3 py-2 border-b bg-muted/50 rounded-t-lg",
          !isExpanded && "cursor-grab"
        )}
        onMouseDown={!isExpanded ? handleMouseDown : undefined}
      >
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">AI助手</span>
          {stockName && (
            <Badge variant="outline" className="text-xs">{stockName}</Badge>
          )}
          {industry && !stockName && (
            <Badge variant="outline" className="text-xs">{industry}</Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsMinimized(true)}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsOpen(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex flex-col h-[calc(100%-44px)]">
        {/* 平台选择 */}
        {hasConfig && (
          <div className="flex items-center gap-2 px-3 py-2 border-b">
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger className="h-7 w-28 text-xs">
                <SelectValue placeholder="选择平台" />
              </SelectTrigger>
              <SelectContent>
                {configuredProviders.map(p => {
                  const Icon = p.icon
                  return (
                    <SelectItem key={p.id} value={p.id} className="text-xs">
                      <div className="flex items-center gap-1.5">
                        <Icon className="h-3 w-3" />
                        {p.name}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              className="h-7 flex-1"
              onClick={handleAnalyze}
              disabled={loading || (!stockCode && !stockName && !industry)}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 mr-1" />
              )}
              {loading ? '分析中' : '开始分析'}
            </Button>
          </div>
        )}

        {/* 未配置提示 */}
        {!hasConfig && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">请先配置AI平台</p>
              <Button size="sm" variant="outline" onClick={onOpenSettings}>
                <Settings className="h-3 w-3 mr-1" />
                去配置
              </Button>
            </div>
          </div>
        )}

        {/* 结果显示 */}
        {hasConfig && (
          <ScrollArea className="flex-1">
            <div className="p-3">
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded p-2">
                  {error}
                </div>
              )}
              {result && (
                <div className="space-y-2">
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={handleCopy}>
                      {copied ? <Check className="h-3 w-3 mr-1 text-green-600" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </div>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed font-sans bg-muted/30 rounded p-2">
                    {result}
                  </pre>
                </div>
              )}
              {!result && !error && (
                <div className="text-center text-muted-foreground text-xs py-8">
                  点击"开始分析"进行AI诊断
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
