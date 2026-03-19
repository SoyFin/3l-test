import { create } from 'zustand';

// 行业动量数据
export interface IndustryMomentum {
  industry: string;
  count: number;
  total: number;
  score: number;
  rank: number;
  consecutiveWeeks: number;
  trend: 'up' | 'down' | 'stable';
  stocks: StockData[];
}

// 股票数据
export interface StockData {
  code: string;
  name: string;
  change20d: number;
  industry: string;
  industryLevel2: string;
}

// 基本面数据
export interface Fundamentals {
  code: string;
  name: string;
  industry?: string;
  revenueGrowth?: number;
  profitGrowth?: number;
  grossMargin?: number;
  roe?: number;
  debtRatio?: number;
  pe?: number;
  pb?: number;
  fundHolding?: number;
  northHolding?: number;
  tags?: string[];
}

// 系统状态
export interface SystemStatus {
  latestWeeklyDate: string | null;
  latestAllStocksDate: string | null;
  totalWeeklyRecords: number;
  totalMomentumRecords: number;
  weeklyUploadReminder: boolean;
  quarterlyUploadReminder: boolean;
  currentFriday: string;
}

// 选中的行业详情
export interface IndustryDetail {
  industry: string;
  weekDate: string;
  stocks: StockData[];
  momentum: {
    score: number;
    count: number;
    total: number;
    rank: number;
    consecutiveWeeks: number;
  } | null;
  trend: { date: string; score: number; count: number }[];
}

// Store 状态
interface AppState {
  // 动量数据
  momentumList: IndustryMomentum[];
  selectedWeekDate: string;
  availableWeeks: string[];
  
  // 行业详情
  selectedIndustry: string | null;
  industryDetail: IndustryDetail | null;
  
  // 股票详情
  selectedStock: StockData | null;
  stockFundamentals: Fundamentals | null;
  
  // 系统状态
  systemStatus: SystemStatus | null;
  
  // UI 状态
  isLoading: boolean;
  uploadDialogOpen: boolean;
  
  // Actions
  setMomentumList: (list: IndustryMomentum[]) => void;
  setSelectedWeekDate: (date: string) => void;
  setAvailableWeeks: (weeks: string[]) => void;
  setSelectedIndustry: (industry: string | null) => void;
  setIndustryDetail: (detail: IndustryDetail | null) => void;
  setSelectedStock: (stock: StockData | null) => void;
  setStockFundamentals: (fundamentals: Fundamentals | null) => void;
  setSystemStatus: (status: SystemStatus | null) => void;
  setIsLoading: (loading: boolean) => void;
  setUploadDialogOpen: (open: boolean) => void;
  
  // 数据获取
  fetchMomentumList: (weekDate?: string) => Promise<void>;
  fetchIndustryDetail: (industry: string, weekDate?: string) => Promise<void>;
  fetchSystemStatus: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  // 初始状态
  momentumList: [],
  selectedWeekDate: '',
  availableWeeks: [],
  selectedIndustry: null,
  industryDetail: null,
  selectedStock: null,
  stockFundamentals: null,
  systemStatus: null,
  isLoading: false,
  uploadDialogOpen: false,
  
  // Actions
  setMomentumList: (list) => set({ momentumList: list }),
  setSelectedWeekDate: (date) => set({ selectedWeekDate: date }),
  setAvailableWeeks: (weeks) => set({ availableWeeks: weeks }),
  setSelectedIndustry: (industry) => set({ selectedIndustry: industry }),
  setIndustryDetail: (detail) => set({ industryDetail: detail }),
  setSelectedStock: (stock) => set({ selectedStock: stock }),
  setStockFundamentals: (fundamentals) => set({ stockFundamentals: fundamentals }),
  setSystemStatus: (status) => set({ systemStatus: status }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setUploadDialogOpen: (open) => set({ uploadDialogOpen: open }),
  
  // 数据获取
  fetchMomentumList: async (weekDate) => {
    set({ isLoading: true });
    try {
      const url = weekDate 
        ? `/api/momentum?weekDate=${weekDate}` 
        : '/api/momentum';
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        set({ 
          momentumList: result.data,
          availableWeeks: result.meta?.availableWeeks || [],
          selectedWeekDate: result.meta?.weekDate || ''
        });
      }
    } catch (error) {
      console.error('获取动量数据失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchIndustryDetail: async (industry, weekDate) => {
    set({ isLoading: true });
    try {
      const weekDateParam = weekDate || get().selectedWeekDate;
      const url = `/api/momentum?industry=${encodeURIComponent(industry)}&weekDate=${weekDateParam}`;
      
      const response = await fetch(url);
      const result = await response.json();
      
      if (result.success) {
        set({ industryDetail: result.data });
      }
    } catch (error) {
      console.error('获取行业详情失败:', error);
    } finally {
      set({ isLoading: false });
    }
  },
  
  fetchSystemStatus: async () => {
    try {
      const response = await fetch('/api/config');
      const result = await response.json();
      
      if (result.success) {
        set({ systemStatus: result.data });
      }
    } catch (error) {
      console.error('获取系统状态失败:', error);
    }
  }
}));
