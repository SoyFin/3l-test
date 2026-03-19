'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { 
  Moon, Sun, Upload, Bell, RefreshCw, Database, Settings, Clock,
  Sparkles, Cloud, Bot, Crown, Check
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ReminderInfo } from '@/types'

interface HeaderProps {
  theme: 'light' | 'dark'
  onToggleTheme: () => void
  onOpenUpload: () => void
  onOpenReminder: () => void
  onOpenAISettings: () => void
  onOpenFundamentals: () => void
  onRefresh: () => void
  loading: boolean
  reminder: ReminderInfo | null
  lastRefreshTime: Date | null
  autoRefreshInterval: number
  onAutoRefreshChange: (seconds: number) => void
}

const AUTO_REFRESH_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '15分钟', value: 900 },
]

const AI_PROVIDERS = [
  { id: 'zhipu', name: '智谱AI', icon: Sparkles },
  { id: 'aliyun', name: '阿里云', icon: Cloud },
  { id: 'byteDance', name: '字节跳动', icon: Bot },
  { id: 'tencent', name: '腾讯混元', icon: Crown },
]

export default function Header({
  theme,
  onToggleTheme,
  onOpenUpload,
  onOpenReminder,
  onOpenAISettings,
  onOpenFundamentals,
  onRefresh,
  loading,
  reminder,
  lastRefreshTime,
  autoRefreshInterval,
  onAutoRefreshChange
}: HeaderProps) {
  const { toast } = useToast()
  const [config, setConfig] = useState<any>(null)

  // 加载配置
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_config')
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig))
      } catch {
        setConfig(null)
      }
    }
  }, [])

  // 刷新时重新加载配置
  useEffect(() => {
    const handleStorageChange = () => {
      const savedConfig = localStorage.getItem('ai_config')
      if (savedConfig) {
        try {
          setConfig(JSON.parse(savedConfig))
        } catch {
          setConfig(null)
        }
      }
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  // 获取当前默认AI平台信息
  const getDefaultProviderInfo = () => {
    const defaultId = config?.defaultProvider || 'zhipu'
    const provider = AI_PROVIDERS.find(p => p.id === defaultId)
    const hasKey = config?.[defaultId]?.apiKey?.length > 0
    return { provider, hasKey, defaultId }
  }

  const { provider: defaultProvider, hasKey, defaultId } = getDefaultProviderInfo()
  const DefaultIcon = defaultProvider?.icon || Sparkles

  const formatLastRefresh = () => {
    if (!lastRefreshTime) return ''
    return lastRefreshTime.toLocaleTimeString()
  }

  return (
    <header className="h-11 border-b flex items-center justify-between px-4 bg-background flex-shrink-0">
      {/* 中间信息区 */}
      <div className="flex-1 flex items-center justify-center gap-4">
        {/* 自动刷新 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`h-7 gap-1.5 text-xs ${autoRefreshInterval > 0 ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Clock className="h-3.5 w-3.5" />
              {autoRefreshInterval === 0 ? '自动刷新' : `${autoRefreshInterval / 60}分钟`}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            <DropdownMenuLabel>自动刷新间隔</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AUTO_REFRESH_OPTIONS.map((option) => (
              <DropdownMenuItem 
                key={option.value}
                onClick={() => onAutoRefreshChange(option.value)}
                className="text-xs"
              >
                {option.label}
                {autoRefreshInterval === option.value && (
                  <Check className="h-3 w-3 ml-auto" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 最后更新时间 */}
        {lastRefreshTime && (
          <span className="text-xs text-muted-foreground">
            更新: {formatLastRefresh()}
          </span>
        )}
      </div>

      {/* 右侧操作区 */}
      <div className="flex items-center gap-1">
        {/* AI平台快速切换 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 gap-1.5">
              <DefaultIcon className="h-3.5 w-3.5" />
              <span className="text-xs">{defaultProvider?.name || 'AI'}</span>
              {hasKey && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>AI平台</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {AI_PROVIDERS.map(p => {
              const Icon = p.icon
              const pHasKey = config?.[p.id]?.apiKey?.length > 0
              const isDefault = defaultId === p.id
              return (
                <DropdownMenuItem 
                  key={p.id}
                  onClick={() => {
                    // 更新默认平台
                    const newConfig = { ...config, defaultProvider: p.id }
                    localStorage.setItem('ai_config', JSON.stringify(newConfig))
                    setConfig(newConfig)
                    toast({ title: `已切换到${p.name}` })
                  }}
                  className="text-xs"
                >
                  <Icon className="h-3.5 w-3.5 mr-1.5" />
                  {p.name}
                  {pHasKey && (
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-1" />
                  )}
                  {isDefault && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onOpenAISettings} className="text-xs">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              配置API Key
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-4 bg-border mx-1" />

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onRefresh} 
          disabled={loading}
          title="刷新数据"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onOpenAISettings}
          title="AI设置"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onOpenFundamentals}
          title="更新基本面"
        >
          <Database className="h-3.5 w-3.5" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0 relative"
          onClick={onOpenReminder}
          title="提醒"
        >
          <Bell className="h-3.5 w-3.5" />
          {(reminder?.weekly?.needed || reminder?.quarterly?.needed) && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
          )}
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onOpenUpload}
          title="上传数据"
        >
          <Upload className="h-3.5 w-3.5" />
        </Button>

        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 w-7 p-0"
          onClick={onToggleTheme}
          title="切换主题"
        >
          {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </header>
  )
}
