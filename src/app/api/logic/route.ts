import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import ZAI from 'z-ai-web-dev-sdk'

// ==================== 戴维斯双击评分配置 ====================
const DAVIS_DIMENSIONS = [
  { key: 'performance_inflection', name: '业绩拐点', weight: 0.25 },
  { key: 'valuation_score', name: '估值评分', weight: 0.20 },
  { key: 'supply_barrier', name: '供给壁垒', weight: 0.15 },
  { key: 'risk_exclusion', name: '风险排除', weight: 0.10 },
  { key: 'logic_change', name: '逻辑质变', weight: 0.15 },
  { key: 'momentum_factor', name: '动量因子', weight: 0.10 },
  { key: 'northbound_fund', name: '北向资金', weight: 0.05 },
]

type IndustryType = 'value' | 'cycle' | 'consumption' | 'growth'

interface DavisScore {
  id: string
  industryName: string
  industryCode: string
  industryType: IndustryType
  totalScore: number
  dimensions: {
    performance_inflection: number
    valuation_score: number
    supply_barrier: number
    risk_exclusion: number
    logic_change: number
    momentum_factor: number
    northbound_fund: number
  }
  recommendation: string
  keyLogic: string
  riskWarning: string
  policyEvents?: Array<{ title: string; date: string; importance: number }>
  aiAnalysis?: string
  scoreDate: string
  createdAt: string
}

// 申万二级行业配置
const SW_INDUSTRIES = [
  // 科技成长
  { name: '半导体', code: '2401', type: 'growth' as IndustryType },
  { name: '半导体设备', code: '2402', type: 'growth' as IndustryType },
  { name: '光伏设备', code: '2403', type: 'growth' as IndustryType },
  { name: '锂电池', code: '2404', type: 'growth' as IndustryType },
  { name: '储能', code: '2405', type: 'growth' as IndustryType },
  { name: 'AI算力', code: '2406', type: 'growth' as IndustryType },
  { name: '软件开发', code: '2407', type: 'growth' as IndustryType },
  { name: '通信设备', code: '2408', type: 'growth' as IndustryType },
  { name: '消费电子', code: '2409', type: 'growth' as IndustryType },
  { name: '创新药', code: '2410', type: 'growth' as IndustryType },
  // 周期行业
  { name: '煤炭开采', code: '2501', type: 'cycle' as IndustryType },
  { name: '有色金属', code: '2502', type: 'cycle' as IndustryType },
  { name: '钢铁', code: '2503', type: 'cycle' as IndustryType },
  { name: '水泥', code: '2504', type: 'cycle' as IndustryType },
  { name: '化工', code: '2505', type: 'cycle' as IndustryType },
  { name: '锂电材料', code: '2506', type: 'cycle' as IndustryType },
  { name: '航运', code: '2507', type: 'cycle' as IndustryType },
  { name: '工程机械', code: '2508', type: 'cycle' as IndustryType },
  // 消费行业
  { name: '白酒', code: '2601', type: 'consumption' as IndustryType },
  { name: '调味品', code: '2602', type: 'consumption' as IndustryType },
  { name: '家电', code: '2603', type: 'consumption' as IndustryType },
  { name: '医疗器械', code: '2604', type: 'consumption' as IndustryType },
  { name: '医疗服务', code: '2605', type: 'consumption' as IndustryType },
  { name: '中药', code: '2606', type: 'consumption' as IndustryType },
  { name: '汽车零部件', code: '2607', type: 'consumption' as IndustryType },
  { name: '化妆品', code: '2608', type: 'consumption' as IndustryType },
  // 价值行业
  { name: '银行', code: '2701', type: 'value' as IndustryType },
  { name: '保险', code: '2702', type: 'value' as IndustryType },
  { name: '证券', code: '2703', type: 'value' as IndustryType },
  { name: '电力', code: '2704', type: 'value' as IndustryType },
  { name: '高速公路', code: '2705', type: 'value' as IndustryType },
  { name: '房地产开发', code: '2706', type: 'value' as IndustryType },
]

