'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Bot, Settings, Database, Zap, ChevronRight, Check, 
  Activity, Layers, Cpu, Globe, RefreshCw 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Module {
  id: string
  name: string
  description: string
  cache_ttl: number
}

interface Agent {
  name: string
  description: string
  state: string
}

interface LLMProvider {
  name: string
  display_name: string
  description: string
  default_model: string
  available?: boolean
}

interface DataSource {
  name: string
  connected: boolean
  message: string
  priority: number
}

export default function UnifiedBackendPage() {
  const [modules, setModules] = useState<Module[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [llmProviders, setLLMProviders] = useState<LLMProvider[]>([])
  const [dataSources, setDataSources] = useState<Record<string, DataSource>>({})
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const unifiedRes = await fetch('/api/unified?action=all')
        const unifiedData = await unifiedRes.json()
        
        if (unifiedData.success) {
          setModules(unifiedData.data.modules || [])
          setAgents(unifiedData.data.agents || [])
          setLLMProviders(unifiedData.data.llm_providers || [])
        }
        
        const configRes = await fetch('/api/config?type=data_sources')
        const configData = await configRes.json()
        if (configData.success) {
          setDataSources(configData.data || {})
        }
      } catch (error) {
        console.error('Failed to fetch data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchData()
  }, [])

  const handleRefresh = async () => {
    setLoading(true)
    try {
      const unifiedRes = await fetch('/api/unified?action=all')
      const unifiedData = await unifiedRes.json()
      if (unifiedData.success) {
        setModules(unifiedData.data.modules || [])
        setAgents(unifiedData.data.agents || [])
        setLLMProviders(unifiedData.data.llm_providers || [])
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCacheTTL = (seconds: number) => {
    if (seconds === 0) return '不缓存'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`
    return `${Math.floor(seconds / 86400)}天`
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight">统一后端服务</h1>
            <p className="text-muted-foreground">
              整合完整版后端架构与前端兼容API，支持Agent状态追踪、LLM配置和多数据源管理
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            刷新
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Bot className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{agents.length}</p>
                  <p className="text-sm text-muted-foreground">分析Agent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Layers className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{modules.length}</p>
                  <p className="text-sm text-muted-foreground">分析模块</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Cpu className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{llmProviders.length}</p>
                  <p className="text-sm text-muted-foreground">LLM提供商</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Database className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{Object.keys(dataSources).length}</p>
                  <p className="text-sm text-muted-foreground">数据源</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="agents">Agent列表</TabsTrigger>
            <TabsTrigger value="modules">分析模块</TabsTrigger>
            <TabsTrigger value="config">配置管理</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    功能特性
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-1" />
                      <div>
                        <p className="font-medium">完整版后端Agent状态追踪</p>
                        <p className="text-sm text-muted-foreground">实时追踪各Agent执行状态、LLM交互日志</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-1" />
                      <div>
                        <p className="font-medium">前端兼容分析API</p>
                        <p className="text-sm text-muted-foreground">支持模块化分析、异步任务管理</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-1" />
                      <div>
                        <p className="font-medium">动态LLM配置</p>
                        <p className="text-sm text-muted-foreground">支持多个LLM提供商动态切换</p>
                      </div>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-green-500 mt-1" />
                      <div>
                        <p className="font-medium">多数据源管理</p>
                        <p className="text-sm text-muted-foreground">AKShare、东方财富、新浪财经等</p>
                      </div>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    数据源状态
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(dataSources).map(([key, source]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-xs text-muted-foreground">优先级: {source.priority}</p>
                          </div>
                        </div>
                        <Badge variant={source.connected ? "default" : "destructive"}>
                          {source.message}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="agents">
            <Card>
              <CardHeader>
                <CardTitle>分析Agent列表</CardTitle>
                <CardDescription>完整版后端包含的所有分析Agent</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {agents.map((agent) => (
                    <div key={agent.name} className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{agent.name.replace(/_/g, ' ')}</p>
                          <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{agent.state}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="modules">
            <Card>
              <CardHeader>
                <CardTitle>分析模块列表</CardTitle>
                <CardDescription>前端兼容API支持的分析模块</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {modules.map((module) => (
                    <div key={module.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Layers className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="font-medium">{module.name}</p>
                          <p className="text-sm text-muted-foreground">{module.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">缓存: {formatCacheTTL(module.cache_ttl)}</Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="config">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    LLM提供商配置
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {llmProviders.map((provider) => (
                      <div key={provider.name} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div>
                          <p className="font-medium">{provider.display_name}</p>
                          <p className="text-xs text-muted-foreground">{provider.description}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{provider.default_model}</Badge>
                          <Check className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    数据源管理
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(dataSources).map(([key, source]) => (
                      <div key={key} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-3">
                          <Globe className="h-4 w-4" />
                          <div>
                            <p className="font-medium">{source.name}</p>
                            <p className="text-xs text-muted-foreground">优先级: {source.priority}</p>
                          </div>
                        </div>
                        <Badge variant={source.connected ? "default" : "destructive"}>{source.message}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Card>
          <CardHeader>
            <CardTitle>API文档</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded bg-muted/50">
                <p className="font-mono text-primary">GET /api/unified</p>
                <p className="text-muted-foreground mt-1">获取所有配置数据</p>
              </div>
              <div className="p-3 rounded bg-muted/50">
                <p className="font-mono text-primary">GET /api/modules</p>
                <p className="text-muted-foreground mt-1">获取分析模块列表</p>
              </div>
              <div className="p-3 rounded bg-muted/50">
                <p className="font-mono text-primary">GET /api/config</p>
                <p className="text-muted-foreground mt-1">获取LLM和数据源配置</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
