import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// ==================== 缓存相关 ====================
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7天

// 从数据库获取缓存的AI分析结果
async function getCachedAnalysis(type: string, name: string): Promise<string | null> {
  try {
    const cache = await (prisma as any).aiCache?.findFirst({
      where: {
        type,
        name,
        createdAt: { gte: new Date(Date.now() - CACHE_DURATION) }
      },
      orderBy: { createdAt: 'desc' }
    })
    return cache?.result || null
  } catch (e) {
    console.error('获取缓存失败:', e)
    return null
  }
}

// 保存AI分析结果到数据库
async function saveCachedAnalysis(type: string, name: string, result: string) {
  try {
    // 尝试创建或更新缓存
    await (prisma as any).aiCache?.create({
      data: {
        type,
        name,
        result,
        createdAt: new Date()
      }
    })
  } catch (e) {
    console.error('保存缓存失败:', e)
  }
}

// ==================== AI平台调用函数 ====================

// 智谱AI调用
async function callZhipu(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'glm-4-flash',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || '智谱AI调用失败')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || '分析结果为空'
}

// 阿里云通义千问调用
async function callAliyun(apiKey: string, prompt: string): Promise<string> {
  const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'qwen-turbo',
      input: { messages: [{ role: 'user', content: prompt }] },
      parameters: { temperature: 0.7, max_tokens: 3000 }
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message || error.code || '阿里云AI调用失败')
  }

  const data = await response.json()
  return data.output?.text || data.output?.choices?.[0]?.message?.content || '分析结果为空'
}

// 字节跳动豆包调用
async function callByteDance(apiKey: string, prompt: string): Promise<string> {
  // 字节跳动需要endpoint_id，这里使用通用格式
  const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'doubao-pro-32k',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || '字节跳动AI调用失败')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || '分析结果为空'
}

