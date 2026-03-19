import { NextRequest, NextResponse } from 'next/server'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001'

// Agent名称映射 - 后端名称到前端名称
const AGENT_NAME_MAP: Record<string, string> = {
  'technical_analyst_agent': 'technical_analysis',
  'fundamentals_agent': 'fundamental_analysis',
  'sentiment_agent': 'sentiment_analysis',
  'valuation_agent': 'valuation_analysis',
  'researcher_bull_agent': 'bull_researcher',
  'researcher_bear_agent': 'bear_researcher',
  'debate_room_agent': 'debate_room',
  'risk_management_agent': 'risk_management',
  'portfolio_management_agent': 'portfolio_management',
  'market_data_agent': 'market_data',
  'macro_analyst_agent': 'macro_analysis',
  'macro_news_agent': 'macro_news'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params

    if (!taskId) {
      return NextResponse.json({
        success: false,
        error: '缺少taskId参数'
      }, { status: 400 })
    }

    const response = await fetch(`${AGENT_SERVICE_URL}/api/analysis/result/${taskId}`)

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: '获取结果失败'
      }, { status: 500 })
    }

    const data = await response.json()

    // 处理Agent信号名称映射
    if (data.decision && data.decision.agent_signals) {
      data.decision.agent_signals = data.decision.agent_signals.map((signal: any) => ({
        ...signal,
        agent_name: AGENT_NAME_MAP[signal.agent_name] || signal.agent_name
      }))
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('获取结果失败:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}