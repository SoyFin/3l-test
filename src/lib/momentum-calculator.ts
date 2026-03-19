import { StockData, MomentumResult, prisma } from './db'

// 计算动量分值
export function calculateMomentumScore(count: number, total: number): number {
  if (total === 0) return 0
  const ratio = count / total
  return Number((count * ratio).toFixed(2))
}

// 获取动量分值颜色
export function getMomentumColor(score: number): 'gray' | 'green' | 'orange' {
  if (score <= 1) return 'gray'
  if (score >= 7) return 'orange'
  return 'green'
}

// 计算行业动量排行
export async function calculateMomentumRanking(
  stocks: StockData[],
  industryComponents: Map<string, number>
): Promise<MomentumResult[]> {
  // 按二级行业分组
  const industryStocks = new Map<string, StockData[]>()
  
  for (const stock of stocks) {
    const level2 = stock.industryLevel2
    if (!industryStocks.has(level2)) {
      industryStocks.set(level2, [])
    }
    industryStocks.get(level2)!.push(stock)
  }
  
  // 计算每个行业的动量分值
  const results: MomentumResult[] = []
  
  const industries = Array.from(industryStocks.keys())
  for (const industry of industries) {
    const stockList = industryStocks.get(industry)!
    const count = stockList.length
    
    // 成分股数量必须来自全A数据统计
    const total = industryComponents.get(industry)
    
    // 如果没有该行业的成分数据，跳过该行业（提示用户先上传全A数据）
    if (total === undefined || total === 0) {
      console.warn(`行业 ${industry} 缺少成分股数据，请先上传全A数据`)
      continue
    }
    
    const score = calculateMomentumScore(count, total)
    
    if (score > 0) {
      results.push({
        industry,
        score,
        count,
        total,
        rank: 0,
        continuousWeeks: 0,
        stocks: stockList.sort((a, b) => b.change - a.change)
      })
    }
  }
  
  // 按分值排序
  results.sort((a, b) => b.score - a.score)
  
  // 添加排名
  for (let i = 0; i < results.length; i++) {
    results[i].rank = i + 1
  }
  
  return results
}

// 计算并保存动量数据
export async function calculateAndSaveMomentum(
  stocks: StockData[],
  weekDate: Date,
  forceRecalculate: boolean = false
): Promise<{ results: MomentumResult[]; hasAllStocksData: boolean; missingCount: number }> {
  // 获取行业成分数量
  const components = await prisma.industryComponents.findMany()
  const industryComponents = new Map<string, number>()
  for (const c of components) {
    industryComponents.set(c.industry, c.count)
  }
  
  // 检查是否有全A数据
  const hasAllStocksData = components.length > 0
  if (!hasAllStocksData) {
    console.warn('未找到全A数据，请先上传全A数据')
    return { results: [], hasAllStocksData: false, missingCount: 0 }
  }
  
  // 统计缺少成分数据的行业数量
  const industriesInData = new Set(stocks.map(s => s.industryLevel2))
  let missingCount = 0
  for (const industry of industriesInData) {
    if (!industryComponents.has(industry)) {
      missingCount++
    }
  }
  
  // 计算动量
  const results = await calculateMomentumRanking(stocks, industryComponents)
  
  // 保存到数据库（先删除旧数据）
  await prisma.$transaction(async (tx) => {
    // 如果是重新计算，先删除该周的旧动量数据
    if (forceRecalculate) {
      await tx.momentumHistory.deleteMany({
        where: { weekDate }
      })
    }
    
    // 保存新的动量数据
    for (const result of results) {
      await tx.momentumHistory.upsert({
        where: {
          weekDate_industry: {
            weekDate,
            industry: result.industry
          }
        },
        create: {
          weekDate,
          industry: result.industry,
          score: result.score,
          count: result.count,
          total: result.total,
          rank: result.rank
        },
        update: {
          score: result.score,
          count: result.count,
          total: result.total,
          rank: result.rank
        }
      })
    }
  })
  
  return { results, hasAllStocksData: true, missingCount }
}
