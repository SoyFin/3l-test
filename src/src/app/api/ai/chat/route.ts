import { NextRequest, NextResponse } from 'next/server'

/**
 * AI聊天API - 统一入口
 * 支持 OpenAI 格式的聊天完成API
 * 用于 agent-service 的 LLM 客户端调用
 */

// 支持的AI提供商配置
const AI_PROVIDERS: Record<string, { baseUrl: string; defaultModel: string }> = {
  zhipu: {
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-flash'
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-turbo'
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat'
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    defaultModel: 'moonshot-v1-8k'
  },
  hunyuan: {
    baseUrl: 'https://api.hunyuan.cloud.tencent.com/v1',
    defaultModel: 'hunyuan-lite'
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { messages, model, provider: requestedProvider, config, stream = false } = body

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({
        success: false,
        error: 'messages 参数必须是数组'
      }, { status: 400 })
    }

    // 确定使用的提供商
    let provider = requestedProvider || config?.defaultProvider || 'zhipu'
    
    // 获取API Key
    let apiKey: string | undefined
    if (config?.providers?.[provider]?.apiKey) {
      apiKey = config.providers[provider].apiKey
    } else {
      // 从环境变量获取
      const envKeyMap: Record<string, string> = {
        zhipu: 'ZHIPU_API_KEY',
        qwen: 'QWEN_API_KEY',
        deepseek: 'DEEPSEEK_API_KEY',
        kimi: 'KIMI_API_KEY',
        hunyuan: 'HUNYUAN_API_KEY'
      }
      apiKey = process.env[envKeyMap[provider]]
    }

    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: `未配置 ${provider} 的 API Key`
      }, { status: 400 })
    }

    // 获取提供商配置
    const providerConfig = AI_PROVIDERS[provider]
    if (!providerConfig) {
      return NextResponse.json({
        success: false,
        error: `不支持的AI提供商: ${provider}`
      }, { status: 400 })
    }

    // 构建请求
    const requestBody = {
      model: model || providerConfig.defaultModel,
      messages: messages.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      })),
      temperature: body.temperature ?? 0.7,
      max_tokens: body.max_tokens ?? 4096,
      stream
    }

    console.log(`[AI Chat] 使用 ${provider} (${requestBody.model})`)

    // 调用AI API
    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[AI Chat] ${provider} API 错误:`, errorText)
      return NextResponse.json({
        success: false,
        error: `${provider} API 调用失败: ${response.status}`
      }, { status: 500 })
    }

    if (stream) {
      // 流式响应
      return new Response(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      })
    }

    // 非流式响应
    const data = await response.json()
    
    // 统一返回格式（OpenAI格式）
    return NextResponse.json({
      success: true,
      id: data.id,
      object: data.object,
      created: data.created,
      model: data.model,
      choices: data.choices,
      usage: data.usage
    })

  } catch (error: any) {
    console.error('[AI Chat] 错误:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '服务器错误'
    }, { status: 500 })
  }
}

// 获取支持的提供商列表
export async function GET() {
  return NextResponse.json({
    success: true,
    providers: Object.keys(AI_PROVIDERS).map(key => ({
      id: key,
      name: key.charAt(0).toUpperCase() + key.slice(1),
      defaultModel: AI_PROVIDERS[key].defaultModel
    }))
  })
}
