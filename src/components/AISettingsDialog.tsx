'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  Check, 
  X, 
  Loader2, 
  ExternalLink,
  Sparkles,
  AlertCircle,
  Zap,
  Gift,
  Crown,
  Bot,
  Cloud
} from 'lucide-react'

interface AIProviderConfig {
  apiKey: string
  enabled: boolean
}

interface AIConfig {
  zhipu: AIProviderConfig
  aliyun: AIProviderConfig
  byteDance: AIProviderConfig
  tencent: AIProviderConfig
  defaultProvider: string
}

interface AISettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const AI_PROVIDERS = [
  {
    id: 'zhipu',
    name: '智谱AI',
    model: 'GLM-4 Flash',
    icon: Sparkles,
    description: '清华技术团队，每天免费额度',
    freeQuota: '每天约100万tokens免费',
    registerUrl: 'https://open.bigmodel.cn',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 border-blue-200',
  },
  {
    id: 'aliyun',
    name: '阿里云',
    model: '通义千问',
    icon: Cloud,
    description: '阿里云大模型，企业级服务',
    freeQuota: '新用户免费试用',
    registerUrl: 'https://dashscope.console.aliyun.com',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 border-orange-200',
  },
  {
    id: 'byteDance',
    name: '字节跳动',
    model: '豆包大模型',
    icon: Bot,
    description: '字节跳动AI，响应速度快',
    freeQuota: '新用户免费试用',
    registerUrl: 'https://console.volcengine.com/ark',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 border-purple-200',
  },
  {
    id: 'tencent',
    name: '腾讯云',
    model: '混元大模型',
    icon: Crown,
    description: '腾讯混元，多场景适用',
    freeQuota: '新用户免费试用',
    registerUrl: 'https://console.cloud.tencent.com/hunyuan',
    color: 'text-green-600',
    bgColor: 'bg-green-50 border-green-200',
  },
]