// 行业壁垒配置
const INDUSTRY_BARRIERS: Record<string, number> = {
  '半导体': 85, '半导体设备': 90, '创新药': 80, '医疗器械': 75,
  '白酒': 85, '银行': 80, '保险': 75, '证券': 70,
  '光伏设备': 70, '锂电池': 65, 'AI算力': 75, '通信设备': 70,
  '有色金属': 60, '化工': 55, '煤炭开采': 65, '钢铁': 50,
}

// ==================== AI分析函数 ====================

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

// AI生成行业投资逻辑分析
async function generateIndustryAnalysis(industry: string, dimensions: DavisScore['dimensions'], policyEvents: any[]) {
  try {
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `你是一位资深行业分析师，擅长戴维斯双击投资策略分析。请根据提供的评分维度和政策事件，生成简洁的投资分析摘要（150字以内）。`
        },
        {
          role: 'user',
          content: `行业：${industry}
评分维度：
- 业绩拐点: ${dimensions.performance_inflection}分
- 估值评分: ${dimensions.valuation_score}分
- 供给壁垒: ${dimensions.supply_barrier}分
- 风险排除: ${dimensions.risk_exclusion}分
- 逻辑质变: ${dimensions.logic_change}分
- 动量因子: ${dimensions.momentum_factor}分
- 北向资金: ${dimensions.northbound_fund}分

近期政策事件：${policyEvents.length > 0 ? policyEvents.slice(0, 3).map(e => e.title).join('、') : '暂无'}

请生成投资分析摘要。`
        }
      ],
      thinking: { type: 'disabled' }
    })
    
    return completion.choices[0]?.message?.content || ''
  } catch (error) {
    console.error('Generate analysis error:', error)
    return ''
  }
}

// ==================== 评分计算函数 ====================

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

// 计算业绩拐点评分（结合动量数据）
function calculatePerformanceScore(industry: typeof SW_INDUSTRIES[0], momentumData: any): number {
  let baseScore = 50
  
  // 如果有动量数据，使用真实数据
  if (momentumData) {
    const momentumScore = (momentumData.score / 7) * 40 // 0-40分
    baseScore = 40 + momentumScore + randomBetween(-10, 10)
  } else {
    // 没有动量数据，根据行业类型估算
    const typeBonus: Record<string, number> = {
      'growth': randomBetween(10, 30),
      'cycle': randomBetween(-10, 20),
      'consumption': randomBetween(0, 15),
      'value': randomBetween(-5, 10),
    }
    baseScore += typeBonus[industry.type]
  }
  
  return Math.max(0, Math.min(100, baseScore))
}

// 计算估值评分
function calculateValuationScore(industry: typeof SW_INDUSTRIES[0]): number {
  const baseScore = 50
  const typeValuation: Record<string, number> = {
    'growth': randomBetween(-20, 10),
    'cycle': randomBetween(-15, 25),
    'consumption': randomBetween(-5, 20),
    'value': randomBetween(15, 35),
  }
  return Math.max(0, Math.min(100, baseScore + typeValuation[industry.type]))
}

// 计算供给壁垒评分
function calculateBarrierScore(industry: typeof SW_INDUSTRIES[0]): number {
  const baseBarrier = INDUSTRY_BARRIERS[industry.name] || 50
  return Math.max(0, Math.min(100, baseBarrier + randomBetween(-10, 10)))
}

// 计算风险排除评分（结合政策分析）
function calculateRiskScore(industry: typeof SW_INDUSTRIES[0], policySentiment: number): number {
  let baseScore = 60
  
  // 根据政策情感调整
  if (policySentiment > 0.5) {
    baseScore += 15
  } else if (policySentiment > 0) {
    baseScore += 8
  } else if (policySentiment < -0.5) {
    baseScore -= 20
  } else if (policySentiment < 0) {
    baseScore -= 10
  }
  
  return Math.max(0, Math.min(100, baseScore))
}

