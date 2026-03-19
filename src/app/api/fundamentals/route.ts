import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// 获取基本面数据
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const codes = searchParams.get('codes');
    
    if (code) {
      // 获取单个股票基本面
      const fundamental = await prisma.fundamentals.findUnique({
        where: { code }
      });
      
      if (!fundamental) {
        // 如果数据库中没有，可以尝试从外部API获取
        // 这里暂时返回基本信息
        return NextResponse.json({
          success: true,
          data: {
            code,
            name: '',
            tags: []
          },
          message: '暂无基本面数据'
        });
      }
      
      return NextResponse.json({
        success: true,
        data: fundamental
      });
    }
    
    if (codes) {
      // 批量获取多个股票基本面
      const codeList = codes.split(',').filter(Boolean);
      const fundamentals = await prisma.fundamentals.findMany({
        where: {
          code: { in: codeList }
        }
      });
      
      return NextResponse.json({
        success: true,
        data: fundamentals
      });
    }
    
    // 获取所有基本面数据
    const fundamentals = await prisma.fundamentals.findMany({
      take: 100
    });
    
    return NextResponse.json({
      success: true,
      data: fundamentals
    });
  } catch (error) {
    console.error('获取基本面数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '获取失败' 
    }, { status: 500 });
  }
}

// 更新基本面数据
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, ...data } = body;
    
    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: '缺少股票代码' 
      }, { status: 400 });
    }
    
    const fundamental = await prisma.fundamentals.upsert({
      where: { code },
      create: {
        code,
        ...data,
        updatedAt: new Date()
      },
      update: {
        ...data,
        updatedAt: new Date()
      }
    });
    
    return NextResponse.json({
      success: true,
      data: fundamental
    });
  } catch (error) {
    console.error('更新基本面数据失败:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : '更新失败' 
    }, { status: 500 });
  }
}
