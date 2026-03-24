import { NextRequest, NextResponse } from 'next/server'

const AGENT_SERVICE_URL = process.env.AGENT_SERVICE_URL || 'http://localhost:8001'

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
  'technical_analyst': 'technical_analysis',
  'fundamentals': 'fundamental_analysis',
  'sentiment': 'sentiment_analysis',
  'valuation': 'valuation_analysis',
  'researcher_bull': 'bull_researcher',
  'researcher_bear': 'bear_researcher',
  'debate_room': 'debate_room',
  'risk_manager': 'risk_management',
  'portfolio_management': 'portfolio_management',
  'technical_analysis': 'technical_analysis',
  'fundamental_analysis': 'fundamental_analysis',
  'sentiment_analysis': 'sentiment_analysis',
  'valuation_analysis': 'valuation_analysis',
  'bull_researcher': 'bull_researcher',
  'bear_researcher': 'bear_researcher',
  'risk_management': 'risk_management',
}

const SIGNAL_TO_ACTION: Record<string, string> = {
  'bullish': 'buy',
  'bearish': 'sell',
  'neutral': 'hold',
}

function parseRawResponse(rawResponse: string): any {
  if (!rawResponse) return null
  
  // Remove markdown code blocks if present
  let cleaned = rawResponse.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()
  
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.error('Failed to parse raw_response:', e)
    return null
  }
}

function normalizeConfidence(confidence: any): number {
  if (typeof confidence === 'number') {
    return confidence > 1 ? confidence / 100 : confidence
  }
  if (typeof confidence === 'string') {
    const cleaned = confidence.replace('%', '').trim()
    const num = parseFloat(cleaned)
    if (!isNaN(num)) {
      return num > 1 ? num / 100 : num
    }
  }
  return 0.5
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
        error: 'Missing taskId parameter'
      }, { status: 400 })
    }

    console.log(`[结果API] 调用后端: ${AGENT_SERVICE_URL}/api/analysis/result/${taskId}`)
    const response = await fetch(`${AGENT_SERVICE_URL}/api/analysis/result/${taskId}`)

    console.log(`[结果API] 后端响应状态: ${response.status}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[结果API] 后端错误: ${errorText}`)
      // 传递实际的状态码（如404）
      return NextResponse.json({
        success: false,
        error: response.status === 404 ? '任务不存在' : `后端错误: ${response.status}`
      }, { status: response.status })
    }

    const data = await response.json()
    console.log(`[结果API] 后端返回数据:`, JSON.stringify(data, null, 2).slice(0, 500))
    
    // 提取最终数据
    const finalDecision = data.decision || data.final_decision
    const agentSignals = data.agent_signals || []
    const agentResults = data.agent_results || {}
    
    // 构建 agent_signals 列表
    let processedSignals: any[] = []
    
    // 优先使用已有的 agent_signals
    if (agentSignals && Array.isArray(agentSignals) && agentSignals.length > 0) {
      processedSignals = agentSignals.map((signal: any) => {
        const mappedName = AGENT_NAME_MAP[signal.agent_name] || signal.agent_name || signal.agent
        return {
          agent_name: mappedName,
          agent: mappedName,
          signal: signal.signal || 'neutral',
          confidence: normalizeConfidence(signal.confidence),
          summary: signal.summary || signal.reasoning || '',
          reasoning: signal.reasoning || signal.summary || ''
        }
      })
    }
    // 如果没有 agent_signals，从 agent_results 构建
    else if (agentResults && Object.keys(agentResults).length > 0) {
      processedSignals = Object.entries(agentResults).map(([agentName, result]: [string, any]) => {
        const mappedName = AGENT_NAME_MAP[agentName] || agentName
        return {
          agent_name: mappedName,
          agent: mappedName,
          signal: result?.signal || 'neutral',
          confidence: normalizeConfidence(result?.confidence),
          summary: result?.summary || result?.reasoning || '',
          reasoning: result?.reasoning || result?.summary || ''
        }
      })
    }
    
    // 确保所有必需的 agent 都在列表中
    const requiredAgents = [
      'technical_analysis', 
      'fundamental_analysis', 
      'sentiment_analysis', 
      'valuation_analysis',
      'bull_researcher',
      'bear_researcher',
      'debate_room',
      'risk_management'
    ]
    
    const existingAgents = new Set(processedSignals.map(s => s.agent_name))
    for (const requiredAgent of requiredAgents) {
      if (!existingAgents.has(requiredAgent)) {
        // 尝试从 agentResults 中查找
        const foundResult = Object.entries(agentResults).find(([name]) => 
          AGENT_NAME_MAP[name] === requiredAgent || name === requiredAgent
        )
        
        if (foundResult) {
          const [, result] = foundResult
          processedSignals.push({
            agent_name: requiredAgent,
            agent: requiredAgent,
            signal: result?.signal || 'neutral',
            confidence: normalizeConfidence(result?.confidence),
            summary: result?.summary || result?.reasoning || '',
            reasoning: result?.reasoning || result?.summary || ''
          })
        }
      }
    }
    
    // 处理 decision
    let decision = finalDecision
    
    // 如果 decision 有 raw_response，解析它
    if (decision && decision.raw_response) {
      const parsedDecision = parseRawResponse(decision.raw_response)
      if (parsedDecision) {
        decision = parsedDecision
      }
    }
    
    // 确保 decision 格式正确
    if (decision) {
      // 转换 action
      let action = (decision.action || 'hold').toLowerCase()
      if (action === 'bullish') action = 'buy'
      if (action === 'bearish') action = 'sell'
      
      // 标准化 confidence
      const confidence = normalizeConfidence(decision.confidence)
      
      // 如果 decision 中有 agent_signals 且我们还没处理，合并它们
      if (decision.agent_signals && Array.isArray(decision.agent_signals) && processedSignals.length === 0) {
        processedSignals = decision.agent_signals.map((signal: any) => {
          const mappedName = AGENT_NAME_MAP[signal.agent_name] || signal.agent_name || signal.agent
          return {
            agent_name: mappedName,
            agent: mappedName,
            signal: signal.signal || 'neutral',
            confidence: normalizeConfidence(signal.confidence),
            summary: signal.summary || signal.reasoning || '',
            reasoning: signal.reasoning || signal.summary || ''
          }
        })
      }
      
      const transformedDecision = {
        action: action,
        confidence: confidence,
        reasoning: decision.reasoning || '',
        agent_signals: processedSignals,
        risk_assessment: decision.risk_assessment || null
      }
      
      return NextResponse.json({
        success: true,
        decision: transformedDecision,
        stock_code: data.stock_code || data.ticker,
        stock_name: data.stock_name || '',
        run_id: data.run_id || taskId
      })
    }
    
    // 如果没有 decision，返回原始数据
    return NextResponse.json({
      success: true,
      data: data
    })

  } catch (error: any) {
    console.error('Get result failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
