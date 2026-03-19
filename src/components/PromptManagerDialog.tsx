'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileText, Save, RotateCcw, Sparkles, Building2, Newspaper } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// 默认提示词模板
const DEFAULT_PROMPTS = {
  industry: `你是一位资深的A股投研分析师，精通3L投研体系（动量主线、最强逻辑、量价择时）。请对【{行业}】行业进行深度分析。

## 一、行业基础数据
| 指标 | 数值 | 说明 |
|------|------|------|
| 动量分值 | {动量分值} | 分值0-10，越高表示近期表现越强 |
| 上榜股票数 | {上榜数量}只 | 进入动量排行榜的成分股数量 |
| 成分总数 | {成分总数}只 | 行业全部成分股数量 |
| 上榜比例 | {上榜比例}% | 上榜股票占比 |
| 连续上榜 | {连续周数}周 | 连续出现在排行榜的周数 |

---

## 分析要求

请按照以下结构输出专业分析报告：

### 1. 行业定位（约100字）
- 该行业属于什么赛道？
- 当前市场关注度如何？

### 2. 动量解读（约150字）
- 动量分值意味着什么？
- 连续上榜说明了什么？
- 上榜比例反映什么？

### 3. 驱动因素分析（约200字）
请从以下角度推测上涨逻辑：
- **政策催化**：近期是否有相关利好政策？
- **业绩驱动**：行业景气度如何？
- **事件驱动**：是否有重大事件？
- **资金流向**：是否有主力资金持续流入？

### 4. 领涨股分析（约150字）
重点分析领涨股的表现和代表性

### 5. 风险提示（约100字）
- 动量是否过高需要警惕？
- 存在哪些潜在风险？

### 6. 投资建议（约100字）
- 当前是否适合参与？
- 建议的操作策略是什么？

---
请用专业、客观、简洁的语言输出，直接给出分析结论。`,

  stock: `你是一位资深的A股投研分析师，精通3L投研体系（动量主线、最强逻辑、量价择时）。请对【{股票名称}】进行深度诊断。

## 一、个股基础信息
| 项目 | 数据 |
|------|------|
| 股票名称 | {股票名称} |
| 股票代码 | {股票代码} |
| 所属行业 | {行业} |
| 近20日涨幅 | {20日涨幅}% |

## 二、基本面数据
| 指标 | 数值 | 评价标准 |
|------|------|----------|
| ROE | {ROE}% | >15%优秀，>20%卓越 |
| 负债率 | {负债率}% | <50%安全，>70%风险 |
| 毛利率 | {毛利率}% | >30%较好，>50%优秀 |
| 营收增长 | {营收增长}% | >20%良好，>50%高增 |
| 净利增长 | {净利增长}% | >20%良好，>50%高增 |

---

## 分析要求

请按照3L体系进行深度诊断：

### 一、动量维度（约150字）
- 走势分析：涨幅水平、趋势方向、涨速变化
- 相对强度：与大盘和行业对比

### 二、逻辑维度（约200字）
- 基本面质量评估
- 核心逻辑判断（是否符合高景气+高增长）
- 催化剂分析

### 三、量价维度（约150字）
- 阶段判断（底部/上涨初期/中期/后期/顶部）
- 买卖点分析

### 四、综合诊断（约100字）
- 3L体系评分（动量/逻辑/时机各10分）
- 投资建议（强烈推荐/值得关注/继续观察/谨慎回避）

---
请用专业、客观、简洁的语言输出，直接给出分析结论。`,

  news: `你是一位资深的A股投研分析师。请分析以下与【{名称}】相关的最新新闻，提炼投资要点。

## 相关新闻

{新闻列表}

---

## 分析要求

### 1. 新闻摘要（约100字）
用一句话概括最重要的新闻信息。

### 2. 利好/利空判断（约150字）
- 哪些新闻是利好？影响程度如何？
- 哪些新闻是利空？风险程度如何？

### 3. 投资启示（约100字）
- 这些新闻对投资决策有什么启示？
- 需要重点关注什么？

---
请用简洁专业的语言输出，直接给出结论。`
}

