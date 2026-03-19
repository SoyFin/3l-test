'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Moon, Sun, Upload, Bell, RefreshCw, Database, Settings, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/hooks/use-toast'
import Sidebar from '@/components/layout/Sidebar'
import Workspace from '@/components/layout/Workspace'
import StockDetailPanel from '@/components/StockDetailPanel'
import ResizableLayout from '@/components/ResizableLayout'
import DataUploadDialog from '@/components/DataUploadDialog'
import ReminderDialog from '@/components/ReminderDialog'
import AISettingsDialog from '@/components/AISettingsDialog'
import FundamentalsUpdateDialog from '@/components/FundamentalsUpdateDialog'
import PromptManagerDialog from '@/components/PromptManagerDialog'
import { MomentumRankingItem, ReminderInfo } from '@/types'

// 自动刷新间隔选项
const AUTO_REFRESH_OPTIONS = [
  { label: '关闭', value: 0 },
  { label: '1分钟', value: 60 },
  { label: '5分钟', value: 300 },
  { label: '15分钟', value: 900 },
  { label: '30分钟', value: 1800 },
]

export default function Home() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [ranking, setRanking] = useState<MomentumRankingItem[]>([])
  const [trendData, setTrendData] = useState<Record<string, { weekDate: string; score: number }[]>>({})
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null)
  const [selectedStock, setSelectedStock] = useState<string | null>(null)
  const [selectedStockName, setSelectedStockName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false)
  const [aiSettingsOpen, setAISettingsOpen] = useState(false)
  const [fundamentalsDialogOpen, setFundamentalsDialogOpen] = useState(false)
  const [promptManagerOpen, setPromptManagerOpen] = useState(false)
  const [reminder, setReminder] = useState<ReminderInfo | null>(null)
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(0)
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { toast } = useToast()

  // 初始化主题和设置
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null
    if (savedTheme) {
      setTheme(savedTheme)
      document.documentElement.classList.toggle('dark', savedTheme === 'dark')
    }
    
    const savedInterval = localStorage.getItem('auto_refresh_interval')
    if (savedInterval) {
      setAutoRefreshInterval(parseInt(savedInterval) || 0)
    }
  }, [])

  // 获取动量数据
  const fetchMomentum = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      const response = await fetch('/api/momentum')
      const data = await response.json()
      
      if (data.ranking) {
        setRanking(data.ranking)
      }
      if (data.trendData) {
        setTrendData(data.trendData)
      }
      if (data.reminder) {
        setReminder(data.reminder)
      }
      setLastRefreshTime(new Date())
      
      if (silent) {
        toast({
          title: '数据已自动刷新',
          description: `最近更新: ${new Date().toLocaleTimeString()}`,
        })
      }
    } catch (error) {
      console.error('Fetch momentum error:', error)
      if (!silent) {
        toast({
          title: '获取数据失败',
          description: '请检查网络连接或刷新页面重试',
          variant: 'destructive'
        })
      }
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchMomentum()
  }, [fetchMomentum])

  // 自动刷新定时器
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    if (autoRefreshInterval > 0) {
      intervalRef.current = setInterval(() => {
        fetchMomentum(true)
      }, autoRefreshInterval * 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefreshInterval, fetchMomentum])

  // 切换主题
  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    document.documentElement.classList.toggle('dark', newTheme === 'dark')
    localStorage.setItem('theme', newTheme)
  }, [theme])

  // 处理数据上传完成
  const handleUploadComplete = useCallback(() => {
    setUploadDialogOpen(false)
    fetchMomentum()
    toast({
      title: '上传成功',
      description: '数据已更新'
    })
  }, [fetchMomentum, toast])

  // 处理行业选择
  const handleSelectIndustry = useCallback((industry: string) => {
    setSelectedIndustry(industry)
    // 选择新行业时清空选中的股票
    setSelectedStock(null)
    setSelectedStockName(null)
  }, [])

  // 处理股票选择
  const handleSelectStock = useCallback((code: string, name: string) => {
    setSelectedStock(code)
    setSelectedStockName(name)
  }, [])

  // 更新自动刷新间隔
  const updateAutoRefresh = (seconds: number) => {
    setAutoRefreshInterval(seconds)
    localStorage.setItem('auto_refresh_interval', seconds.toString())
    
    if (seconds > 0) {
      toast({
        title: '自动刷新已开启',
        description: `每${seconds >= 60 ? `${seconds / 60}分钟` : `${seconds}秒`}自动刷新数据`
      })
    } else {
      toast({
        title: '自动刷新已关闭'
      })
    }
  }

  // 更新基本面数据
  const handleUpdateFundamentals = useCallback(async () => {
    try {
      const response = await fetch('/api/fundamentals/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'top', limit: 200 })
      })
      
      // 检查响应类型
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text()
        console.error('Non-JSON response:', text.slice(0, 200))
        if (text.includes('502') || text.includes('Bad Gateway')) {
          return { success: false, message: '服务器网关错误，请稍后重试', error: '服务器网关错误' }
        }
        return { success: false, message: '服务器响应异常，请稍后重试', error: '服务器响应异常' }
      }
      
      const data = await response.json()
      
      if (data.success) {
        fetchMomentum()
        return { 
          success: true, 
          message: '更新完成',
          output: data.output 
        }
      } else {
        return { 
          success: false, 
          message: data.error || '更新失败',
          error: data.error 
        }
      }
    } catch (error: any) {
      console.error('Update fundamentals error:', error)
      return { 
        success: false, 
        message: error.message || '网络请求失败',
        error: error.message 
      }
    }
  }, [fetchMomentum])

  const formatLastRefresh = () => {
    if (!lastRefreshTime) return ''
    return lastRefreshTime.toLocaleTimeString()
  }

  return (
    <div className={`h-screen flex flex-col ${theme}`}>
      {/* 顶部导航栏 */}
      <header className="h-11 border-b flex items-center justify-between px-4 bg-background flex-shrink-0">
        {/* 左侧Logo区 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-xs font-bold text-primary-foreground">3L</span>
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold">3L投研平台</h1>
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">v2.1</Badge>
          {lastRefreshTime && (
            <span className="text-xs text-muted-foreground hidden md:inline">
              更新: {formatLastRefresh()}
            </span>
          )}
        </div>
        
        {/* 右侧操作区 */}
        <div className="flex items-center gap-1">
          {/* 自动刷新 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className={`h-7 gap-1 text-xs ${autoRefreshInterval > 0 ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {autoRefreshInterval === 0 ? '自动' : `${autoRefreshInterval / 60}分`}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>自动刷新间隔</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {AUTO_REFRESH_OPTIONS.map((option) => (
                <DropdownMenuItem 
                  key={option.value}
                  onClick={() => updateAutoRefresh(option.value)}
                  className="text-xs"
                >
                  {option.label}
                  {autoRefreshInterval === option.value && (
                    <Badge variant="outline" className="ml-auto text-xs">当前</Badge>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="w-px h-4 bg-border mx-0.5" />

          <Button variant="ghost" size="sm" onClick={() => fetchMomentum()} disabled={loading} className="h-7 w-7 p-0" title="刷新">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setAISettingsOpen(true)} className="h-7 w-7 p-0" title="AI设置">
            <Settings className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setFundamentalsDialogOpen(true)} className="h-7 w-7 p-0" title="更新基本面">
            <Database className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setPromptManagerOpen(true)} className="h-7 w-7 p-0" title="提示词管理">
            <FileText className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setReminderDialogOpen(true)} className="h-7 w-7 p-0 relative" title="提醒">
            <Bell className="h-3.5 w-3.5" />
            {(reminder?.weekly?.needed || reminder?.quarterly?.needed) && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-red-500 rounded-full" />
            )}
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setUploadDialogOpen(true)} className="h-7 w-7 p-0" title="上传数据">
            <Upload className="h-3.5 w-3.5" />
          </Button>

          <Button variant="ghost" size="sm" onClick={toggleTheme} className="h-7 w-7 p-0" title="切换主题">
            {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      {/* 主内容区 - 可调节布局 */}
      <ResizableLayout
        sidebar={
          <Sidebar
            ranking={ranking}
            trendData={trendData}
            selectedIndustry={selectedIndustry}
            onSelectIndustry={handleSelectIndustry}
            loading={loading}
          />
        }
        workspace={
          <Workspace
            industry={selectedIndustry}
            onSelectStock={handleSelectStock}
            selectedStockCode={selectedStock}
            onOpenAISettings={() => setAISettingsOpen(true)}
          />
        }
        rightPanel={
          <StockDetailPanel
            stockCode={selectedStock}
            stockName={selectedStockName}
            industry={selectedIndustry}
            onOpenAISettings={() => setAISettingsOpen(true)}
          />
        }
      />

      {/* 对话框 */}
      <DataUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onComplete={handleUploadComplete}
      />

      <ReminderDialog
        open={reminderDialogOpen}
        onOpenChange={setReminderDialogOpen}
        reminder={reminder}
        onUploadClick={() => {
          setReminderDialogOpen(false)
          setUploadDialogOpen(true)
        }}
      />

      <AISettingsDialog
        open={aiSettingsOpen}
        onOpenChange={setAISettingsOpen}
      />

      <FundamentalsUpdateDialog
        open={fundamentalsDialogOpen}
        onOpenChange={setFundamentalsDialogOpen}
        onUpdate={handleUpdateFundamentals}
      />

      {/* 提示词管理 */}
      <PromptManagerDialog
        open={promptManagerOpen}
        onOpenChange={setPromptManagerOpen}
      />
    </div>
  )
}
