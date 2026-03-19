import { NextRequest, NextResponse } from 'next/server'
import { prisma, checkDataUploadReminder } from '@/lib/db'
import { getMomentumColor } from '@/lib/momentum-calculator'

// 计算连续上榜周数（必须连续出现在TOP 10中）
async function calculateContinuousWeeks(industry: string): Promise<number> {
  // 获取所有周的动量数据，按分数排序
  const allMomentum = await prisma.momentumHistory.findMany({
    orderBy: [{ weekDate: 'desc' }, { score: 'desc' }]
  })
  
  // 按周分组并取TOP 10
  const weekGroups = new Map<string, string[]>()
  for (const m of allMomentum) {
    const key = m.weekDate.toISOString()
    if (!weekGroups.has(key)) weekGroups.set(key, [])
    if (weekGroups.get(key)!.length < 10) {
      weekGroups.get(key)!.push(m.industry)
    }
  }
  
  // 按周日期排序（倒序）
  const sortedWeeks = Array.from(weekGroups.keys()).sort((a, b) => 
    new Date(b).getTime() - new Date(a).getTime()
  )
  
  // 计算连续周数
  let continuousWeeks = 0
  for (const weekKey of sortedWeeks) {
    const top10 = weekGroups.get(weekKey)
    if (top10?.includes(industry)) {
      continuousWeeks++
    } else {
      break
    }
  }
  
  return continuousWeeks
}

// 获取动量排行
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekDate = searchParams.get('weekDate')
    const industry = searchParams.get('industry')
    
    if (industry) {
      // 获取特定行业的详情
      const industryData = await prisma.momentumHistory.findFirst({
        where: { 
          industry,
          weekDate: weekDate ? new Date(weekDate) : undefined
        },
        orderBy: { weekDate: 'desc' }
      })
      
      if (!industryData) {
        return NextResponse.json({ error: '未找到该行业数据' }, { status: 404 })
      }
      
      // 获取该行业对应的股票
      const weeklyData = await prisma.weeklyData.findFirst({
        where: { weekDate: industryData.weekDate }
      })
      
      const stocks = (weeklyData?.stocks as Array<{ code: string; name: string; change: number; industry: string; industryLevel2: string }>) || []
      const industryStocks = stocks.filter(s => s.industryLevel2 === industry)
      
      // 获取基本面数据
      const fundamentals = await prisma.fundamentals.findMany({
        where: { code: { in: industryStocks.map(s => s.code) } }
      })
      
      const fundamentalsMap = new Map(fundamentals.map(f => [f.code, f]))
      
      // 组合数据
      const stocksWithFundamentals = industryStocks.map(s => ({
        ...s,
        fundamentals: fundamentalsMap.get(s.code) || null
      }))
      
      // 获取历史数据（用于趋势图）
      const allHistory = await prisma.momentumHistory.findMany({
        where: { industry },
        orderBy: { weekDate: 'desc' },
        take: 52
      })
      
      // 计算连续上榜周数（在TOP 10中连续出现）
      const continuousWeeks = await calculateContinuousWeeks(industry)
      
      // 获取趋势数据
      const trendData = allHistory.slice(0, 12).map(h => ({
        weekDate: h.weekDate,
        score: h.score
      }))
      
      return NextResponse.json({
        industry: industryData.industry,
        score: industryData.score,
        count: industryData.count,
        total: industryData.total,
        rank: industryData.rank,
        weekDate: industryData.weekDate,
        stocks: stocksWithFundamentals.sort((a, b) => b.change - a.change),
        continuousWeeks,
        trend: trendData
      })
    }
    
    // 获取最新动量排行
    const latestMomentum = await prisma.momentumHistory.findFirst({
      orderBy: { weekDate: 'desc' }
    })
    
    if (!latestMomentum) {
      return NextResponse.json({ 
        ranking: [],
        reminder: await checkDataUploadReminder()
      })
    }
    
    // 获取该周的所有动量数据
    const momentumData = await prisma.momentumHistory.findMany({
      where: { weekDate: latestMomentum.weekDate },
      orderBy: { score: 'desc' }
    })
    
    // 只取前10名
    const top10Data = momentumData.slice(0, 10)
    
    // 一次性获取所有历史数据，按周分组
    const allMomentumHistory = await prisma.momentumHistory.findMany({
      orderBy: [{ weekDate: 'desc' }, { score: 'desc' }]
    })
    
    // 按周分组并记录TOP 10
    const top10ByWeek = new Map<string, Set<string>>()
    const weekGroups = new Map<string, typeof allMomentumHistory>()
    
    for (const m of allMomentumHistory) {
      const key = m.weekDate.toISOString()
      if (!weekGroups.has(key)) weekGroups.set(key, [])
      weekGroups.get(key)!.push(m)
    }
    
    for (const [key, records] of weekGroups) {
      const top10 = new Set(records.slice(0, 10).map(r => r.industry))
      top10ByWeek.set(key, top10)
    }
    
    // 按周日期排序（倒序）
    const sortedWeeks = Array.from(top10ByWeek.keys()).sort((a, b) => 
      new Date(b).getTime() - new Date(a).getTime()
    )
    
    // 计算每个行业的连续上榜周数
    const continuousWeeksMap = new Map<string, number>()
    for (const industry of top10Data.map(m => m.industry)) {
      let weeks = 0
      for (const weekKey of sortedWeeks) {
        if (top10ByWeek.get(weekKey)?.has(industry)) {
          weeks++
        } else {
          break
        }
      }
      continuousWeeksMap.set(industry, weeks)
    }
    
    // 构建排行数据
    const ranking = top10Data.map(m => ({
      industry: m.industry,
      score: m.score,
      count: m.count,
      total: m.total,
      rank: m.rank,
      weekDate: m.weekDate,
      continuousWeeks: continuousWeeksMap.get(m.industry) || 0,
      color: getMomentumColor(m.score)
    }))
    
    // 获取上传提醒
    const reminder = await checkDataUploadReminder()
    
    // 获取上榜板块的趋势数据（最近12周）
    const trendData: Record<string, { weekDate: string; score: number }[]> = {}
    for (const item of ranking) {
      const history = await prisma.momentumHistory.findMany({
        where: { industry: item.industry },
        orderBy: { weekDate: 'desc' },
        take: 12
      })
      trendData[item.industry] = history.map(h => ({
        weekDate: h.weekDate.toISOString().split('T')[0],
        score: h.score
      }))
    }
    
    return NextResponse.json({ 
      ranking,
      reminder,
      lastUpdate: latestMomentum.weekDate,
      trendData
    })
  } catch (error) {
    console.error('Get momentum error:', error)
    return NextResponse.json({ error: '获取动量数据失败' }, { status: 500 })
  }
}
