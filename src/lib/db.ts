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

/**
 * 计算最近的周五日期
 * @param date 参考日期，默认为当前日期
 * @returns 最近的周五日期（如果今天是周末，返回上周五）
 */
export function getLastFriday(date: Date = new Date()): Date {
  const d = new Date(date)
  const dayOfWeek = d.getDay()
  
  // 0 = 周日, 1 = 周一, ..., 5 = 周五, 6 = 周六
  // 计算距离周五的天数差
  let daysToSubtract = 0
  
  if (dayOfWeek === 0) {
    // 周日：取上周五（减2天）
    daysToSubtract = 2
  } else if (dayOfWeek === 6) {
    // 周六：取上周五（减1天）
    daysToSubtract = 1
  } else {
    // 周一到周五：如果今天是周五则返回今天，否则返回本周五
    // dayOfWeek - 5: 周一= -4, 周二= -3, 周三= -2, 周四= -1, 周五= 0
    daysToSubtract = dayOfWeek - 5
    // 如果是负数，说明本周五还没到，取上周五
    if (daysToSubtract < 0) {
      daysToSubtract = dayOfWeek + 2 // 周一=3, 周二=4, 周三=5, 周四=6
    }
  }
  
  d.setDate(d.getDate() - daysToSubtract)
  d.setHours(0, 0, 0, 0)
  
  return d
}

/**
 * 标准化日期为UTC midnight，避免时区问题
 */
function normalizeToUTCMidnight(date: Date): Date {
  return new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ))
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
  if (!industry || typeof industry !== 'string') {
    return []
  }
  
  const safeWeeks = Math.max(1, Math.min(weeks, 52)) // 限制范围 1-52
  
  const history = await prisma.momentumHistory.findMany({
    where: { industry },
    orderBy: { weekDate: 'desc' },
    take: safeWeeks
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
  
  // 使用修复后的周五日期计算
  const friday = getLastFriday(now)
  
  // 比较时使用UTC时间，避免时区问题
  const fridayUTC = normalizeToUTCMidnight(friday)
  const lastUploadUTC = lastWeeklyUpload ? normalizeToUTCMidnight(new Date(lastWeeklyUpload)) : null
  
  const weeklyNeeded = !lastUploadUTC || lastUploadUTC < fridayUTC
  let weeklyMessage = ''
  if (!lastWeeklyUpload) {
    weeklyMessage = '尚未上传周度数据，请上传'
  } else if (weeklyNeeded) {
    weeklyMessage = `上次上传日期：${lastWeeklyUpload.toISOString().split('T')[0]}，需要更新`
  }
  
  // 季度检查
  const currentYear = now.getFullYear()
  const quarterEnds = [
    new Date(Date.UTC(currentYear, 2, 31)),   // Q1: 3月31日
    new Date(Date.UTC(currentYear, 5, 30)),   // Q2: 6月30日
    new Date(Date.UTC(currentYear, 8, 30)),   // Q3: 9月30日
    new Date(Date.UTC(currentYear, 11, 31))   // Q4: 12月31日
  ]
  
  // 找到最近的已过季度末
  let nearestQuarterEnd: Date | null = null
  for (const qEnd of quarterEnds) {
    if (qEnd <= now) {
      nearestQuarterEnd = qEnd
    }
  }
  
  const quarterlyNeeded = nearestQuarterEnd !== null && 
    (!lastQuarterlyUpdate || normalizeToUTCMidnight(new Date(lastQuarterlyUpdate)) < nearestQuarterEnd)
  
  let quarterlyMessage = ''
  if (quarterlyNeeded && nearestQuarterEnd) {
    const qNames = ['一', '二', '三', '四']
    const qIndex = Math.floor(nearestQuarterEnd.getUTCMonth() / 3)
    quarterlyMessage = `需要上传${qNames[qIndex]}季度末的全A数据（截止${nearestQuarterEnd.toISOString().split('T')[0]}）`
  }
  
  return {
    weekly: { needed: weeklyNeeded, message: weeklyMessage },
    quarterly: { needed: !!quarterlyNeeded, message: quarterlyMessage }
  }
}

export async function saveFundamentals(data: FundamentalsData) {
  if (!data.code) {
    throw new Error('股票代码不能为空')
  }
  
  return prisma.fundamentals.upsert({
    where: { code: data.code },
    create: data as unknown as Record<string, unknown>,
    update: { ...data, updatedAt: new Date() } as unknown as Record<string, unknown>
  })
}

export async function getFundamentals(code: string) {
  if (!code) return null
  
  return prisma.fundamentals.findUnique({
    where: { code }
  })
}

export async function getMultipleFundamentals(codes: string[]) {
  if (!codes || !Array.isArray(codes) || codes.length === 0) {
    return []
  }
  
  // 过滤掉空值
  const validCodes = codes.filter(c => c && typeof c === 'string')
  
  return prisma.fundamentals.findMany({
    where: { code: { in: validCodes } }
  })
}

export async function setConfig(key: string, value: unknown) {
  if (!key) {
    throw new Error('配置键不能为空')
  }
  
  return prisma.systemConfig.upsert({
    where: { key },
    create: { key, value: value as Record<string, unknown> },
    update: { value: value as Record<string, unknown> }
  })
}

export async function getConfig(key: string) {
  if (!key) return null
  
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
