import { NextRequest, NextResponse } from 'next/server'
import ZAI from 'z-ai-web-dev-sdk'

// 情感分析接口
interface SentimentResult {
  overall: number  // -1 到 1 的整体情感分数
  aspects: {
    policy: { score: number; label: string; reason: string }
    earnings: { score: number; label: string; reason: string }
    market: { score: number; label: string; reason: string }
    risk: { score: number; label: string; reason: string }
  }
  summary: string
  recommendation: string
}

// 使用智谱AI进行情感分析
async function analyzeSentiment(
  type: 'industry' | 'stock',
  name: string,
  context?: {
    score?: number
    count?: number
    total?: number
    policies?: Array<{ title: string; importance: number }>
    news?: Array<{ title: string; snippet: string }>
  }
): Promise<SentimentResult> {
  try {
    const zai = await ZAI.create()
    
    // 构建分析上下文
    const contextInfo = []
    if (context?.score !== undefined) {
      contextInfo.push(`动量分值: ${context.score.toFixed(2)}`)
    }
    if (context?.count && context?.total) {
      contextInfo.push(`上榜股票: ${context.count}/${context.total}`)
    }
    if (context?.policies && context.policies.length > 0) {
      contextInfo.push(`近期政策:\n${context.policies.map(p => `- ${p.title}`).join('\n')}`)
    }
    if (context?.news && context.news.length > 0) {
      contextInfo.push(`相关新闻:\n${context.news.map(n => `- ${n.title}: ${n.snippet || ''}`).join('\n')}`)
    }
    
    const systemPrompt = `你是一个专业的金融分析师，擅长分析市场情绪和投资逻辑。请对给定的${type === 'industry' ? '行业' : '股票'}进行多维度的情感分析。

返回严格的JSON格式，包含以下字段：
{
  "overall": 整体情感分数（-1到1的浮点数，-1为极度悲观，1为极度乐观）,
  "aspects": {
    "policy": {
      "score": 政策催化情感分数（-1到1）,
      "label": "正向/中性/负向",
      "reason": "简短的原因说明（20字以内）"
    },
    "earnings": {
      "score": 业绩预期情感分数（-1到1）,
      "label": "正向/中性/负向", 
      "reason": "简短的原因说明（20字以内）"
    },
    "market": {
      "score": 市场情绪情感分数（-1到1）,
      "label": "正向/中性/负向",
      "reason": "简短的原因说明（20字以内）"
    },
    "risk": {
      "score": 风险评估情感分数（-1到1，负分表示风险高）,
      "label": "低风险/中等风险/高风险",
      "reason": "简短的原因说明（20字以内）"
    }
  },
  "summary": "整体分析摘要（50字以内）",
  "recommendation": "投资建议（买入/持有/观望/卖出）"
}`

    const userPrompt = `请分析以下${type === 'industry' ? '行业' : '股票'}的投资情感：

名称：${name}
类型：${type === 'industry' ? '行业板块' : '个股'}

${contextInfo.length > 0 ? `相关数据：\n${contextInfo.join('\n')}` : '暂无具体数据，请基于市场认知进行分析'}

请给出专业的情感分析结果。`

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      thinking: { type: 'disabled' }
    })
    
    const content = completion.choices[0]?.message?.content
    
    if (content) {
      // 尝试解析JSON
      try {
        // 提取JSON部分
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (e) {
        console.error('Parse sentiment JSON error:', e)
      }
    }
    
    // 返回默认值
    return getDefaultSentiment()
  } catch (error) {
    console.error('Analyze sentiment error:', error)
    return getDefaultSentiment()
  }
}

function getDefaultSentiment(): SentimentResult {
  return {
    overall: 0,
    aspects: {
      policy: { score: 0, label: '中性', reason: '暂无明确政策催化' },
      earnings: { score: 0, label: '中性', reason: '业绩预期不明确' },
      market: { score: 0, label: '中性', reason: '市场情绪平稳' },
      risk: { score: 0, label: '中等风险', reason: '风险适中' }
    },
    summary: '暂无足够数据进行深度分析',
    recommendation: '观望'
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as 'industry' | 'stock' || 'industry'
    const name = searchParams.get('name')
    
    if (!name) {
      return NextResponse.json({ error: '缺少名称参数' }, { status: 400 })
    }
    
    // 获取上下文数据
    let context: any = {}
    
    if (type === 'industry') {
      // 获取行业动量数据
      const host = request.headers.get('host') || 'localhost:3000'
      const protocol = request.headers.get('x-forwarded-proto') || 'http'
      const baseUrl = `${protocol}://${host}`
      
      try {
        const momentumResponse = await fetch(`${baseUrl}/api/momentum?industry=${encodeURIComponent(name)}`)
        if (momentumResponse.ok) {
          const momentumData = await momentumResponse.json()
          context.score = momentumData.score
          context.count = momentumData.count
          context.total = momentumData.total
        }
      } catch (e) {
        console.error('Fetch momentum error:', e)
      }
      
      // 获取政策事件
      try {
        const logicResponse = await fetch(`${baseUrl}/api/logic?industry=${encodeURIComponent(name)}`)
        if (logicResponse.ok) {
          const logicData = await logicResponse.json()
          if (logicData.policies) {
            context.policies = logicData.policies.slice(0, 5).map((p: any) => ({
              title: p.title,
              importance: p.importance
            }))
          }
        }
      } catch (e) {
        console.error('Fetch logic error:', e)
      }
    }
    
    const result = await analyzeSentiment(type, name, context)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Sentiment API error:', error)
    return NextResponse.json({ error: '情感分析失败' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, name, context } = body
    
    if (!name) {
      return NextResponse.json({ error: '缺少名称参数' }, { status: 400 })
    }
    
    const result = await analyzeSentiment(type || 'industry', name, context)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('Sentiment API error:', error)
    return NextResponse.json({ error: '情感分析失败' }, { status: 500 })
  }
}
