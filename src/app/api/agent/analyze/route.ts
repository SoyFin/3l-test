import { NextRequest, NextResponse } from 'next/server'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001'

// 启动分析任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { stock_code, stock_name, modules, force_refresh } = body

    if (!stock_code) {
      return NextResponse.json({
        success: false,
        error: '股票代码不能为空'
      }, { status: 400 })
    }

    // 调用Agent服务
    const response = await fetch(`${AGENT_SERVICE_URL}/api/analysis/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stock_code,
        stock_name: stock_name || stock_code,
        modules: modules || [],
        force_refresh: force_refresh || false
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Agent服务错误:', error)
      return NextResponse.json({
        success: false,
        error: 'Agent服务调用失败'
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('启动分析失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '启动分析失败'
    }, { status: 500 })
  }
}

// 获取任务状态
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少taskId参数'
      }, { status: 400 })
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/analysis/status/${taskId}`)

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: '获取状态失败'
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('获取状态失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}