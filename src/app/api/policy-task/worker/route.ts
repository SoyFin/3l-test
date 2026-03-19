import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// 引入共享的任务状态
import { taskState } from '../route'

// 模拟政策数据抓取
async function fetchPolicyForIndustry(industry: string): Promise<{ title: string; date: string; importance: number }[]> {
  // 模拟API调用延迟
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // 返回模拟数据（实际应该调用真实的政策API）
  const mockPolicies = [
    { title: `${industry}发展政策支持`, date: new Date().toISOString().split('T')[0], importance: 3 },
    { title: `关于推动${industry}高质量发展的指导意见`, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], importance: 2 }
  ]
  
  return mockPolicies
}

// POST - 处理下一个任务
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchId } = body
    
    // 验证批次ID
    if (taskState.batchId !== batchId) {
      return NextResponse.json({
        success: false,
        error: '无效的批次ID',
        status: 'failed'
      })
    }
    
    // 检查是否暂停
    if (taskState.paused) {
      return NextResponse.json({
        success: false,
        needWait: false,
        status: 'paused',
        message: '任务已暂停'
      })
    }
    
    // 检查是否已完成
    if (taskState.currentIndex >= taskState.industries.length) {
      taskState.status = 'completed'
      taskState.progress = 100
      return NextResponse.json({
        success: true,
        needWait: false,
        status: 'completed',
        message: '所有任务已完成'
      })
    }
    
    // 获取当前要处理的行业
    const currentIndustry = taskState.industries[taskState.currentIndex]
    taskState.currentIndustry = currentIndustry
    
    console.log(`处理行业 ${taskState.currentIndex + 1}/${taskState.totalTasks}: ${currentIndustry}`)
    
    try {
      // 抓取政策数据
      const policies = await fetchPolicyForIndustry(currentIndustry)
      
      // 保存到数据库
      for (const policy of policies) {
        try {
          await (prisma as any).policyEvent?.create({
            data: {
              industry: currentIndustry,
              title: policy.title,
              publishDate: new Date(policy.date),
              importance: policy.importance,
              source: '系统抓取',
              createdAt: new Date()
            }
          })
        } catch (saveError: any) {
          // 忽略重复记录错误
          if (!saveError.message?.includes('Unique constraint')) {
            console.error('保存政策失败:', saveError)
          }
        }
      }
      
      // 更新进度
      taskState.currentIndex++
      taskState.completedTasks++
      taskState.progress = Math.round((taskState.currentIndex / taskState.totalTasks) * 100)
      
      // 检查是否全部完成
      if (taskState.currentIndex >= taskState.industries.length) {
        taskState.status = 'completed'
        taskState.progress = 100
        taskState.currentIndustry = null
        
        return NextResponse.json({
          success: true,
          needWait: false,
          status: 'completed',
          message: `已完成 ${taskState.completedTasks} 个行业的政策数据更新`
        })
      }
      
      // 返回继续等待信号
      return NextResponse.json({
        success: true,
        needWait: true,
        waitMs: 1000, // 等待1秒后继续
        status: 'running',
        currentIndustry,
        progress: taskState.progress
      })
      
    } catch (processError: any) {
      console.error(`处理行业 ${currentIndustry} 失败:`, processError)
      
      taskState.failedTasks++
      taskState.currentIndex++
      taskState.error = `处理 ${currentIndustry} 失败: ${processError.message}`
      
      // 继续下一个
      if (taskState.currentIndex >= taskState.industries.length) {
        taskState.status = 'completed'
        return NextResponse.json({
          success: true,
          needWait: false,
          status: 'completed',
          message: `完成，${taskState.failedTasks} 个失败`,
          error: taskState.error
        })
      }
      
      return NextResponse.json({
        success: true,
        needWait: true,
        waitMs: 500,
        status: 'running',
        error: taskState.error
      })
    }
    
  } catch (error: any) {
    console.error('Worker error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      status: 'failed'
    }, { status: 500 })
  }
}
