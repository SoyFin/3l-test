import { NextRequest, NextResponse } from 'next/server'
import { prisma, StockData } from '@/lib/db'
import { parseFile } from '@/lib/data-parser'
import { calculateAndSaveMomentum } from '@/lib/momentum-calculator'
import crypto from 'crypto'

// 生成数据Hash
function generateDataHash(stocks: StockData[]): string {
  const sortedCodes = stocks.map(s => s.code).sort().join(',')
  return crypto.createHash('md5').update(sortedCodes).digest('hex')
}

// 上传数据
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string  // 'weekly' or 'all'
    const weekDateStr = formData.get('weekDate') as string  // 新增：自定义日期
    
    if (!file) {
      return NextResponse.json({ error: '未上传文件' }, { status: 400 })
    }
    
    const buffer = Buffer.from(await file.arrayBuffer())
    const filename = file.name
    
    if (type === 'all') {
      // 上传全A数据
      const stocks = await parseFile(buffer, filename)
      
      if (stocks.length === 0) {
        return NextResponse.json({ error: '未解析到有效数据' }, { status: 400 })
      }
      
      // 统计行业成分数量
      const industryComponents = new Map<string, number>()
      for (const stock of stocks) {
        const industry = stock.industryLevel2
        if (industry) {
          industryComponents.set(industry, (industryComponents.get(industry) || 0) + 1)
        }
      }
      
      // 使用事务保存数据
      await prisma.$transaction(async (tx) => {
        // 保存到数据库
        await tx.allStocks.create({
          data: {
            updateDate: new Date(),
            stocks: stocks as unknown as Record<string, unknown>[]
          }
        })
        
        // 更新行业成分数量
        for (const [industry, count] of industryComponents) {
          await tx.industryComponents.upsert({
            where: { industry },
            create: { industry, count },
            update: { count }
          })
        }
      })
      
      // 重新计算最新一周的动量数据
      const latestWeekly = await prisma.weeklyData.findFirst({
        orderBy: { weekDate: 'desc' }
      })
      
      let recalculatedIndustries = 0
      if (latestWeekly) {
        const weeklyStocks = latestWeekly.stocks as StockData[]
        const result = await calculateAndSaveMomentum(weeklyStocks, new Date(latestWeekly.weekDate), true)
        recalculatedIndustries = result.results.length
      }
      
      return NextResponse.json({ 
        success: true, 
        message: '全A数据上传成功',
        totalStocks: stocks.length,
        totalIndustries: industryComponents.size,
        recalculatedIndustries
      })
    } else {
      // 上传周度数据
      const stocks = await parseFile(buffer, filename)
      
      if (stocks.length === 0) {
        return NextResponse.json({ error: '未解析到有效数据' }, { status: 400 })
      }
      
      // 使用传入的日期，或计算周五日期
      let friday: Date
      if (weekDateStr) {
        // 使用用户选择的日期
        friday = new Date(weekDateStr)
        friday.setHours(0, 0, 0, 0)
      } else {
        // 计算周五日期（默认逻辑）
        const now = new Date()
        const dayOfWeek = now.getDay()
        friday = new Date(now)
        if (dayOfWeek === 0) {
          friday.setDate(friday.getDate() - 2)
        } else if (dayOfWeek === 6) {
          friday.setDate(friday.getDate() - 1)
        } else if (dayOfWeek < 5) {
          friday.setDate(friday.getDate() - (dayOfWeek + 2))
        }
        friday.setHours(0, 0, 0, 0)
      }
      
      // 检查是否有全A数据
      const componentsCount = await prisma.industryComponents.count()
      if (componentsCount === 0) {
        return NextResponse.json({ 
          success: false, 
          error: '请先上传全A数据',
          message: '周度数据已保存，但缺少全A成分股数据。请先上传全A数据后再上传周度数据，才能正确计算动量分值。'
        })
      }
      
      // 生成数据Hash
      const dataHash = generateDataHash(stocks)
      
      // 检查该周是否已有相同数据
      const existingData = await prisma.weeklyData.findUnique({
        where: { weekDate: friday }
      })
      
      if (existingData && (existingData as any).dataHash === dataHash) {
        return NextResponse.json({ 
          success: false, 
          error: '重复数据',
          message: '该周已存在完全相同的数据，无需重复上传。',
          weekDate: friday.toISOString().split('T')[0],
          isDuplicate: true
        })
      }
      
      // 使用事务：先删除旧数据再保存新数据
      await prisma.$transaction(async (tx) => {
        // 删除该周的旧数据
        await tx.weeklyData.deleteMany({
          where: { weekDate: friday }
        })
        
        // 删除该周的旧动量数据
        await tx.momentumHistory.deleteMany({
          where: { weekDate: friday }
        })
        
        // 保存新的周度数据（带Hash）
        await tx.weeklyData.create({
          data: {
            weekDate: friday,
            dataHash,
            stocks: stocks as unknown as Record<string, unknown>[]
          }
        })
      })
      
      // 检查与上周数据是否一致
      const lastWeekData = await prisma.weeklyData.findFirst({
        where: { weekDate: { lt: friday } },
        orderBy: { weekDate: 'desc' }
      })
      
      let dataQualityWarnings: string[] = []
      
      if (lastWeekData) {
        const lastWeekStocks = lastWeekData.stocks as StockData[]
        
        // 检查股票列表是否完全一致（可能是数据源问题）
        if (lastWeekStocks.length === stocks.length) {
          const lastWeekCodes = new Set(lastWeekStocks.map(s => s.code))
          const currentCodes = new Set(stocks.map(s => s.code))
          const allSame = [...lastWeekCodes].every(code => currentCodes.has(code))
          
          if (allSame) {
            dataQualityWarnings.push('⚠️ 警告：本周股票列表与上周完全一致，请确认数据是否正确更新！')
          }
        }
      }
      
      // 计算并保存动量
      const momentumResult = await calculateAndSaveMomentum(stocks, friday)
      
      // 检查动量数据的连续性
      const currentTopIndustries = momentumResult.results.slice(0, 10).map(m => m.industry)
      if (lastWeekData) {
        const lastWeekMomentum = await prisma.momentumHistory.findMany({
          where: { weekDate: (lastWeekData as any).weekDate },
          orderBy: { score: 'desc' },
          take: 10
        })
        
        if (lastWeekMomentum.length === 10 && currentTopIndustries.length === 10) {
          const lastWeekTopIndustries = new Set(lastWeekMomentum.map(m => m.industry))
          const overlap = currentTopIndustries.filter(i => lastWeekTopIndustries.has(i)).length
          
          if (overlap === 10) {
            dataQualityWarnings.push('⚠️ 警告：本周前10上榜板块与上周完全相同，请确认数据是否正确更新！')
          }
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        message: '周度数据上传成功',
        totalStocks: stocks.length,
        weekDate: friday.toISOString().split('T')[0],
        momentumIndustries: momentumResult.results.length,
        missingIndustryCount: momentumResult.missingCount,
        warning: momentumResult.missingCount > 0 
          ? `有 ${momentumResult.missingCount} 个行业缺少全A成分数据，未计入动量排行` 
          : undefined,
        dataQualityWarnings: dataQualityWarnings.length > 0 ? dataQualityWarnings : undefined
      })
    }
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ 
      error: '上传失败', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}

