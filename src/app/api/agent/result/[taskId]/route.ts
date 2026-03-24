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
  'technical_analysis': 'technical_analysis',
  'fundamental_analysis': 'fundamental_analysis',
  'sentiment_analysis': 'sentiment_analysis',
  'valuation_analysis': 'valuation_analysis',
  'bull_researcher': 'bull_researcher',
  'bear_researcher': 'bear_researcher',
  'debate_room': 'debate_room',
  'risk_management': 'risk_management',
  'portfolio_management': 'portfolio_management',
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

    const response = await fetch(`${AGENT_SERVICE_URL}/api/analysis/result/${taskId}`)

    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: 'Failed to get result'
      }, { status: 500 })
    }

    const data = await response.json()
    
    // Handle decision from raw_response (new format)
    if (data.decision && data.decision.raw_response) {
      const parsedDecision = parseRawResponse(data.decision.raw_response)
      
      if (parsedDecision) {
        // Ensure action is in correct format
        let action = (parsedDecision.action || 'hold').toLowerCase()
        
        // Ensure confidence is a number between 0 and 1
        let confidence = parsedDecision.confidence
        if (typeof confidence === 'string') {
          confidence = parseFloat(confidence.replace('%', '')) / 100
        }
        if (typeof confidence !== 'number' || isNaN(confidence)) {
          confidence = 0.5
        }
        
        // Map agent names in agent_signals
        const agent_signals = (parsedDecision.agent_signals || []).map((signal: any) => ({
          ...signal,
          agent_name: AGENT_NAME_MAP[signal.agent_name] || signal.agent_name,
          agent: AGENT_NAME_MAP[signal.agent_name] || signal.agent_name,
          action: SIGNAL_TO_ACTION[signal.signal] || 'hold'
        }))
        
        const transformedDecision = {
          action: action,
          confidence: confidence,
          reasoning: parsedDecision.reasoning || data.reasoning || '',
          agent_signals: agent_signals
        }
        
        return NextResponse.json({
          success: true,
          decision: transformedDecision,
          stock_code: data.stock_code,
          stock_name: data.stock_name,
          run_id: data.run_id
        })
      }
    }
    
    // Handle final_decision format (old format)
    if (data.final_decision) {
      const decision = data.final_decision
      
      let action = decision.action
      if (!action && decision.signal) {
        action = SIGNAL_TO_ACTION[decision.signal] || 'hold'
      }
      if (!action) {
        action = 'hold'
      }
      
      let confidence = decision.confidence
      if (typeof confidence === 'string') {
        confidence = parseFloat(confidence.replace('%', '')) / 100
      }
      if (typeof confidence !== 'number' || isNaN(confidence)) {
        confidence = 0.5
      }
      
      let agent_signals = decision.agent_signals || []
      if (agent_signals.length === 0 && data.agent_results) {
        agent_signals = Object.entries(data.agent_results).map(([agentName, result]: [string, any]) => {
          const mappedName = AGENT_NAME_MAP[agentName] || agentName
          return {
            agent_name: mappedName,
            agent: mappedName,
            signal: result?.signal || 'neutral',
            confidence: typeof result?.confidence === 'number' ? result.confidence : 0.5,
            summary: result?.summary || result?.reasoning || '',
            reasoning: result?.reasoning || ''
          }
        })
      } else {
        agent_signals = agent_signals.map((signal: any) => ({
          ...signal,
          agent_name: AGENT_NAME_MAP[signal.agent_name] || signal.agent_name,
          agent: AGENT_NAME_MAP[signal.agent_name] || signal.agent_name,
          action: SIGNAL_TO_ACTION[signal.signal] || 'hold'
        }))
      }
      
      return NextResponse.json({
        success: true,
        decision: {
          action: action.toLowerCase(),
          confidence: confidence,
          reasoning: decision.reasoning || '',
          agent_signals: agent_signals
        },
        agent_results: data.agent_results,
        ticker: data.ticker,
        run_id: data.run_id
      })
    }

    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Get result failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
