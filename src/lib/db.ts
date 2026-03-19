import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// 股票数据类型
export interface StockData {
  code: string
  name: string
  change: number  // 20日涨跌幅
  industry: string  // 三级行业
  industryLevel2: string  // 二级行业
}

// 动量计算结果
export interface MomentumResult {
  industry: string
  score: number
  count: number
  total: number
  rank: number
  continuousWeeks: number
  stocks: StockData[]
}

// 基本面数据
export interface FundamentalsData {
  code: string
  name: string
  industry?: string
  revenueGrowth?: number
  profitGrowth?: number
  grossMargin?: number
  roe?: number
  debtRatio?: number
  pe?: number
  pb?: number
  fundHolding?: number
  northHolding?: number
  goodwill?: number
  pledgeRatio?: number
  tags?: string[]
  financialData?: Record<string, unknown>
}

// 获取动量排行（含连续上榜周数）
export async function getMomentumRankingWithContinuous(): Promise<{
  industry: string
  score: number
  count: number
  total: number
  rank: number
  weekDate: Date
  continuousWeeks: number
  color: 'gray' | 'green' | 'orange'
}[]> {
  // 获取最新的动量数据
  const latestMomentum = await prisma.momentumHistory.findFirst({
    orderBy: { weekDate: 'desc' }
  })
  
  if (!latestMomentum) {
    return []
  }
  
  // 获取该日期的所有动量数据
  const momentumData = await prisma.momentumHistory.findMany({
    where: { weekDate: latestMomentum.weekDate },
    orderBy: { score: 'desc' }
  })
  
  // 计算排名和连续上榜周数
  const results = []
  
  for (let i = 0; i < momentumData.length; i++) {
    const item = momentumData[i]
    
    // 计算连续上榜周数
    const history = await prisma.momentumHistory.findMany({
      where: { industry: item.industry },
      orderBy: { weekDate: 'desc' },
      take: 52
    })
    
    let continuousWeeks = 0
    for (const h of history) {
      if (h.score > 0) {
        continuousWeeks++
      } else {
        break
      }
    }
    
    // 计算颜色
    let color: 'gray' | 'green' | 'orange' = 'gray'
    if (item.score > 1 && item.score < 7) {
      color = 'green'
    } else if (item.score >= 7) {
      color = 'orange'
    }
    
    results.push({
      industry: item.industry,
      score: item.score,
      count: item.count,
      total: item.total,
      rank: i + 1,
      weekDate: item.weekDate,
      continuousWeeks,
      color
    })
  }
  
  return results
}

// 获取动量趋势
export async function getMomentumTrend(industry: string, weeks: number = 12): Promise<{
  weekDate: Date
  score: number
}[]> {
  const history = await prisma.momentumHistory.findMany({
    where: { industry },
    orderBy: { weekDate: 'desc' },
    take: weeks
  })
  
  return history.map(h => ({
    weekDate: h.weekDate,
    score: h.score
  }))
}

// 检查数据上传提醒
export async function checkDataUploadReminder(): Promise<{
  weekly: { needed: boolean; message: string }
  quarterly: { needed: boolean; message: string }
}> {
  const now = new Date()
  const lastWeeklyUpload = await getLastUploadDate()
  const lastQuarterlyUpdate = await getLastAllStocksUpdate()
  
  // 计算本周五
  const dayOfWeek = now.getDay()
  const friday = new Date(now)
  if (dayOfWeek === 0) {
    friday.setDate(friday.getDate() - 2)  // 上周五
  } else if (dayOfWeek === 5) {
    // 今天是周五
  } else {
    friday.setDate(friday.getDate() - (dayOfWeek - 5))  // 本周五
  }
  friday.setHours(0, 0, 0, 0)
  
  const weeklyNeeded = !lastWeeklyUpload || new Date(lastWeeklyUpload) < friday
  let weeklyMessage = ''
  if (!lastWeeklyUpload) {
    weeklyMessage = '尚未上传周度数据，请上传'
  } else if (weeklyNeeded) {
    weeklyMessage = `上次上传日期：${lastWeeklyUpload.toISOString().split('T')[0]}，需要更新`
  }
  
  // 季度检查
  const month = now.getMonth()
  const quarterEnds = [
    new Date(now.getFullYear(), 2, 31),   // Q1: 3月31日
    new Date(now.getFullYear(), 5, 30),   // Q2: 6月30日
    new Date(now.getFullYear(), 8, 30),   // Q3: 9月30日
    new Date(now.getFullYear(), 11, 31)   // Q4: 12月31日
  ]
  
  // 找到最近的季度末
  let nearestQuarterEnd: Date | null = null
  for (const qEnd of quarterEnds) {
    if (qEnd <= now) {
      nearestQuarterEnd = qEnd
    }
  }
  
  const quarterlyNeeded = nearestQuarterEnd !== null && (!lastQuarterlyUpdate || new Date(lastQuarterlyUpdate) < nearestQuarterEnd)
  let quarterlyMessage = ''
  if (quarterlyNeeded && nearestQuarterEnd) {
    const qNames = ['一', '二', '三', '四']
    const qIndex = Math.floor(nearestQuarterEnd.getMonth() / 3)
    quarterlyMessage = `需要上传${qNames[qIndex]}季度末的全A数据（截止${nearestQuarterEnd.toISOString().split('T')[0]}）`
  }
  
  return {
    weekly: { needed: weeklyNeeded, message: weeklyMessage },
    quarterly: { needed: !!quarterlyNeeded, message: quarterlyMessage }
  }
}

export async function saveFundamentals(data: FundamentalsData) {
  return prisma.fundamentals.upsert({
    where: { code: data.code },
    create: data as unknown as Record<string, unknown>,
    update: { ...data, updatedAt: new Date() } as unknown as Record<string, unknown>
  })
}

export async function getFundamentals(code: string) {
  return prisma.fundamentals.findUnique({
    where: { code }
  })
}

export async function getMultipleFundamentals(codes: string[]) {
  return prisma.fundamentals.findMany({
    where: { code: { in: codes } }
  })
}

export async function setConfig(key: string, value: unknown) {
  return prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: value as Record<string, unknown> },
    update: { value: value as Record<string, unknown> }
  })
}

export async function getConfig(key: string) {
  const config = await prisma.systemConfig.findUnique({
    where: { key }
  })
  return config?.value
}

export async function getLastUploadDate(): Promise<Date | null> {
  const lastUpload = await prisma.weeklyData.findFirst({
    orderBy: { weekDate: 'desc' }
  })
  return lastUpload?.weekDate || null
}

export async function getLastAllStocksUpdate(): Promise<Date | null> {
  const lastUpdate = await prisma.allStocks.findFirst({
    orderBy: { updateDate: 'desc' }
  })
  return lastUpdate?.updateDate || null
}
