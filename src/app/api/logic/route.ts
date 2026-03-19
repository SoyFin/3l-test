import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// 搜索政策新闻
async function searchPolicyNews(keyword: string) {
  try {
    const zai = await ZAI.create()
    const results = await zai.functions.invoke('web_search', {
      query: `${keyword} 政策 利好 最新`,
      num: 5,
      recency_days: 30
    })
    return results
  } catch (error) {
    console.error('Search policy news error:', error)
    return []
  }
}

// AI分析政策影响
async function analyzePolicyImpact(title: string, snippet: string, industry: string) {
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一个专业的金融分析师。请分析政策新闻对指定行业的影响程度和情感倾向。
返回JSON格式：{
  "importance": 1-5的整数，表示重要程度,
  "sentiment": -1到1的浮点数，表示情感倾向（负面到正面）,
  "impact": "brief impact analysis in Chinese"
}`
        },
        {
          role: 'user',
          content: `行业：${industry}
新闻标题：${title}
摘要：${snippet}

请分析这条政策新闻对该行业的影响。`
        }
      ],
      thinking: { type: 'disabled' }
    })
    
    const content = completion.choices[0]?.message?.content
    if (content) {
      try {
        return JSON.parse(content)
      } catch {
        return { importance: 3, sentiment: 0, impact: '分析失败' }
      }
    }
    return { importance: 3, sentiment: 0, impact: '分析失败' }
  } catch (error) {
    console.error('Analyze policy error:', error)
    return { importance: 3, sentiment: 0, impact: '分析失败' }
  }
}

// 获取最强逻辑排行
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const industry = searchParams.get('industry')
    
    // 获取特定行业的详情
    if (industry) {
      const score = await (prisma as any).industryLogicScore?.findFirst({
        where: { industry },
        orderBy: { weekDate: 'desc' }
      })
      
      const policies = await (prisma as any).policyEvent?.findMany({
        where: { industry },
        orderBy: { publishDate: 'desc' },
        take: 10
      })
      
      return NextResponse.json({
        score,
        policies
      })
    }
    
    // 获取最新一周的排行
    const latestScores = await (prisma as any).industryLogicScore?.findMany({
      orderBy: [{ weekDate: 'desc' }, { totalScore: 'desc' }],
      take: 10
    })
    
    // 如果没有数据，返回空
    if (!latestScores || latestScores.length === 0) {
      return NextResponse.json({ 
        ranking: [],
        message: '暂无逻辑评分数据，请先更新'
      })
    }
    
    // 获取最新周的数据
    const latestWeekDate = latestScores[0]?.weekDate
    const ranking = await (prisma as any).industryLogicScore?.findMany({
      where: { weekDate: latestWeekDate },
      orderBy: { totalScore: 'desc' },
      take: 10
    })
    
    return NextResponse.json({ ranking })
  } catch (error) {
    console.error('Get logic error:', error)
    return NextResponse.json({ error: '获取逻辑数据失败' }, { status: 500 })
  }
}

// 更新最强逻辑数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, industries } = body
    
    if (action === 'fetch_policies') {
      // 抓取政策新闻
      const results = []
      const targetIndustries = industries || [
        '人工智能', '新能源汽车', '半导体', '医药生物', '光伏',
        '风电', '储能', '机器人', '数字经济', '央企改革'
      ]
      
      for (const industry of targetIndustries) {
        const newsResults = await searchPolicyNews(industry)
        
        for (const news of newsResults.slice(0, 3)) {
          const analysis = await analyzePolicyImpact(
            news.name || '',
            news.snippet || '',
            industry
          )
          
          const policy = await (prisma as any).policyEvent?.upsert({
            where: {
              id: `${industry}_${news.url?.split('/').pop() || Date.now()}`
            },
            create: {
              id: `${industry}_${news.url?.split('/').pop() || Date.now()}`,
              title: news.name || '',
              source: news.host_name || '',
              publishDate: new Date(news.date || Date.now()),
              industry,
              content: news.snippet,
              importance: analysis.importance,
              sentiment: analysis.sentiment
            },
            update: {
              importance: analysis.importance,
              sentiment: analysis.sentiment
            }
          })
          
          results.push(policy)
        }
        
        // 延迟避免请求过快
        await new Promise(r => setTimeout(r, 500))
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `已抓取 ${results.length} 条政策新闻`,
        count: results.length
      })
    }
    
    if (action === 'calculate_scores') {
      // 计算行业逻辑评分
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      // 获取所有行业
      const industries = await (prisma as any).policyEvent?.groupBy({
        by: ['industry'],
        _count: true
      })
      
      const results = []
      
      for (const { industry } of industries || []) {
        // 获取该行业近30天的政策
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const policies = await (prisma as any).policyEvent?.findMany({
          where: {
            industry,
            publishDate: { gte: thirtyDaysAgo }
          }
        })
        
        // 计算政策催化分（35%）
        let policyScore = 0
        if (policies && policies.length > 0) {
          const avgImportance = policies.reduce((sum: number, p: any) => sum + (p.importance || 3), 0) / policies.length
          const avgSentiment = policies.reduce((sum: number, p: any) => sum + (p.sentiment || 0), 0) / policies.length
          const countScore = Math.min(policies.length / 5, 1) * 10
          policyScore = (avgImportance / 5 * 5 + avgSentiment * 2.5 + countScore * 2.5)
        }
        
        // 业绩预期分（30%）
        const momentum = await prisma.momentumHistory.findFirst({
          where: { industry },
          orderBy: { weekDate: 'desc' }
        })
        const earningsScore = momentum ? Math.min(momentum.score / 7 * 10, 10) : 0
        
        // 资金流向分（20%）
        const capitalScore = momentum ? Math.min(momentum.count / 10 * 10, 10) : 0
        
        // 机构关注分（15%）
        const institutionScore = momentum && momentum.total > 0 
          ? Math.min(momentum.count / momentum.total * 10, 10) 
          : 0
        
        // 计算综合得分
        const totalScore = 
          policyScore * 0.35 + 
          earningsScore * 0.30 + 
          capitalScore * 0.20 + 
          institutionScore * 0.15
        
        // 保存评分
        const score = await (prisma as any).industryLogicScore?.upsert({
          where: {
            industry_weekDate: {
              industry,
              weekDate: today
            }
          },
          create: {
            industry,
            weekDate: today,
            policyScore,
            earningsScore,
            capitalScore,
            institutionScore,
            totalScore,
            policyEvents: policies?.map((p: any) => ({
              title: p.title,
              date: p.publishDate,
              importance: p.importance
            }))
          },
          update: {
            policyScore,
            earningsScore,
            capitalScore,
            institutionScore,
            totalScore,
            policyEvents: policies?.map((p: any) => ({
              title: p.title,
              date: p.publishDate,
              importance: p.importance
            }))
          }
        })
        
        results.push(score)
      }
      
      // 按总分排序
      results.sort((a: any, b: any) => b.totalScore - a.totalScore)
      
      return NextResponse.json({ 
        success: true, 
        message: `已计算 ${results.length} 个行业评分`,
        ranking: results.slice(0, 10)
      })
    }
    
    return NextResponse.json({ error: '未知操作' }, { status: 400 })
  } catch (error) {
    console.error('Update logic error:', error)
    return NextResponse.json({ error: '更新逻辑数据失败' }, { status: 500 })
  }
}