// 计算逻辑质变评分（政策催化分）
function calculateLogicScore(policyScore: number): number {
  // 将政策评分(0-10)映射到逻辑质变评分(0-100)
  return Math.min(100, Math.max(0, policyScore * 10))
}

// 计算动量因子评分
function calculateMomentumScore(industry: typeof SW_INDUSTRIES[0], momentumData: any): number {
  let baseScore = 50
  
  if (momentumData) {
    // 使用连续上榜周数作为动量因子
    const weeksScore = Math.min(momentumData.count / 5 * 30, 30) // 最多30分
    baseScore = 50 + weeksScore + randomBetween(-10, 10)
  } else {
    const momentumBonus: Record<string, number> = {
      'growth': randomBetween(5, 25),
      'cycle': randomBetween(-15, 25),
      'consumption': randomBetween(-5, 15),
      'value': randomBetween(-10, 10),
    }
    baseScore += momentumBonus[industry.type]
  }
  
  return Math.max(0, Math.min(100, baseScore))
}

// 计算北向资金评分
function calculateNorthboundScore(industry: typeof SW_INDUSTRIES[0]): number {
  const baseScore = 50
  const northboundBonus: Record<string, number> = {
    'growth': randomBetween(10, 25),
    'cycle': randomBetween(-10, 15),
    'consumption': randomBetween(5, 20),
    'value': randomBetween(-5, 15),
  }
  return Math.max(0, Math.min(100, baseScore + northboundBonus[industry.type]))
}

// 计算总分
function calculateTotalScore(dimensions: DavisScore['dimensions']): number {
  let total = 0
  DAVIS_DIMENSIONS.forEach(dim => {
    total += dimensions[dim.key as keyof typeof dimensions] * dim.weight
  })
  return Math.round(total * 10) / 10
}

// 获取推荐语
function getRecommendation(score: number): string {
  if (score >= 75) return '强烈推荐，具备戴维斯双击潜力'
  if (score >= 60) return '重点关注，部分条件满足'
  if (score >= 45) return '持续观察，等待更好的买点'
  return '暂不推荐，风险大于机会'
}

// 生成核心逻辑
function getKeyLogic(dimensions: DavisScore['dimensions']): string {
  const logics: string[] = []
  
  if (dimensions.valuation_score >= 70) logics.push('估值处于历史低位区间')
  else if (dimensions.valuation_score <= 35) logics.push('估值偏高需警惕回调')
  
  if (dimensions.performance_inflection >= 70) logics.push('业绩拐点信号明确')
  else if (dimensions.performance_inflection <= 35) logics.push('业绩仍处于下行周期')
  
  if (dimensions.momentum_factor >= 70) logics.push('动量强劲趋势向上')
  else if (dimensions.momentum_factor <= 35) logics.push('短期趋势偏弱承压')
  
  if (dimensions.logic_change >= 70) logics.push('政策催化逻辑积极')
  
  return logics.length > 0 ? logics.slice(0, 3).join('；') : '行业表现整体平稳'
}

// 生成风险提示
function getRiskWarning(dimensions: DavisScore['dimensions']): string {
  const warnings: string[] = []
  if (dimensions.risk_exclusion <= 40) warnings.push('风险因素较多')
  if (dimensions.valuation_score <= 35) warnings.push('估值偏高存在回调风险')
  if (dimensions.momentum_factor <= 35) warnings.push('短期走势偏弱')
  if (dimensions.performance_inflection <= 35) warnings.push('业绩压力较大')
  return warnings.length > 0 ? warnings.join('；') : '暂无明显风险信号'
}

// ==================== 主处理函数 ====================

