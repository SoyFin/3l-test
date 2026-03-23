import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { v4 as uuidv4 } from 'uuid'

// 任务状态接口定义
interface TaskProgress {
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

// GET - 获取任务状态（从数据库读取）
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const batchId = searchParams.get('batchId')
    
    if (!batchId) {
      // 获取最新的活动任务
      const latestTask = await prisma.policyTask.findFirst({
        where: { status: { not: 'completed' } },
        orderBy: { createdAt: 'desc' }
      })
      
      if (!latestTask) {
        return NextResponse.json({ success: true, hasTask: false })
      }
      
      return NextResponse.json({
        success: true,
        hasTask: true,
        batchId: latestTask.batchId,
        progress: {
          status: latestTask.status,
          totalTasks: latestTask.totalTasks,
          completedTasks: latestTask.completedTasks,
          failedTasks: latestTask.failedTasks,
          currentIndustry: latestTask.currentIndustry,
          progress: latestTask.progress,
          error: latestTask.error,
          paused: latestTask.paused,
          startTime: latestTask.startTime?.getTime() || null,
          batchId: latestTask.batchId
        }
      })
    }
    
    // 根据batchId查询任务
    const task = await prisma.policyTask.findUnique({
      where: { batchId }
    })
    
    if (!task) {
      return NextResponse.json({ success: false, hasTask: false, error: '任务不存在' })
    }
    
    return NextResponse.json({
      success: true,
      hasTask: true,
      batchId: task.batchId,
      progress: {
        status: task.status,
        totalTasks: task.totalTasks,
        completedTasks: task.completedTasks,
        failedTasks: task.failedTasks,
        currentIndustry: task.currentIndustry,
        progress: task.progress,
        error: task.error,
        paused: task.paused,
        startTime: task.startTime?.getTime() || null,
        batchId: task.batchId
      }
    })
  } catch (error: any) {
    console.error('Get task status error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || '获取任务状态失败'
    }, { status: 500 })
  }
}

// POST - 启动/暂停/恢复任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, batchId } = body
    
    if (action === 'start') {
      // 检查是否有正在运行的任务
      const runningTask = await prisma.policyTask.findFirst({
        where: { status: 'running' }
      })
      
      if (runningTask) {
        return NextResponse.json({
          success: false,
          error: '已有任务正在运行，请等待完成或暂停后再试'
        }, { status: 400 })
      }
      
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
      
      // 使用UUID生成批次ID，避免高并发下的重复
      const newBatchId = `batch_${uuidv4()}`
      
      // 创建任务记录到数据库
      const task = await prisma.policyTask.create({
        data: {
          batchId: newBatchId,
          status: 'running',
          totalTasks: industries.length,
          completedTasks: 0,
          failedTasks: 0,
          currentIndustry: null,
          progress: 0,
          paused: false,
          error: null,
          industries: industries,
          currentIndex: 0,
          startTime: new Date()
        }
      })
      
      return NextResponse.json({
        success: true,
        batchId: newBatchId,
        message: `已创建 ${industries.length} 个行业的政策抓取任务`,
        totalTasks: industries.length
      })
    }
    
    if (action === 'pause') {
      const task = await prisma.policyTask.findUnique({
        where: { batchId }
      })
      
      if (!task) {
        return NextResponse.json({ 
          success: false, 
          error: '任务不存在' 
        }, { status: 404 })
      }
      
      await prisma.policyTask.update({
        where: { batchId },
        data: { 
          paused: true, 
          status: 'paused' 
        }
      })
      
      return NextResponse.json({ success: true, message: '任务已暂停' })
    }
    
    if (action === 'resume') {
      const task = await prisma.policyTask.findUnique({
        where: { batchId }
      })
      
      if (!task) {
        return NextResponse.json({ 
          success: false, 
          error: '任务不存在' 
        }, { status: 404 })
      }
      
      await prisma.policyTask.update({
        where: { batchId },
        data: { 
          paused: false, 
          status: 'running' 
        }
      })
      
      return NextResponse.json({ success: true, message: '任务已恢复' })
    }
    
    if (action === 'calculate') {
      // 手动计算评分
      try {
        // 安全检查表是否存在
        const policies = await prisma.$queryRaw`
          SELECT * FROM PolicyEvent 
          WHERE publishDate >= datetime('now', '-30 days')
        `
        
        return NextResponse.json({
          success: true,
          message: `已处理 ${(policies as any[])?.length || 0} 条政策数据`
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

// 辅助函数：更新任务进度（供worker调用）
export async function updateTaskProgress(batchId: string, updates: Partial<TaskProgress>) {
  return prisma.policyTask.update({
    where: { batchId },
    data: updates
  })
}

// 辅助函数：获取任务信息（供worker调用）
export async function getTaskByBatchId(batchId: string) {
  return prisma.policyTask.findUnique({
    where: { batchId }
  })
}