const STORAGE_KEY = 'ai_prompts_custom'

interface PromptManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function PromptManagerDialog({
  open,
  onOpenChange
}: PromptManagerDialogProps) {
  const { toast } = useToast()
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS)
  const [activeTab, setActiveTab] = useState('industry')
  const [hasChanges, setHasChanges] = useState(false)

  // 加载自定义提示词
  useEffect(() => {
    if (open) {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const customPrompts = JSON.parse(saved)
          setPrompts({
            industry: customPrompts.industry || DEFAULT_PROMPTS.industry,
            stock: customPrompts.stock || DEFAULT_PROMPTS.stock,
            news: customPrompts.news || DEFAULT_PROMPTS.news
          })
        } catch {
          setPrompts(DEFAULT_PROMPTS)
        }
      } else {
        setPrompts(DEFAULT_PROMPTS)
      }
      setHasChanges(false)
    }
  }, [open])

  // 保存提示词
  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts))
    setHasChanges(false)
    toast({
      title: '保存成功',
      description: '提示词已保存，将在下次分析时生效'
    })
  }

  // 重置为默认
  const handleReset = () => {
    setPrompts(DEFAULT_PROMPTS)
    setHasChanges(true)
    toast({
      title: '已重置',
      description: '提示词已恢复为默认模板'
    })
  }

  // 更新提示词
  const updatePrompt = (type: string, value: string) => {
    setPrompts(prev => ({ ...prev, [type]: value }))
    setHasChanges(true)
  }

  // 获取当前Tab信息
  const getTabInfo = (type: string) => {
    switch (type) {
      case 'industry':
        return { icon: Sparkles, label: '行业分析', desc: '分析行业动量、逻辑和投资机会' }
      case 'stock':
        return { icon: Building2, label: '个股诊断', desc: '诊断个股基本面、技术面和投资价值' }
      case 'news':
        return { icon: Newspaper, label: '新闻解读', desc: '解读相关新闻的投资意义' }
      default:
        return { icon: FileText, label: type, desc: '' }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            提示词管理
          </DialogTitle>
          <DialogDescription>
            自定义AI分析使用的提示词，支持变量替换：{`{行业}、{股票名称}、{股票代码}等`}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="industry" className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              行业分析
            </TabsTrigger>
            <TabsTrigger value="stock" className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              个股诊断
            </TabsTrigger>
            <TabsTrigger value="news" className="flex items-center gap-1.5">
              <Newspaper className="h-3.5 w-3.5" />
              新闻解读
            </TabsTrigger>
          </TabsList>

          {['industry', 'stock', 'news'].map(type => {
            const info = getTabInfo(type)
            const Icon = info.icon
            return (
              <TabsContent key={type} value={type} className="mt-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-4 w-4" />
                    <span>{info.desc}</span>
                  </div>
                  
                  <ScrollArea className="h-[400px] rounded-lg border">
                    <Textarea
                      value={prompts[type as keyof typeof prompts]}
                      onChange={(e) => updatePrompt(type, e.target.value)}
                      className="min-h-[400px] border-0 focus-visible:ring-0 resize-none font-mono text-sm p-4"
                      placeholder="输入自定义提示词..."
                    />
                  </ScrollArea>
                </div>
              </TabsContent>
            )
          })}
        </Tabs>

        {/* 操作按钮 */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              恢复默认
            </Button>
            {hasChanges && (
              <span className="text-xs text-amber-600">有未保存的更改</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges}>
              <Save className="h-3.5 w-3.5 mr-1.5" />
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// 获取自定义提示词
export function getCustomPrompt(type: 'industry' | 'stock' | 'news'): string {
  if (typeof window === 'undefined') return DEFAULT_PROMPTS[type]
  
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) {
    try {
      const customPrompts = JSON.parse(saved)
      return customPrompts[type] || DEFAULT_PROMPTS[type]
    } catch {
      return DEFAULT_PROMPTS[type]
    }
  }
  return DEFAULT_PROMPTS[type]
}
