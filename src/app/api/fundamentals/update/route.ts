import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

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
      // Windows上通常是 'python' 或 'python3'
      // Mac/Linux上通常是 'python3'
      venvPython = process.platform === 'win32' ? 'python' : 'python3'
    }
    
    let command = `${venvPython} ${scriptPath}`
    
    if (codes && Array.isArray(codes) && codes.length > 0) {
      command += ` --codes ${codes.join(' ')}`
    } else if (mode === 'top') {
      command += ` --top --limit ${limit}`
    } else if (mode === 'all') {
      command += ` --all --limit ${limit}`
    } else {
      command += ` --limit ${limit}`
    }
    
    console.log('执行命令:', command)
    
    // 异步执行，设置超时
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 300000, // 5分钟超时
        maxBuffer: 1024 * 1024 * 10 // 10MB buffer
      })
      
      console.log('stdout:', stdout.slice(-500))
      if (stderr) console.log('stderr:', stderr)
      
      return NextResponse.json({
        success: true,
        message: '基本面数据更新完成',
        output: stdout.slice(-500),
        error: stderr ? stderr.slice(-200) : null
      })
      
    } catch (execError: any) {
      console.error('执行错误:', execError)
      
      // 解析错误信息
      let errorMsg = execError.message || '执行失败'
      
      // 如果是命令不存在
      if (execError.code === 'ENOENT') {
        errorMsg = '命令或脚本不存在'
      }
      
      return NextResponse.json({
        success: false,
        error: errorMsg,
        details: execError.stderr || null
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

// 获取更新状态
export async function GET(request: NextRequest) {
  try {
    const { PrismaClient } = await import('@prisma/client')
    const prisma = new PrismaClient()
    
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
    
    await prisma.$disconnect()
    
    return NextResponse.json({
      success: true,
      totalCount,
      recentUpdates
    })
    
  } catch (error: any) {
    console.error('Get fundamentals status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