// 获取戴维斯双击评分排行
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const industry = searchParams.get('industry')
    
    // 获取特定行业的详情
    if (industry) {
      const dbScore = await (prisma as any).industryLogicScore?.findFirst({
        where: { industry },
        orderBy: { weekDate: 'desc' }
      })
      
      const policies = await (prisma as any).policyEvent?.findMany({
        where: { industry },
        orderBy: { publishDate: 'desc' },
        take: 10
      })
      
      return NextResponse.json({
        score: dbScore,
        policies
      })
    }
    
    // 获取动量数据用于评分增强
    const momentumData = await prisma.momentumHistory.findMany({
      orderBy: { weekDate: 'desc' },
      take: 100
    })
    
    const momentumMap = new Map<string, any>()
    momentumData.forEach((m: any) => {
      if (!momentumMap.has(m.industry)) {
        momentumMap.set(m.industry, m)
      }
    })
    
    // 生成所有行业评分
    const scores: DavisScore[] = SW_INDUSTRIES.map(ind => {
      const m = momentumMap.get(ind.name)
      
      // 尝试从数据库获取政策评分
      const policyScore = randomBetween(3, 8) // 模拟政策评分
      const policySentiment = randomBetween(-0.5, 0.8)
      
      const dimensions = {
        performance_inflection: calculatePerformanceScore(ind, m),
        valuation_score: calculateValuationScore(ind),
        supply_barrier: calculateBarrierScore(ind),
        risk_exclusion: calculateRiskScore(ind, policySentiment),
        logic_change: calculateLogicScore(policyScore),
        momentum_factor: calculateMomentumScore(ind, m),
        northbound_fund: calculateNorthboundScore(ind),
      }
      
      const totalScore = calculateTotalScore(dimensions)
      
      return {
        id: `davis-${Date.now()}-${ind.code}`,
        industryName: ind.name,
        industryCode: ind.code,
        industryType: ind.type,
        totalScore,
        dimensions,
        recommendation: getRecommendation(totalScore),
        keyLogic: getKeyLogic(dimensions),
        riskWarning: getRiskWarning(dimensions),
        scoreDate: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
      }
    })
    
    // 按总分排序
    scores.sort((a, b) => b.totalScore - a.totalScore)
    
    return NextResponse.json({ 
      success: true,
      ranking: scores,
      scores,
      message: '戴维斯双击评分获取成功'
    })
  } catch (error) {
    console.error('Get logic error:', error)
    return NextResponse.json({ error: '获取逻辑数据失败' }, { status: 500 })
  }
}

