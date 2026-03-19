import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatDate, StockData } from '@/lib/data-parser';

// 导出数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') || 'momentum'; // momentum, stocks, history
    const weekDateStr = searchParams.get('weekDate');
    const format = searchParams.get('format') || 'csv'; // csv, json
    
    if (type === 'momentum') {
      // 导出动量数据
      let weekDate: Date;
      if (weekDateStr) {
        weekDate = new Date(weekDateStr);
      } else {
        const latestWeek = await prisma.weeklyData.findFirst({
          orderBy: { weekDate: 'desc' }
        });
        if (!latestWeek) {
          return NextResponse.json({
            success: false,
            error: '暂无数据'
          }, { status: 404 });
        }
        weekDate = new Date(latestWeek.weekDate);
      }
      
      const momentumRecords = await prisma.momentumHistory.findMany({
        where: { weekDate },
        orderBy: { score: 'desc' }
      });
      
      if (format === 'json') {
        return NextResponse.json({
          success: true,
          data: momentumRecords
        });
      }
      
      // CSV格式
      const headers = ['排名', '行业', '动量分值', '上榜数量', '成分总数'];
      const rows = momentumRecords.map(r => [
        r.rank?.toString() || '',
        r.industry,
        r.score.toFixed(2),
        r.count.toString(),
        r.total.toString()
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="momentum_${formatDate(weekDate)}.csv"`
        }
      });
    }
    
    if (type === 'stocks') {
      // 导出股票数据
      let weekDate: Date;
      if (weekDateStr) {
        weekDate = new Date(weekDateStr);
      } else {
        const latestWeek = await prisma.weeklyData.findFirst({
          orderBy: { weekDate: 'desc' }
        });
        if (!latestWeek) {
          return NextResponse.json({
            success: false,
            error: '暂无数据'
          }, { status: 404 });
        }
        weekDate = new Date(latestWeek.weekDate);
      }
      
      const weeklyData = await prisma.weeklyData.findFirst({
        where: { weekDate }
      });
      
      if (!weeklyData) {
        return NextResponse.json({
          success: false,
          error: '未找到数据'
        }, { status: 404 });
      }
      
      const stocks = weeklyData.stocks as StockData[];
      
      if (format === 'json') {
        return NextResponse.json({
          success: true,
          data: stocks
        });
      }
      
      // CSV格式
      const headers = ['股票代码', '股票简称', '近20日涨跌幅(%)', '所属行业', '二级行业'];
      const rows = stocks.map(s => [
        s.code,
        s.name,
        s.change.toFixed(2),
        s.industry,
        s.industryLevel2
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="stocks_${formatDate(weekDate)}.csv"`
        }
      });
    }
    
    if (type === 'history') {
      // 导出动量历史数据
      const momentumHistory = await prisma.momentumHistory.findMany({
        orderBy: [
          { weekDate: 'desc' },
          { score: 'desc' }
        ],
        take: 1000
      });
      
      if (format === 'json') {
        return NextResponse.json({
          success: true,
          data: momentumHistory
        });
      }
      
      // CSV格式
      const headers = ['日期', '排名', '行业', '动量分值', '上榜数量', '成分总数'];
      const rows = momentumHistory.map(r => [
        formatDate(new Date(r.weekDate)),
        r.rank?.toString() || '',
        r.industry,
        r.score.toFixed(2),
        r.count.toString(),
        r.total.toString()
      ]);
      
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="momentum_history.csv"'
        }
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: '无效的导出类型' 
    }, { status: 400 });
  } catch (error) {
    console.error('导出数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '导出失败' 
    }, { status: 500 });
  }
}
