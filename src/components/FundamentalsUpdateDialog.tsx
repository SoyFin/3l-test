'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'

interface FundamentalsUpdateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => Promise<{ success: boolean; message: string; output?: string; error?: string }>
}

type Status = 'idle' | 'updating' | 'success' | 'error'

export default function FundamentalsUpdateDialog({
  open,
  onOpenChange,
  onUpdate
}: FundamentalsUpdateDialogProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState(0)
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState('')
  const [errorInfo, setErrorInfo] = useState('')

  useEffect(() => {
    if (open) {
      handleUpdate()
    } else {
      // 重置状态
      setStatus('idle')
      setProgress(0)
      setMessage('')
      setDetail('')
      setErrorInfo('')
    }
  }, [open])

  const handleUpdate = async () => {
    setStatus('updating')
    setProgress(10)
    setMessage('正在连接数据源...')
    
    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev
          return prev + Math.random() * 10
        })
      }, 2000)
      
      setProgress(20)
      setMessage('正在获取股票列表...')
      
      await new Promise(resolve => setTimeout(resolve, 500))
      setMessage('正在获取基本面数据...')
      
      const result = await onUpdate()
      
      clearInterval(progressInterval)
      
      if (result.success) {
        setProgress(100)
        setStatus('success')
        setMessage('更新完成！')
        setDetail(result.output || '')
      } else {
        setStatus('error')
        setMessage('更新失败')
        setErrorInfo(result.error || result.message || '未知错误')
      }
    } catch (error: any) {
      setStatus('error')
      setMessage('更新失败')
      setErrorInfo(error.message || '网络请求失败，请检查服务器状态')
    }
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'updating':
        return <Loader2 className="h-8 w-8 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <XCircle className="h-8 w-8 text-red-500" />
      default:
        return <AlertCircle className="h-8 w-8 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case 'updating':
        return 'text-blue-600'
      case 'success':
        return 'text-green-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>更新基本面数据</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center py-6 space-y-4">
          {getStatusIcon()}
          
          <p className={`text-lg font-medium ${getStatusColor()}`}>
            {message}
          </p>
          
          {status === 'updating' && (
            <div className="w-full space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                正在从AkShare获取数据，预计需要1-3分钟...
              </p>
            </div>
          )}
          
          {status === 'success' && detail && (
            <div className="w-full bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground max-h-32 overflow-auto">
              <pre className="whitespace-pre-wrap">{detail}</pre>
            </div>
          )}
          
          {status === 'error' && errorInfo && (
            <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-700 dark:text-red-300 font-medium mb-1">错误信息：</p>
              <p className="text-xs text-red-600 dark:text-red-400">{errorInfo}</p>
            </div>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          {status === 'error' && (
            <Button variant="outline" onClick={handleUpdate}>
              重试
            </Button>
          )}
          <Button 
            variant={status === 'success' ? 'default' : 'secondary'}
            onClick={() => onOpenChange(false)}
            disabled={status === 'updating'}
          >
            {status === 'success' ? '完成' : '关闭'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
