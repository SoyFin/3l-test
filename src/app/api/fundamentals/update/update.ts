import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { prisma } from '@/lib/db'

// 股票代码验证正则：SH/SZ/BJ + 6位数字，或纯6位数字
const STOCK_CODE_REGEX = /^(SH|SZ|BJ)?\d{6}$/
const MAX_CODES = 100 // 最大允许的股票代码数量

// 验证股票代码格式
function validateStockCodes(codes: string[]): { valid: boolean; error?: string } {
  if (codes.length > MAX_CODES) {
    return { valid: false, error: `一次最多处理${MAX_CODES}个股票代码` }
  }
  
  for (const code of codes) {
    if (!STOCK_CODE_REGEX.test(code)) {
      return { valid: false, error: `无效的股票代码格式: ${code}` }
    }
  }
  
  return { valid: true }
}

// 使用spawn安全执行Python脚本
function executePythonScript(
  pythonPath: string,
  scriptPath: string,
  args: string[]
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const process = spawn(pythonPath, [scriptPath, ...args], {
      timeout: 300000, // 5分钟超时
    })
    
    let stdout = ''
    let stderr = ''
    
    process.stdout.on('data', (data) => {
      stdout += data.toString()
    })
    
    process.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    
    process.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 })
    })
    
    process.on('error', (err) => {
      reject(err)
    })
  })
}

// 触发基本面数据更新
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { codes, mode = 'top', limit = 100 } = body
    
    const fs = require('fs')
    const scriptPath = path.join(process.cwd(), 'scripts/fetch_fundamentals.py')

    // 检查脚本是否存在
    if (!fs.existsSync(scriptPath)) {
      return NextResponse.json({
        success: false,
        error: '脚本文件不存在: ' + scriptPath
      }, { status: 500 })
    }

    // 自动检测Python路径
    let venvPython: string

    // Linux沙盒环境
    const linuxVenv = '/home/z/venv_3l/bin/python'
    if (fs.existsSync(linuxVenv)) {
      venvPython = linuxVenv
    } else {
      // 本地环境 - 使用系统Python
      venvPython = process.platform === 'win32' ? 'python' : 'python3'
    }
    
    // 构建安全的命令参数
    const args: string[] = []
    
    if (codes && Array.isArray(codes) && codes.length > 0) {
      // 验证股票代码格式，防止命令注入
      const validation = validateStockCodes(codes)
      if (!validation.valid) {
        return NextResponse.json({
          success: false,
          error: validation.error
        }, { status: 400 })
      }
      
      args.push('--codes', ...codes)
    } else if (mode === 'top') {
      args.push('--top', '--limit', String(Math.min(limit, 500)))
    } else if (mode === 'all') {
      args.push('--all', '--limit', String(Math.min(limit, 500)))
    } else {
      args.push('--limit', String(Math.min(limit, 500)))
    }
    
    console.log('执行Python脚本:', venvPython, scriptPath, args.join(' '))
    
    try {
      const result = await executePythonScript(venvPython, scriptPath, args)
      
      console.log('stdout:', result.stdout.slice(-500))
      if (result.stderr) console.log('stderr:', result.stderr)
      
      if (result.exitCode !== 0) {
        return NextResponse.json({
          success: false,
          error: '脚本执行失败',
          details: result.stderr || result.stdout.slice(-500)
        }, { status: 500 })
      }
      
      return NextResponse.json({
        success: true,
        message: '基本面数据更新完成',
        output: result.stdout.slice(-500),
        error: result.stderr ? result.stderr.slice(-200) : null
      })
      
    } catch (execError: any) {
      console.error('执行错误:', execError)
      
      let errorMsg = execError.message || '执行失败'
      
      if (execError.code === 'ENOENT') {
        errorMsg = 'Python解释器不存在'
      }
      
      return NextResponse.json({
        success: false,
        error: errorMsg,
        details: null
      }, { status: 500 })
    }
    
  } catch (error: any) {
    console.error('Update fundamentals error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '服务器内部错误'
    }, { status: 500 })
  }
}

// 获取更新状态 - 使用全局prisma实例
export async function GET(request: NextRequest) {
  try {
    // 获取最近更新的基本面数据
    const recentUpdates = await prisma.fundamentals.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        code: true,
        name: true,
        roe: true,
        debtRatio: true,
        tags: true,
        updatedAt: true
      }
    })
    
    // 统计数据
    const totalCount = await prisma.fundamentals.count()
    
    return NextResponse.json({
      success: true,
      totalCount,
      recentUpdates
    })
    
  } catch (error: any) {
    console.error('Get fundamentals status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '获取数据失败'
    }, { status: 500 })
  }
}
