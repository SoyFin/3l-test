'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  Upload, FileSpreadsheet, Loader2, AlertTriangle, CheckCircle, 
  Trash2, Calendar, History, RefreshCw, ChevronLeft, ChevronRight, Database
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DataUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplete: () => void
}

// 周度数据历史记录
interface WeeklyHistoryItem {
  weekDate: string
  stockCount: number
  createdAt: string
}

export default function DataUploadDialog({
  open,
  onOpenChange,
  onComplete
}: DataUploadDialogProps) {
  const [uploading, setUploading] = useState(false)
  const [weeklyFile, setWeeklyFile] = useState<File | null>(null)
  const [allStocksFile, setAllStocksFile] = useState<File | null>(null)
  const [uploadResult, setUploadResult] = useState<{
    success: boolean
    message: string
    details?: string
    warnings?: string[]
  } | null>(null)
  
  // 日期选择
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deletingDate, setDeletingDate] = useState<string | null>(null)
  
  // 日历显示的年月
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  
  const weeklyInputRef = useRef<HTMLInputElement>(null)
  const allStocksInputRef = useRef<HTMLInputElement>(null)

  // 初始化日期为今天
  useEffect(() => {
    if (open && !selectedDate) {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      setSelectedDate(`${year}-${month}-${day}`)
    }
  }, [open, selectedDate])

  // 加载历史数据
  useEffect(() => {
    if (open) {
      fetchWeeklyHistory()
    }
  }, [open])

  const fetchWeeklyHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch('/api/upload?type=weekly')
      const data = await response.json()
      if (data.history) {
        setWeeklyHistory(data.history.map((item: any) => ({
          weekDate: item.weekDate, // 保持原始格式
          stockCount: (item.stocks as any[])?.length || 0,
          createdAt: item.createdAt
        })))
      }
    } catch (error) {
      console.error('Fetch history error:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  // 对话框关闭时清除结果
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setUploadResult(null)
    }
    onOpenChange(newOpen)
  }

  const handleWeeklyUpload = async () => {
    if (!weeklyFile) return
    
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', weeklyFile)
      formData.append('type', 'weekly')
      formData.append('weekDate', selectedDate)
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        setWeeklyFile(null)
        if (weeklyInputRef.current) {
          weeklyInputRef.current.value = ''
        }
        
        setUploadResult({
          success: true,
          message: data.message || '上传成功',
          details: `共${data.totalStocks}只股票，${data.momentumIndustries}个行业上榜`,
          warnings: data.dataQualityWarnings || (data.warning ? [data.warning] : undefined)
        })
        
        fetchWeeklyHistory()
        onComplete()
      } else {
        setUploadResult({
          success: false,
          message: '上传失败',
          details: data.error || data.message
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        message: '上传失败',
        details: '网络错误，请重试'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleAllStocksUpload = async () => {
    if (!allStocksFile) return
    
    setUploading(true)
    setUploadResult(null)
    try {
      const formData = new FormData()
      formData.append('file', allStocksFile)
      formData.append('type', 'all')
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })
      
      const data = await response.json()
      
      if (data.success) {
        setAllStocksFile(null)
        if (allStocksInputRef.current) {
          allStocksInputRef.current.value = ''
        }
        
        setUploadResult({
          success: true,
          message: data.message || '上传成功',
          details: `共${data.totalStocks}只股票，${data.totalIndustries}个行业`
        })
        
        onComplete()
      } else {
        setUploadResult({
          success: false,
          message: '上传失败',
          details: data.error || data.message
        })
      }
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({
        success: false,
        message: '上传失败',
        details: '网络错误，请重试'
      })
    } finally {
      setUploading(false)
    }
  }

  // 删除周度数据
  const handleDeleteWeekly = async (weekDate: string) => {
    if (!confirm(`确定要删除 ${weekDate} 的周度数据吗？\n\n此操作将同时删除该周的动量数据，不可恢复！`)) {
      return
    }
    
    setDeletingDate(weekDate)
    try {
      const response = await fetch(`/api/upload?weekDate=${weekDate}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      
      if (data.success) {
        setUploadResult({
          success: true,
          message: '删除成功',
          details: `已删除 ${weekDate} 的数据`
        })
        fetchWeeklyHistory()
        onComplete()
      } else {
        setUploadResult({
          success: false,
          message: '删除失败',
          details: data.error
        })
      }
    } catch (error) {
      console.error('Delete error:', error)
      setUploadResult({
        success: false,
        message: '删除失败',
        details: '网络错误，请重试'
      })
    } finally {
      setDeletingDate(null)
    }
  }

  // 获取已有数据的日期集合
  const existingDates = useMemo(() => {
    return new Set(weeklyHistory.map(item => item.weekDate))
  }, [weeklyHistory])

  // 日历导航
  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11)
      setCalendarYear(calendarYear - 1)
    } else {
      setCalendarMonth(calendarMonth - 1)
    }
  }

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0)
      setCalendarYear(calendarYear + 1)
    } else {
      setCalendarMonth(calendarMonth + 1)
    }
  }

  // 格式化日期为 YYYY-MM-DD（本地时间，避免时区问题）
  const formatDate = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // 生成日历网格
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1)
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0)
    const startPadding = firstDay.getDay() // 周日为0
    
    const days: Array<{ date: string; isCurrentMonth: boolean; hasData: boolean; stockCount?: number }> = []
    
    // 上月填充
    for (let i = startPadding - 1; i >= 0; i--) {
      const d = new Date(calendarYear, calendarMonth, -i)
      const dateStr = formatDate(d)
      const historyItem = weeklyHistory.find(h => h.weekDate === dateStr)
      days.push({
        date: dateStr,
        isCurrentMonth: false,
        hasData: existingDates.has(dateStr),
        stockCount: historyItem?.stockCount
      })
    }
    
    // 当月日期
    for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(calendarYear, calendarMonth, i)
      const dateStr = formatDate(d)
      const historyItem = weeklyHistory.find(h => h.weekDate === dateStr)
      days.push({
        date: dateStr,
        isCurrentMonth: true,
        hasData: existingDates.has(dateStr),
        stockCount: historyItem?.stockCount
      })
    }
    
    // 下月填充
    const remaining = 42 - days.length // 6行
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(calendarYear, calendarMonth + 1, i)
      const dateStr = formatDate(d)
      const historyItem = weeklyHistory.find(h => h.weekDate === dateStr)
      days.push({
        date: dateStr,
        isCurrentMonth: false,
        hasData: existingDates.has(dateStr),
        stockCount: historyItem?.stockCount
      })
    }
    
    return days
  }, [calendarYear, calendarMonth, existingDates, weeklyHistory])

  const monthNames = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据管理
          </DialogTitle>
          <DialogDescription>
            管理周度动量数据和全A数据，日历显示已有数据的日期
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="weekly" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="weekly" className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              周度数据
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-1">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              全A数据
            </TabsTrigger>
          </TabsList>

          {/* 上传结果显示 */}
          {uploadResult && (
            <Alert variant={uploadResult.success ? 'default' : 'destructive'} className={uploadResult.success ? 'border-green-200 bg-green-50 dark:bg-green-900/20' : ''}>
              {uploadResult.success ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertTitle className={uploadResult.success ? 'text-green-800 dark:text-green-200' : ''}>
                {uploadResult.message}
              </AlertTitle>
              <AlertDescription className={uploadResult.success ? 'text-green-700 dark:text-green-300' : ''}>
                {uploadResult.details}
                {uploadResult.warnings && uploadResult.warnings.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {uploadResult.warnings.map((w, i) => (
                      <p key={i} className="text-amber-700 dark:text-amber-300 text-xs font-medium">{w}</p>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* 周度数据管理 - 日历+上传整合 */}
          <TabsContent value="weekly" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 左侧：日历 */}
              <div className="border rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="sm" onClick={prevMonth} className="h-7 w-7 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-medium text-sm">
                    {calendarYear}年 {monthNames[calendarMonth]}
                  </span>
                  <Button variant="ghost" size="sm" onClick={nextMonth} className="h-7 w-7 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* 星期标题 */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
                    <div key={d} className="text-center text-xs py-1 text-muted-foreground">
                      {d}
                    </div>
                  ))}
                </div>
                
                {/* 日历网格 */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((day, index) => (
                    <button
                      key={index}
                      onClick={() => {
                        setSelectedDate(day.date)
                      }}
                      className={cn(
                        "relative aspect-square rounded text-xs flex flex-col items-center justify-center transition-colors",
                        !day.isCurrentMonth && "text-muted-foreground opacity-50",
                        "hover:bg-primary/20 cursor-pointer",
                        selectedDate === day.date && "bg-primary text-primary-foreground",
                        day.hasData && selectedDate !== day.date && "bg-green-100 dark:bg-green-900/30",
                        !day.hasData && selectedDate !== day.date && "border border-transparent hover:border-primary/30"
                      )}
                      title={day.hasData ? `${day.date} (已有${day.stockCount}只股票)` : `${day.date} (点击选择)`}
                    >
                      <span>{parseInt(day.date.split('-')[2])}</span>
                      {day.hasData && (
                        <span className={cn(
                          "absolute bottom-0.5 w-1.5 h-1.5 rounded-full bg-green-500",
                          selectedDate === day.date && "bg-primary-foreground"
                        )} />
                      )}
                    </button>
                  ))}
                </div>
                
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    <span>已有数据</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 h-3 bg-primary rounded" />
                    <span>选中日期</span>
                  </div>
                </div>
              </div>
              
              {/* 右侧：上传和操作 */}
              <div className="space-y-4">
                {/* 当前选中日期 */}
                <div className="border rounded-lg p-3 bg-muted/30">
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4" />
                    选中日期：{selectedDate}
                  </Label>
                  
                  {selectedDate && existingDates.has(selectedDate) && (
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                        已有数据：{weeklyHistory.find(h => h.weekDate === selectedDate)?.stockCount || 0}只股票
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteWeekly(selectedDate)}
                        disabled={deletingDate === selectedDate}
                      >
                        {deletingDate === selectedDate ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            删除
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {/* 文件上传 */}
                  <div className="border-2 border-dashed rounded-lg p-4 text-center mt-2">
                    <input
                      ref={weeklyInputRef}
                      type="file"
                      accept=".xls,.xlsx,.csv"
                      className="hidden"
                      onChange={(e) => setWeeklyFile(e.target.files?.[0] || null)}
                    />
                    <FileSpreadsheet className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    {weeklyFile ? (
                      <p className="text-sm font-medium mb-2">{weeklyFile.name}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground mb-2">点击选择文件</p>
                    )}
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => weeklyInputRef.current?.click()}
                    >
                      选择文件
                    </Button>
                  </div>
                  
                  <Button 
                    className="w-full mt-3" 
                    onClick={handleWeeklyUpload}
                    disabled={!weeklyFile || uploading || !selectedDate}
                    size="sm"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        上传到 {selectedDate}
                      </>
                    )}
                  </Button>
                </div>
                
                {/* 数据说明 */}
                <div className="text-xs text-muted-foreground space-y-1 px-1">
                  <p>• 点击日历中的任意日期选择</p>
                  <p>• 绿色圆点表示该日已有数据</p>
                  <p>• 上传会覆盖已有数据</p>
                </div>
              </div>
            </div>
            
            {/* 历史数据列表 */}
            <div className="border rounded-lg">
              <div className="flex items-center justify-between px-3 py-2 border-b">
                <h4 className="text-sm font-medium">全部历史数据 ({weeklyHistory.length}周)</h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchWeeklyHistory}
                  disabled={loadingHistory}
                  className="h-6"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingHistory && "animate-spin")} />
                </Button>
              </div>
              <ScrollArea className="h-[150px]">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : weeklyHistory.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8 text-sm">
                    暂无历史数据
                  </div>
                ) : (
                  <div className="divide-y">
                    {weeklyHistory.map((item) => (
                      <div 
                        key={item.weekDate}
                        className={cn(
                          "flex items-center justify-between px-3 py-2 hover:bg-muted/50",
                          selectedDate === item.weekDate && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            selectedDate === item.weekDate ? "bg-primary" : "bg-green-500"
                          )} />
                          <div>
                            <p className="text-sm font-medium">{item.weekDate}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.stockCount} 只股票
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteWeekly(item.weekDate)}
                          disabled={deletingDate === item.weekDate}
                        >
                          {deletingDate === item.weekDate ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </TabsContent>

          {/* 全A数据上传 */}
          <TabsContent value="all" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                ref={allStocksInputRef}
                type="file"
                accept=".xls,.xlsx,.csv"
                className="hidden"
                onChange={(e) => setAllStocksFile(e.target.files?.[0] || null)}
              />
              <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground mb-2">
                支持 .xls, .xlsx, .csv 格式
              </p>
              <Button 
                variant="outline" 
                onClick={() => allStocksInputRef.current?.click()}
              >
                选择文件
              </Button>
              {allStocksFile && (
                <p className="mt-2 text-sm font-medium">{allStocksFile.name}</p>
              )}
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>• 文件应包含：代码、名称、二级行业</p>
              <p>• 用于计算各行业成分数量</p>
              <p>• 建议每季度末更新</p>
            </div>

            <Button 
              className="w-full" 
              onClick={handleAllStocksUpload}
              disabled={!allStocksFile || uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  上传中...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  上传全A数据
                </>
              )}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}