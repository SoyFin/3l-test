import { NextRequest, NextResponse } from 'next/server'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001'

/**
 * 代理后端 Agent 服务的 LLM 配置接口
 * 前端 -> Next.js API -> 后端 Agent 服务
 */

// 获取配置
export async function GET() {
  try {
    const response = await fetch(`${AGENT_SERVICE_URL}/config/llm`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: '获取配置失败'
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('获取LLM配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// 更新配置
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const response = await fetch(`${AGENT_SERVICE_URL}/config/llm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Agent服务配置错误:', error)
      return NextResponse.json({
        success: false,
        error: '配置同步失败'
      }, { status: 500 })
    }

    const data = await response.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('同步LLM配置失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}