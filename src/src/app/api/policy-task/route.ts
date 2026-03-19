import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 任务状态存储（简化版，实际生产应使用数据库）
// 使用全局变量存储，确保多个请求间共享
declare global {
  var policyTaskState: {
    batchId: string | null
    status: string
    totalTasks: number
    completedTasks: number
    failedTasks: number
    currentIndustry: string | null
    progress: number
    paused: boolean
    error: string | null
    industries: string[]
    currentIndex: number
    startTime: number | null
  }
}

// 初始化全局状态
if (!globalThis.policyTaskState) {
  globalThis.policyTaskState = {
    batchId: null,
    status: 'idle',
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    currentIndustry: null,
    progress: 0,
    paused: false,
    error: null,
    industries: [],
    currentIndex: 0,
    startTime: null
  }
}

const taskState = globalThis.policyTaskState

// GET - 获取任务状态
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const batchId = searchParams.get('batchId')
  
  if (batchId && taskState.batchId !== batchId) {
    return NextResponse.json({ success: false, hasTask: false })
  }
  
  if (!taskState.batchId) {
    return NextResponse.json({ success: true, hasTask: false })
  }
  
  return NextResponse.json({
    success: true,
    hasTask: true,
    batchId: taskState.batchId,
    progress: {
      status: taskState.status,
      totalTasks: taskState.totalTasks,
      completedTasks: taskState.completedTasks,
      failedTasks: taskState.failedTasks,
      currentIndustry: taskState.currentIndustry,
      progress: taskState.progress,
      error: taskState.error,
      paused: taskState.paused,
      startTime: taskState.startTime,
      batchId: taskState.batchId
    }
  })
}

// POST - 启动/暂停/恢复任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, batchId } = body
    
    if (action === 'start') {
      // 获取需要更新的行业列表
      let industries: string[] = []
      
      try {
        const momentumData = await prisma.momentumHistory.findMany({
          where: { 
            weekDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } 
          },
          select: { industry: true },
          distinct: ['industry']
        })
        
        industries = [...new Set(momentumData.map(m => m.industry))]
        console.log(`找到 ${industries.length} 个行业需要更新`)
      } catch (dbError: any) {
        console.error('数据库查询失败:', dbError)
        return NextResponse.json({
          success: false,
          error: `数据库查询失败: ${dbError.message}`
        }, { status: 500 })
      }
      
      if (industries.length === 0) {
        return NextResponse.json({
          success: false,
          error: '没有找到需要更新的行业，请先上传动量数据'
        }, { status: 400 })
      }
      
      const newBatchId = `batch_${Date.now()}`
      
      // 重置状态
      taskState.batchId = newBatchId
      taskState.status = 'running'
      taskState.totalTasks = industries.length
      taskState.completedTasks = 0
      taskState.failedTasks = 0
      taskState.currentIndustry = null
      taskState.progress = 0
      taskState.paused = false
      taskState.error = null
      taskState.industries = industries
      taskState.currentIndex = 0
      taskState.startTime = Date.now()
      
      return NextResponse.json({
        success: true,
        batchId: newBatchId,
        message: `已创建 ${industries.length} 个行业的政策抓取任务`,
        totalTasks: industries.length
      })
    }
    
    if (action === 'pause') {
      if (taskState.batchId === batchId) {
        taskState.paused = true
        taskState.status = 'paused'
      }
      return NextResponse.json({ success: true, message: '任务已暂停' })
    }
    
    if (action === 'resume') {
      if (taskState.batchId === batchId) {
        taskState.paused = false
        taskState.status = 'running'
      }
      return NextResponse.json({ success: true, message: '任务已恢复' })
    }
    
    if (action === 'calculate') {
      // 手动计算评分
      try {
        const policies = await (prisma as any).policyEvent?.findMany({
          where: {
            publishDate: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
          }
        })
        
        return NextResponse.json({
          success: true,
          message: `已处理 ${policies?.length || 0} 条政策数据`
        })
      } catch (e: any) {
        return NextResponse.json({
          success: false,
          error: `计算评分失败: ${e.message}`
        }, { status: 500 })
      }
    }
    
    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 })
    
  } catch (error: any) {
    console.error('Policy task error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '操作失败'
    }, { status: 500 })
  }
}

// 导出任务状态供worker使用
export { taskState }