// 腾讯混元调用
async function callTencent(apiKey: string, prompt: string): Promise<string> {
  // 腾讯混元API格式
  const response = await fetch('https://hunyuan.tencentcloudapi.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'hunyuan-lite',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || '腾讯混元调用失败')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || '分析结果为空'
}

// 统一调用入口
async function callAI(provider: string, apiKey: string, prompt: string): Promise<string> {
  switch (provider) {
    case 'zhipu':
      return callZhipu(apiKey, prompt)
    case 'aliyun':
      return callAliyun(apiKey, prompt)
    case 'byteDance':
      return callByteDance(apiKey, prompt)
    case 'tencent':
      return callTencent(apiKey, prompt)
    default:
      throw new Error(`不支持的AI平台: ${provider}`)
  }
}

// ==================== 提示词生成函数 ====================

// 生成行业分析提示词
function generateIndustryPrompt(name: string, data: any): string {
  return `你是一位资深的A股投研分析师，精通3L投研体系（动量主线、最强逻辑、量价择时）。请对【${name}】行业进行深度分析。

## 一、行业基础数据
| 指标 | 数值 | 说明 |
|------|------|------|
| 动量分值 | ${data?.score || '未知'} | 分值0-10，越高表示近期表现越强 |
| 上榜股票数 | ${data?.count || 0}只 | 进入动量排行榜的成分股数量 |
| 成分总数 | ${data?.total || 0}只 | 行业全部成分股数量 |
| 上榜比例 | ${data?.total ? ((data?.count || 0) / data?.total * 100).toFixed(1) : 0}% | 上榜股票占比 |
| 连续上榜 | ${data?.continuousWeeks || 0}周 | 连续出现在排行榜的周数 |

## 二、上榜股票明细
${data?.stocks && data.stocks.length > 0 ? 
  data.stocks.slice(0, 10).map((s: any, i: number) => 
    `${i + 1}. ${s.name}(${s.code}) - 20日涨幅:${s.change?.toFixed(1) || 0}%`
  ).join('\n') : '暂无上榜股票'}

---

## 分析要求

请按照以下结构输出专业分析报告：

### 1. 行业定位（约100字）
- 该行业属于什么赛道？（如：新能源、半导体、消费等细分领域）
- 当前市场关注度如何？（高/中/低，结合动量分值判断）

### 2. 动量解读（约150字）
- 动量分值${data?.score || 0}意味着什么？（低<3/中3-6/高6-8/极高>8）
- 连续${data?.continuousWeeks || 0}周上榜说明了什么？
- 上榜比例${data?.total ? ((data?.count || 0) / data?.total * 100).toFixed(1) : 0}%反映什么？

### 3. 驱动因素分析（约200字）
请从以下角度推测上涨逻辑：
- **政策催化**：近期是否有相关利好政策？
- **业绩驱动**：行业景气度如何？是否有业绩改善预期？
- **事件驱动**：是否有重大事件（技术突破、订单落地等）？
- **资金流向**：是否有主力资金持续流入迹象？

### 4. 领涨股分析（约150字）
${data?.stocks && data.stocks.length > 0 ? 
  `重点分析领涨股【${data.stocks[0]?.name}】的表现：
- 涨幅是否合理？是否有持续动能？
- 是否具有板块代表性？` : 
  '暂无领涨股数据，跳过此部分'}

### 5. 风险提示（约100字）
- 动量分值是否过高需要警惕？（>7可能接近高潮）
- 存在哪些潜在风险？（政策变化、业绩不及预期、技术回调等）
- 是否处于过热状态？

### 6. 投资建议（约100字）
- 当前是否适合参与？适合什么类型的投资者？
- 建议的操作策略是什么？（追涨/观望/等待回调）
- 重点关注的个股方向？

---
请用专业、客观、简洁的语言输出，避免空洞表述。直接给出分析结论，不需要"根据数据分析"等套话。`
}

// 生成个股分析提示词
function generateStockPrompt(name: string, data: any): string {
  const tags = data?.fundamentals?.tags || []
  const positiveTags = tags.filter((t: string) => 
    ['营收高增', '净利高增', '高ROE', '超高ROE', '高毛利'].includes(t)
  )
  const riskTags = tags.filter((t: string) => 
    ['高负债', '极高负债', '高商誉', '高质押'].includes(t)
  )

  return `你是一位资深的A股投研分析师，精通3L投研体系（动量主线、最强逻辑、量价择时）。请对【${name}】进行深度诊断。

## 一、个股基础信息
| 项目 | 数据 |
|------|------|
| 股票名称 | ${name} |
| 股票代码 | ${data?.code || '未知'} |
| 所属行业 | ${data?.industry || '未知'} |
| 近20日涨幅 | ${data?.change?.toFixed(2) || 0}% |

## 二、基本面数据
| 指标 | 数值 | 评价标准 |
|------|------|----------|
| ROE | ${data?.fundamentals?.roe || '未知'}% | >15%优秀，>20%卓越 |
| 负债率 | ${data?.fundamentals?.debtRatio || '未知'}% | <50%安全，>70%风险 |
| 毛利率 | ${data?.fundamentals?.grossMargin || '未知'}% | >30%较好，>50%优秀 |
| 营收增长 | ${data?.fundamentals?.revenueGrowth || '未知'}% | >20%良好，>50%高增 |
| 净利增长 | ${data?.fundamentals?.profitGrowth || '未知'}% | >20%良好，>50%高增 |

## 三、智能标签
**正面标签**：${positiveTags.length > 0 ? positiveTags.join('、') : '暂无'}
**风险标签**：${riskTags.length > 0 ? riskTags.join('、') : '暂无'}

---

## 分析要求

请按照3L体系进行深度诊断：

### 一、动量维度（L1：动量主线）- 约150字

**1. 走势分析**
- 近20日涨幅${data?.change?.toFixed(1) || 0}%处于什么水平？（弱<5%/中5-15%/强15-30%/极强>30%）
- 是否处于明确的上升趋势？
- 涨速是否有加速或减速迹象？

**2. 相对强度**
- 与大盘相比表现如何？
- 与同行业个股相比是否领先？

### 二、逻辑维度（L2：最强逻辑）- 约200字

**1. 基本面质量**
${data?.fundamentals ? `
- ROE ${data.fundamentals.roe || '未知'}%：${(data.fundamentals.roe || 0) > 15 ? '优秀' : (data.fundamentals.roe || 0) > 10 ? '中等' : '偏弱'}
- 负债率 ${data.fundamentals.debtRatio || '未知'}%：${(data.fundamentals.debtRatio || 0) < 50 ? '安全' : (data.fundamentals.debtRatio || 0) < 70 ? '中等' : '风险较高'}
- 增长性：营收${data.fundamentals.revenueGrowth || 0}%、净利${data.fundamentals.profitGrowth || 0}%
` : '暂无基本面数据，跳过此部分'}

**2. 核心逻辑判断**
- 是否符合"高景气+高增长"的逻辑？
- 是否有明确的催化剂？（业绩预期/政策利好/事件驱动）
- 机构关注度如何？（是否有研报覆盖、机构持仓）

**3. 标签解读**
${positiveTags.length > 0 ? `- 正面标签解读：${positiveTags.join('、')}意味着什么？` : ''}
${riskTags.length > 0 ? `- 风险标签警示：${riskTags.join('、')}需要注意什么？` : ''}

### 三、量价维度（L3：量价择时）- 约150字

**1. 阶段判断**
- 当前处于什么阶段？（底部筑底/上涨初期/上涨中期/加速赶顶/顶部回落）
- 结合20日涨幅${data?.change?.toFixed(1) || 0}%判断

**2. 买卖点分析**
- 当前是否有明确的买点信号？
- 如果已持仓，是否需要止盈/加仓？

### 四、综合诊断 - 约100字

**1. 3L体系评分**
- 动量得分：_/10
- 逻辑得分：_/10
- 时机得分：_/10
- 综合评分：_/10

**2. 最终结论**
- 是否符合3L体系选股标准？
- 投资建议：（强烈推荐/值得关注/继续观察/谨慎回避）
- 风险提示

---
请用专业、客观、简洁的语言输出，直接给出分析结论和投资建议。`
}

// 生成新闻分析提示词
function generateNewsPrompt(name: string, news: any[], type: 'industry' | 'stock'): string {
  const newsContent = news.slice(0, 5).map((n, i) => 
    `${i + 1}. 【${n.title}】\n   来源：${n.source || '未知'} | 时间：${n.date || '未知'}\n   摘要：${n.snippet || n.summary || '无'}`
  ).join('\n\n')

  return `你是一位资深的A股投研分析师。请分析以下与【${name}】相关的最新新闻，提炼投资要点。

## 相关新闻（最近5条）

${newsContent}

---

## 分析要求

### 1. 新闻摘要（约100字）
用一句话概括最重要的新闻信息。

### 2. 利好/利空判断（约150字）
- 哪些新闻是利好？对股价可能有什么影响？
- 哪些新闻是利空？风险程度如何？
- 有哪些中性新闻可以忽略？

### 3. 投资启示（约100字）
- 这些新闻对投资决策有什么启示？
- 需要重点关注什么？

---
请用简洁专业的语言输出，直接给出结论。`
}

// ==================== 主处理函数 ====================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, data, news, provider: requestedProvider, forceRefresh } = body

    if (!type || !name) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    // 尝试从缓存获取（非强制刷新时）
    if (!forceRefresh) {
      const cached = await getCachedAnalysis(type, name)
      if (cached) {
        console.log(`返回缓存结果: ${type} - ${name}`)
        return NextResponse.json({
          success: true,
          analysis: cached,
          fromCache: true
        })
      }
    }

    // 从客户端配置获取API Key
    let clientConfig = body.config || {}
    if (typeof clientConfig === 'string') {
      try {
        clientConfig = JSON.parse(clientConfig)
      } catch {
        clientConfig = {}
      }
    }

    // 确定使用的AI平台
    const provider = requestedProvider || clientConfig?.defaultProvider || 'zhipu'
    
    // 获取对应平台的API Key
    let apiKey: string | undefined
    switch (provider) {
      case 'zhipu':
        apiKey = clientConfig?.zhipu?.apiKey || process.env.ZHIPU_API_KEY
        break
      case 'aliyun':
        apiKey = clientConfig?.aliyun?.apiKey || process.env.ALIYUN_API_KEY
        break
      case 'byteDance':
        apiKey = clientConfig?.byteDance?.apiKey || process.env.BYTEDANCE_API_KEY
        break
      case 'tencent':
        apiKey = clientConfig?.tencent?.apiKey || process.env.TENCENT_API_KEY
        break
    }

    if (!apiKey) {
      const providerNames: Record<string, string> = {
        zhipu: '智谱AI',
        aliyun: '阿里云',
        byteDance: '字节跳动',
        tencent: '腾讯混元'
      }
      return NextResponse.json({
        success: false,
        error: `请先配置${providerNames[provider] || provider}的API Key`
      }, { status: 400 })
    }

    // 生成提示词
    let prompt: string
    if (type === 'news') {
      prompt = generateNewsPrompt(name, news || [], body.newsType || 'stock')
    } else if (type === 'industry') {
      prompt = generateIndustryPrompt(name, data)
    } else {
      prompt = generateStockPrompt(name, data)
    }

    console.log(`使用 ${provider} AI分析${type === 'industry' ? '行业' : type === 'news' ? '新闻' : '个股'}: ${name}`)

    // 调用AI
    const result = await callAI(provider, apiKey, prompt)
    
    // 保存到缓存
    await saveCachedAnalysis(type, name, result)

    const providerNames: Record<string, string> = {
      zhipu: '智谱AI',
      aliyun: '阿里云',
      byteDance: '字节跳动',
      tencent: '腾讯混元'
    }

    return NextResponse.json({
      success: true,
      analysis: result,
      provider,
      providerName: providerNames[provider] || provider,
      fromCache: false
    })

  } catch (error: any) {
    console.error('AI分析错误:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}
