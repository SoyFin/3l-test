'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
  Sparkles, 
  Loader2, 
  Copy, 
  Check,
  AlertCircle,
  Settings,
  RefreshCw,
  Bot,
  Cloud,
  Crown
} from 'lucide-react'

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

interface AIAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  type: 'industry' | 'stock' | 'news'
  name: string
  data?: any
  news?: any[]
  newsType?: 'industry' | 'stock'
  onOpenSettings?: () => void
}

export default function AIAnalysisDialog({
  open,
  onOpenChange,
  type,
  name,
  data,
  news,
  newsType,
  onOpenSettings
}: AIAnalysisDialogProps) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [selectedProvider, setSelectedProvider] = useState<string>('')

  // 加载配置
  useEffect(() => {
    if (open) {
      const savedConfig = localStorage.getItem('ai_config')
      if (savedConfig) {
        try {
          const parsed = JSON.parse(savedConfig)
          setConfig(parsed)
          // 设置默认平台
          setSelectedProvider(parsed.defaultProvider || 'zhipu')
        } catch {
          setConfig(null)
        }
      } else {
        setConfig(null)
      }
      // 重置状态
      setResult('')
      setError('')
    }
  }, [open])

  // 获取已配置的平台列表
  const getConfiguredProviders = () => {
    if (!config) return []
    return AI_PROVIDERS.filter(p => {
      const providerConfig = config[p.id]
      return providerConfig?.apiKey && providerConfig.apiKey.length > 0
    })
  }

  // 开始分析
  const handleAnalyze = async () => {
    if (!selectedProvider) {
      setError('请选择AI平台')
      return
    }

    const providerConfig = config?.[selectedProvider]
    if (!providerConfig?.apiKey) {
      const provider = AI_PROVIDERS.find(p => p.id === selectedProvider)
      setError(`请先配置${provider?.name || selectedProvider}的API Key`)
      return
    }

    setLoading(true)
    setError('')
    setResult('')

    try {
      const requestBody: any = {
        type,
        name,
        data,
        config: { 
          [selectedProvider]: providerConfig,
          defaultProvider: selectedProvider
        },
        provider: selectedProvider
      }

      if (type === 'news' && news) {
        requestBody.news = news
        requestBody.newsType = newsType
      }

      const response = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (result.success) {
        setResult(result.analysis)
      } else {
        setError(result.error || '分析失败，请重试')
      }
    } catch (err: any) {
      setError(err.message || '网络请求失败')
    } finally {
      setLoading(false)
    }
  }

  // 复制结果
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Copy failed:', err)
    }
  }

  // 自动开始分析（当有配置时）
  useEffect(() => {
    if (open && config && selectedProvider && !result && !loading) {
      const providers = getConfiguredProviders()
      if (providers.length > 0) {
        handleAnalyze()
      }
    }
  }, [open, config, selectedProvider])

  const configuredProviders = getConfiguredProviders()
  const hasConfig = configuredProviders.length > 0

  // 获取标题
  const getTitle = () => {
    switch (type) {
      case 'industry': return 'AI行业分析'
      case 'stock': return 'AI个股诊断'
      case 'news': return 'AI新闻解读'
      default: return 'AI分析'
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {getTitle()}
            <Badge variant="outline" className="ml-2">{name}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          {/* 平台选择 */}
          {hasConfig && (
            <div className="flex items-center gap-3 mb-4">
              <span className="text-sm text-muted-foreground">AI平台:</span>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-40 h-8">
                  <SelectValue placeholder="选择平台" />
                </SelectTrigger>
                <SelectContent>
                  {configuredProviders.map(p => {
                    const Icon = p.icon
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {p.name}
                        </div>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={handleAnalyze}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                )}
                {loading ? '分析中' : '重新分析'}
              </Button>
            </div>
          )}

          {/* 未配置提示 */}
          {!hasConfig && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    请先配置AI平台
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-300 mt-1">
                    支持智谱AI（每天免费额度）、阿里云、字节跳动、腾讯混元等多个平台
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      onOpenChange(false)
                      onOpenSettings?.()
                    }}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    去配置
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 加载状态 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
              <p className="text-sm text-muted-foreground">
                AI正在分析中，请稍候...
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                首次分析可能需要10-30秒
              </p>
            </div>
          )}

          {/* 错误提示 */}
          {error && !loading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">
                    分析失败
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                    {error}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleAnalyze}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    重试
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 分析结果 */}
          {result && !loading && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">分析结果</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 mr-1 text-green-600" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      复制
                    </>
                  )}
                </Button>
              </div>
              
              <ScrollArea className="h-[400px] w-full rounded-lg border bg-muted/30 p-4">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans">
                    {result}
                  </pre>
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
