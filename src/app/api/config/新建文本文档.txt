import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { formatDate } from '@/lib/data-parser';

// 获取系统配置
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const key = searchParams.get('key');
    
    if (key) {
      const config = await prisma.systemConfig.findUnique({
        where: { key }
      });
      
      return NextResponse.json({
        success: true,
        data: config?.value || null
      });
    }
    
    // 获取系统状态
    const latestWeekly = await prisma.weeklyData.findFirst({
      orderBy: { weekDate: 'desc' }
    });
    
    const latestAllStocks = await prisma.allStocks.findFirst({
      orderBy: { updateDate: 'desc' }
    });
    
    const totalWeeklyRecords = await prisma.weeklyData.count();
    const totalMomentumRecords = await prisma.momentumHistory.count();
    
    // 计算是否需要提醒上传
    const now = new Date();
    const friday = new Date(now);
    const day = friday.getDay();
    const diff = day <= 5 ? 5 - day : 5 - day + 7;
    friday.setDate(friday.getDate() + diff);
    friday.setHours(0, 0, 0, 0);
    
    let weeklyUploadReminder = false;
    if (latestWeekly) {
      const lastUploadDate = new Date(latestWeekly.weekDate);
      const daysDiff = Math.floor((friday.getTime() - lastUploadDate.getTime()) / (1000 * 60 * 60 * 24));
      weeklyUploadReminder = daysDiff >= 7;
    } else {
      weeklyUploadReminder = true;
    }
    
    // 季度末提醒
    const month = now.getMonth() + 1;
    const isQuarterEnd = [3, 6, 9, 12].includes(month);
    const quarterEndDay = new Date(now.getFullYear(), month, 0).getDate();
    const isNearQuarterEnd = isQuarterEnd && (now.getDate() >= quarterEndDay - 10);
    
    let quarterlyUploadReminder = false;
    if (latestAllStocks) {
      const lastUpdate = new Date(latestAllStocks.updateDate);
      const daysDiff = Math.floor((now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24));
      quarterlyUploadReminder = isNearQuarterEnd && daysDiff > 30;
    } else {
      quarterlyUploadReminder = isNearQuarterEnd;
    }
    
    return NextResponse.json({
      success: true,
      data: {
        latestWeeklyDate: latestWeekly ? formatDate(new Date(latestWeekly.weekDate)) : null,
        latestAllStocksDate: latestAllStocks ? formatDate(new Date(latestAllStocks.updateDate)) : null,
        totalWeeklyRecords,
        totalMomentumRecords,
        weeklyUploadReminder,
        quarterlyUploadReminder,
        currentFriday: formatDate(friday)
      }
    });
  } catch (error) {
    console.error('获取配置失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

// 更新系统配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value } = body;
    
    if (!key) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少配置键' 
      }, { status: 400 });
    }
    
    const config = await prisma.systemConfig.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });
    
    return NextResponse.json({
      success: true,
      data: config
    });
  } catch (error) {
    console.error('更新配置失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}