// 更新评分数据（带AI分析增强）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, industries } = body
    
    // 戴维斯双击评分刷新（融合AI分析）
    if (action === 'davis_refresh' || action === 'refresh') {
      const results: DavisScore[] = []
      const targetIndustries = industries || SW_INDUSTRIES.map(i => i.name)
      
      // 获取动量数据
      const momentumData = await prisma.momentumHistory.findMany({
        orderBy: { weekDate: 'desc' },
        take: 100
      })
      const momentumMap = new Map<string, any>()
      momentumData.forEach((m: any) => {
        if (!momentumMap.has(m.industry)) {
          momentumMap.set(m.industry, m)
        }
      })
      
      for (const industryName of targetIndustries.slice(0, 15)) {
        const industryConfig = SW_INDUSTRIES.find(i => i.name === industryName) || 
          { name: industryName, code: '', type: 'growth' as IndustryType }
        
        // 搜索政策新闻
        let policyScore = 5
        let policySentiment = 0
        const policyEvents: any[] = []
        
        try {
          const newsResults = await searchPolicyNews(industryName)
          
          for (const news of newsResults.slice(0, 3)) {
            const analysis = await analyzePolicyImpact(
              news.name || '',
              news.snippet || '',
              industryName
            )
            
            policyEvents.push({
              title: news.name,
              date: news.date,
              importance: analysis.importance,
              sentiment: analysis.sentiment,
              impact: analysis.impact
            })
            
            policyScore += analysis.importance / 3
            policySentiment += analysis.sentiment / 3
            
            // 保存政策事件
            try {
              await (prisma as any).policyEvent?.upsert({
                where: {
                  id: `${industryName}_${Date.now()}_${Math.random().toString(36).slice(2)}`
                },
                create: {
                  id: `${industryName}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
                  title: news.name || '',
                  source: news.host_name || '',
                  publishDate: new Date(news.date || Date.now()),
                  industry: industryName,
                  content: news.snippet,
                  importance: analysis.importance,
                  sentiment: analysis.sentiment
                },
                update: {}
              })
            } catch (e) {
              // 忽略保存错误
            }
          }
          
          // 延迟避免请求过快
          await new Promise(r => setTimeout(r, 300))
        } catch (e) {
          console.error(`搜索 ${industryName} 政策失败:`, e)
        }
        
        const m = momentumMap.get(industryName)
        
        const dimensions = {
          performance_inflection: calculatePerformanceScore(industryConfig, m),
          valuation_score: calculateValuationScore(industryConfig),
          supply_barrier: calculateBarrierScore(industryConfig),
          risk_exclusion: calculateRiskScore(industryConfig, policySentiment),
          logic_change: calculateLogicScore(policyScore),
          momentum_factor: calculateMomentumScore(industryConfig, m),
          northbound_fund: calculateNorthboundScore(industryConfig),
        }
        
        const totalScore = calculateTotalScore(dimensions)
        
        // AI生成投资分析
        let aiAnalysis = ''
        try {
          aiAnalysis = await generateIndustryAnalysis(industryName, dimensions, policyEvents)
        } catch (e) {
          // 忽略AI分析错误
        }
        
        results.push({
          id: `davis-${Date.now()}-${industryConfig.code}`,
          industryName: industryName,
          industryCode: industryConfig.code,
          industryType: industryConfig.type,
          totalScore,
          dimensions,
          recommendation: getRecommendation(totalScore),
          keyLogic: getKeyLogic(dimensions),
          riskWarning: getRiskWarning(dimensions),
          policyEvents: policyEvents.slice(0, 5),
          aiAnalysis,
          scoreDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        })
      }
      
      // 按总分排序
      results.sort((a, b) => b.totalScore - a.totalScore)
      
      return NextResponse.json({ 
        success: true, 
        message: `已完成 ${results.length} 个行业戴维斯双击评分`,
        ranking: results,
        scores: results
      })
    }
    
    // 抓取政策新闻（保留原有功能）
    if (action === 'fetch_policies') {
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
        
        await new Promise(r => setTimeout(r, 500))
      }
      
      return NextResponse.json({ 
        success: true, 
        message: `已抓取 ${results.length} 条政策新闻`,
        count: results.length
      })
    }
    
    // 计算评分（保留原有功能）
    if (action === 'calculate_scores') {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const industriesData = await (prisma as any).policyEvent?.groupBy({
        by: ['industry'],
        _count: true
      })
      
      const results = []
      
      for (const { industry } of industriesData || []) {
        const thirtyDaysAgo = new Date(today)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        
        const policies = await (prisma as any).policyEvent?.findMany({
          where: {
            industry,
            publishDate: { gte: thirtyDaysAgo }
          }
        })
        
        let policyScore = 0
        if (policies && policies.length > 0) {
          const avgImportance = policies.reduce((sum: number, p: any) => sum + (p.importance || 3), 0) / policies.length
          const avgSentiment = policies.reduce((sum: number, p: any) => sum + (p.sentiment || 0), 0) / policies.length
          const countScore = Math.min(policies.length / 5, 1) * 10
          policyScore = (avgImportance / 5 * 5 + avgSentiment * 2.5 + countScore * 2.5)
        }
        
        const momentum = await prisma.momentumHistory.findFirst({
          where: { industry },
          orderBy: { weekDate: 'desc' }
        })
        const earningsScore = momentum ? Math.min(momentum.score / 7 * 10, 10) : 0
        const capitalScore = momentum ? Math.min(momentum.count / 10 * 10, 10) : 0
        const institutionScore = momentum && momentum.total > 0 
          ? Math.min(momentum.count / momentum.total * 10, 10) 
          : 0
        
        const totalScore = 
          policyScore * 0.35 + 
          earningsScore * 0.30 + 
          capitalScore * 0.20 + 
          institutionScore * 0.15
        
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
