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
        stock_code: stock_code,
        stock_name: stock_name || stock_code,
        ticker: stock_code,
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
    console.log('后端返回数据:', JSON.stringify(data, null, 2))

    // 后端返回格式: { task_id: "xxx", status: "pending", ... }
    // 提取任务ID
    const taskId = data.task_id || data.run_id || data.data?.task_id || data.data?.run_id

    if (!taskId) {
      console.error('后端返回数据格式异常，无法提取任务ID:', JSON.stringify(data, null, 2))
      return NextResponse.json({
        success: false,
        error: '未获取到任务ID',
        debug_data: data
      }, { status: 500 })
    }

    console.log('创建分析任务, task_id:', taskId)

    return NextResponse.json({
      success: true,
      task_id: taskId,
      run_id: taskId,
      message: '分析任务已启动'
    })

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
      // 传递实际的状态码（如404）
      return NextResponse.json({
        success: false,
        error: response.status === 404 ? '任务不存在' : '获取状态失败'
      }, { status: response.status })
    }

    const data = await response.json()
    console.log('状态查询返回:', data)

    const status = data.status

    if (status === 'completed') {
      return NextResponse.json({
        success: true,
        status: 'completed',
        task_id: taskId
      })
    }

    if (status === 'failed') {
      return NextResponse.json({
        success: false,
        status: 'failed',
        error: data.error || '分析失败',
        task_id: taskId
      })
    }

    return NextResponse.json({
      success: true,
      status: status || 'running',
      task_id: taskId,
      current_agent: data.current_agent,
      progress: data.progress
    })

  } catch (error: any) {
    console.error('获取状态失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
