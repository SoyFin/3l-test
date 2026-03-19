import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatDate, StockData } from '@/lib/data-parser';

// 获取股票数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const weekDateStr = searchParams.get('weekDate');
    const industry = searchParams.get('industry');
    
    if (code) {
      // 获取单个股票详情
      const fundamental = await prisma.fundamentals.findUnique({
        where: { code }
      });
      
      // 查找该股票在哪些周度数据中出现
      const weeklyData = await prisma.weeklyData.findMany({
        orderBy: { weekDate: 'desc' },
        take: 20
      });
      
      const appearances: { weekDate: string; change: number; industry: string }[] = [];
      
      for (const week of weeklyData) {
        const stocks = week.stocks as StockData[];
        const stock = stocks.find(s => s.code === code);
        if (stock) {
          appearances.push({
            weekDate: formatDate(new Date(week.weekDate)),
            change: stock.change,
            industry: stock.industry
          });
        }
      }
      
      return NextResponse.json({
        success: true,
        data: {
          code,
          fundamental,
          appearances,
          appearanceCount: appearances.length
        }
      });
    }
    
    if (weekDateStr && industry) {
      // 获取指定周和行业的股票列表
      const weekDate = new Date(weekDateStr);
      const weeklyData = await prisma.weeklyData.findFirst({
        where: { weekDate }
      });
      
      if (!weeklyData) {
        return NextResponse.json({
          success: false,
          error: '未找到该周数据'
        }, { status: 404 });
      }
      
      const stocks = weeklyData.stocks as StockData[];
      const industryStocks = stocks
        .filter(s => s.industryLevel2 === industry)
        .sort((a, b) => b.change - a.change);
      
      return NextResponse.json({
        success: true,
        data: industryStocks
      });
    }
    
    if (weekDateStr) {
      // 获取指定周所有股票
      const weekDate = new Date(weekDateStr);
      const weeklyData = await prisma.weeklyData.findFirst({
        where: { weekDate }
      });
      
      if (!weeklyData) {
        return NextResponse.json({
          success: false,
          error: '未找到该周数据'
        }, { status: 404 });
      }
      
      const stocks = weeklyData.stocks as StockData[];
      
      return NextResponse.json({
        success: true,
        data: stocks.sort((a, b) => b.change - a.change)
      });
    }
    
    // 获取最新一周的股票列表
    const latestWeek = await prisma.weeklyData.findFirst({
      orderBy: { weekDate: 'desc' }
    });
    
    if (!latestWeek) {
      return NextResponse.json({
        success: true,
        data: [],
        message: '暂无数据'
      });
    }
    
    const stocks = latestWeek.stocks as StockData[];
    
    return NextResponse.json({
      success: true,
      data: stocks.sort((a, b) => b.change - a.change),
      meta: {
        weekDate: formatDate(new Date(latestWeek.weekDate)),
        count: stocks.length
      }
    });
  } catch (error) {
    console.error('获取股票数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}