export default function AISettingsDialog({
  open,
  onOpenChange
}: AISettingsDialogProps) {
  const [config, setConfig] = useState<AIConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ai_config')
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          return {
            zhipu: parsed.zhipu || { apiKey: '', enabled: false },
            aliyun: parsed.aliyun || { apiKey: '', enabled: false },
            byteDance: parsed.byteDance || { apiKey: '', enabled: false },
            tencent: parsed.tencent || { apiKey: '', enabled: false },
            defaultProvider: parsed.defaultProvider || 'zhipu'
          }
        } catch {
          // ignore
        }
      }
    }
    return {
      zhipu: { apiKey: '', enabled: false },
      aliyun: { apiKey: '', enabled: false },
      byteDance: { apiKey: '', enabled: false },
      tencent: { apiKey: '', enabled: false },
      defaultProvider: 'zhipu'
    }
  })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('zhipu')

  // 测试连接
  const handleTest = async (provider: string) => {
    const apiKey = config[provider as keyof AIConfig]?.apiKey
    if (!apiKey || typeof apiKey !== 'string') return

    setTesting(provider)
    setTestResults(prev => ({ ...prev, [provider]: false as boolean | undefined }))
    try {
      const response = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey })
      })
      
      const result = await response.json()
      setTestResults(prev => ({ ...prev, [provider]: result.success }))
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: false }))
    } finally {
      setTesting(null)
    }
  }

  // 更新API Key
  const updateApiKey = (provider: string, apiKey: string) => {
    setConfig(prev => ({
      ...prev,
      [provider]: { 
        apiKey,
        enabled: apiKey.length > 0
      }
    }))
    setTestResults(prev => ({ ...prev, [provider]: false }))
  }

  // 设置默认平台
  const setDefaultProvider = (provider: string) => {
    setConfig(prev => ({
      ...prev,
      defaultProvider: provider
    }))
  }

  // 保存配置
  const handleSave = async () => {
    setSaving(true)
    try {
      // 1. 保存到本地存储
      localStorage.setItem('ai_config', JSON.stringify(config))
      
      // 2. 同步到后端 Agent 服务（通过前端代理API避免跨域）
      try {
        // 构建后端需要的配置格式
        const backendConfig = {
          providers: {} as Record<string, { api_key: string }>,
          default_provider: config.defaultProvider
        }
        
        // 转换配置格式
        if (config.zhipu?.apiKey) {
          backendConfig.providers.zhipu = { api_key: config.zhipu.apiKey }
        }
        if (config.tencent?.apiKey) {
          backendConfig.providers.hunyuan = { api_key: config.tencent.apiKey }
        }
        if (config.aliyun?.apiKey) {
          backendConfig.providers.qwen = { api_key: config.aliyun.apiKey }
        }
        if (config.byteDance?.apiKey) {
          backendConfig.providers.deepseek = { api_key: config.byteDance.apiKey }
        }
        
        // 调用前端代理API同步配置到后端
        const response = await fetch('/api/agent/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(backendConfig)
        })
        
        if (response.ok) {
          console.log('AI配置已同步到后端')
        } else {
          console.warn('AI配置同步到后端失败:', await response.text())
        }
      } catch (syncError) {
        console.warn('同步AI配置到后端时出错:', syncError)
        // 不阻断保存流程
      }
      
      onOpenChange(false)
    } finally {
      setSaving(false)
    }
  }

  const getProviderConfig = (providerId: string) => {
    return config[providerId as keyof AIConfig] as AIProviderConfig | undefined
  }

  const configuredCount = AI_PROVIDERS.filter(p => (getProviderConfig(p.id)?.apiKey?.length || 0) > 0).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            AI平台配置
            <Badge variant="outline" className="ml-2">
              已配置 {configuredCount}/{AI_PROVIDERS.length} 个
            </Badge>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 说明卡片 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Zap className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  多平台支持，灵活切换
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  • 配置多个AI平台，在分析时可快速切换<br/>
                  • 智谱AI每天有免费额度，推荐优先使用<br/>
                  • 其他平台新用户通常有免费试用额度
                </p>
              </div>
            </div>
          </div>

          {/* 平台选择 */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              {AI_PROVIDERS.map(provider => {
                const Icon = provider.icon
                const hasKey = (getProviderConfig(provider.id)?.apiKey?.length || 0) > 0
                return (
                  <TabsTrigger 
                    key={provider.id} 
                    value={provider.id}
                    className="flex items-center gap-1.5 text-xs"
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{provider.name}</span>
                    {hasKey && (
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>

            {AI_PROVIDERS.map(provider => {
              const Icon = provider.icon
              const providerConfig = getProviderConfig(provider.id)
              const hasKey = (providerConfig?.apiKey?.length || 0) > 0
              const isDefault = config.defaultProvider === provider.id
              
              return (
                <TabsContent key={provider.id} value={provider.id} className="mt-4">
                  <Card className={`border-2 ${provider.bgColor} dark:bg-opacity-20`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Icon className={`h-5 w-5 ${provider.color}`} />
                            <span className="font-medium">{provider.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {provider.model}
                            </Badge>
                            {hasKey && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                已配置
                              </Badge>
                            )}
                            {isDefault && (
                              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                                默认
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {provider.description}
                          </p>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                            <Gift className="h-3 w-3 inline mr-0.5" />
                            {provider.freeQuota}
                          </p>
                        </div>
                        <a 
                          href={provider.registerUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-0.5"
                        >
                          注册/登录 <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>

                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`${provider.id}-key`} className="text-xs">
                            API Key
                          </Label>
                          <div className="flex gap-2">
                            <Input
                              id={`${provider.id}-key`}
                              type="password"
                              placeholder="输入API Key..."
                              value={providerConfig?.apiKey || ''}
                              onChange={(e) => updateApiKey(provider.id, e.target.value)}
                              className="flex-1 h-8 text-sm"
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3"
                              onClick={() => handleTest(provider.id)}
                              disabled={!hasKey || testing === provider.id}
                            >
                              {testing === provider.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : testResults[provider.id] === true ? (
                                <Check className="h-3 w-3 text-green-600" />
                              ) : testResults[provider.id] === false ? (
                                <X className="h-3 w-3 text-red-600" />
                              ) : (
                                '测试'
                              )}
                            </Button>
                          </div>
                        </div>
                        
                        {hasKey && !isDefault && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full h-7 text-xs"
                            onClick={() => setDefaultProvider(provider.id)}
                          >
                            设为默认平台
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              )
            })}
          </Tabs>

          {/* 功能说明 */}
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">配置后可使用功能：</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-green-600" />
                <span>行业深度分析</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-green-600" />
                <span>个股智能诊断</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-green-600" />
                <span>新闻智能解读</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-green-600" />
                <span>投资建议生成</span>
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-xs text-muted-foreground">
              {configuredCount > 0 ? (
                <span className="text-green-600">✓ {configuredCount}个AI平台已就绪</span>
              ) : (
                <span>请至少配置一个AI平台</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    保存中
                  </>
                ) : (
                  '保存配置'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}