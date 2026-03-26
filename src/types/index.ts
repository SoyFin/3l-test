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

// 戴维斯双击评分项
export interface DavisScoreItem {
  id: string
  industry: string
  industryCode: string | null
  industryType: 'value' | 'cycle' | 'consume' | 'growth'
  weekDate: string
  totalScore: number
  earningsTurnScore: number      // 业绩拐点得分
  valuationScore: number         // 估值评分
  supplyBarrierScore: number     // 供给壁垒得分
  riskExcludeScore: number       // 风险排除得分
  logicChangeScore: number       // 逻辑质变得分
  momentumScore: number          // 动量因子得分
  northMoneyScore: number        // 北向资金得分
  weights: Record<string, number> | null
  details: Record<string, any> | null
  analysis: string | null
}

// 戴维斯双击评分维度
export interface DavisDimension {
  key: string
  name: string
  weight: number
  description: string
}

// 戴维斯双击评分维度列表
export const DAVIS_DIMENSIONS: DavisDimension[] = [
  { key: 'earningsTurnScore', name: '业绩拐点', weight: 0.25, description: '基于行业盈利周期判断' },
  { key: 'valuationScore', name: '估值评分', weight: 0.20, description: 'PE/PB历史分位分析' },
  { key: 'supplyBarrierScore', name: '供给壁垒', weight: 0.15, description: '行业进入壁垒分析' },
  { key: 'riskExcludeScore', name: '风险排除', weight: 0.10, description: '行业风险指标排查' },
  { key: 'logicChangeScore', name: '逻辑质变', weight: 0.15, description: '行业逻辑变化分析' },
  { key: 'momentumScore', name: '动量因子', weight: 0.10, description: '涨跌幅趋势分析' },
  { key: 'northMoneyScore', name: '北向资金', weight: 0.05, description: '外资流向分析' },
]

// 行业类型映射
export const INDUSTRY_TYPE_NAMES: Record<string, string> = {
  value: '价值型',
  cycle: '周期型',
  consume: '消费型',
  growth: '成长型',
}