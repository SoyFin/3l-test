// 动量排行项
export interface MomentumRankingItem {
  industry: string
  score: number
  count: number
  total: number
  rank: number
  continuousWeeks: number
  weekDate: string
  color: 'gray' | 'green' | 'orange'
}

// 股票数据
export interface Stock {
  code: string
  name: string
  change: number
  industry: string
  industryLevel2: string
  fundamentals?: Fundamentals | null
}

// 基本面数据
export interface Fundamentals {
  code: string
  name: string
  industry?: string
  revenueGrowth?: number
  profitGrowth?: number
  grossMargin?: number
  roe?: number
  debtRatio?: number
  pe?: number
  pb?: number
  fundHolding?: number
  northHolding?: number
  goodwill?: number
  pledgeRatio?: number
  tags?: string[]
  updatedAt?: string
}

// 行业详情
export interface IndustryDetail {
  industry: string
  score: number
  count: number
  total: number
  rank: number
  weekDate: string
  stocks: Stock[]
  continuousWeeks: number
  trend: TrendPoint[]
}

// 动量趋势
export interface TrendPoint {
  weekDate: string
  score: number
}

// 提醒信息
export interface ReminderInfo {
  weekly: {
    needed: boolean
    message: string
  }
  quarterly: {
    needed: boolean
    message: string
  }
}

// AI提示词模板
export interface PromptTemplate {
  id: string
  title: string
  template: string
  category: 'industry' | 'stock'
}

// 研报平台链接
export interface ResearchPlatform {
  name: string
  icon?: string
  searchUrl: string
  codeUrl?: string
}

// AI平台链接
export interface AIPlatform {
  name: string
  icon?: string
  url: string
}
