import { NextRequest, NextResponse } from 'next/server'

/**
 * AI API 测试接口
 * 测试各AI平台的API Key是否有效
 */

// 智谱AI测试
async function testZhipu(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'glm-4-flash',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error?.message || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 阿里云通义千问测试
async function testAliyun(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'qwen-turbo',
        input: { messages: [{ role: 'user', content: 'Hi' }] },
        parameters: { max_tokens: 10 }
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.message || error.code || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 字节跳动豆包测试
async function testByteDance(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'doubao-pro-32k',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error?.message || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

// 腾讯混元测试
async function testTencent(apiKey: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://hunyuan.tencentcloudapi.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'hunyuan-lite',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      })
    })

    if (!response.ok) {
      const error = await response.json()
      return { success: false, error: error.error?.message || `HTTP ${response.status}` }
    }

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { provider, apiKey } = body

    if (!provider || !apiKey) {
      return NextResponse.json({
        success: false,
        error: '缺少必要参数'
      }, { status: 400 })
    }

    let result: { success: boolean; error?: string }

    switch (provider) {
      case 'zhipu':
        result = await testZhipu(apiKey)
        break
      case 'aliyun':
        result = await testAliyun(apiKey)
        break
      case 'byteDance':
        result = await testByteDance(apiKey)
        break
      case 'tencent':
        result = await testTencent(apiKey)
        break
      default:
        return NextResponse.json({
          success: false,
          error: `不支持的AI平台: ${provider}`
        }, { status: 400 })
    }

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('AI测试错误:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '测试失败'
    }, { status: 500 })
  }
}