// 获取上传历史
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'weekly'
    
    if (type === 'all') {
      const history = await prisma.allStocks.findMany({
        orderBy: { updateDate: 'desc' },
        take: 10
      })
      return NextResponse.json({ history })
    } else {
      const history = await prisma.weeklyData.findMany({
        orderBy: { weekDate: 'desc' },
        take: 52  // 最近一年
      })
      return NextResponse.json({ history })
    }
  } catch (error) {
    console.error('Get upload history error:', error)
    return NextResponse.json({ error: '获取历史失败' }, { status: 500 })
  }
}

// 删除指定日期的数据
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const weekDateStr = searchParams.get('weekDate')
    
    if (!weekDateStr) {
      return NextResponse.json({ error: '未指定日期' }, { status: 400 })
    }
    
    const weekDate = new Date(weekDateStr)
    weekDate.setHours(0, 0, 0, 0)
    
    // 检查数据是否存在
    const existingData = await prisma.weeklyData.findUnique({
      where: { weekDate }
    })
    
    if (!existingData) {
      return NextResponse.json({ error: '该日期没有数据' }, { status: 404 })
    }
    
    // 使用事务删除相关数据
    await prisma.$transaction(async (tx) => {
      // 删除周度数据
      await tx.weeklyData.delete({
        where: { weekDate }
      })
      
      // 删除动量历史数据
      await tx.momentumHistory.deleteMany({
        where: { weekDate }
      })
      
      // 删除逻辑评分数据（如果存在）
      try {
        await (tx as any).industryLogicScore?.deleteMany({
          where: { weekDate }
        })
      } catch (e) {
        // 忽略表不存在的错误
      }
    })
    
    return NextResponse.json({ 
      success: true, 
      message: `已删除 ${weekDateStr} 的数据`
    })
    
  } catch (error) {
    console.error('Delete error:', error)
    return NextResponse.json({ 
      error: '删除失败', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
}
