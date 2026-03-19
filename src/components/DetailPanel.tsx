'use client';

import { useAppStore } from '@/hooks/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  BarChart3, 
  Users, 
  Building2,
  ExternalLink,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useEffect, useCallback } from 'react';

// 获取动量分值颜色
function getMomentumStyle(score: number) {
  if (score <= 1) {
    return {
      text: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-800',
      label: '效应弱'
    };
  } else if (score >= 7) {
    return {
      text: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      label: '接近高潮'
    };
  }
  return {
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    label: '正常'
  };
}

export default function DetailPanel() {
  const {
    selectedIndustry,
    industryDetail,
    selectedStock,
    setSelectedStock,
    isLoading,
    fetchIndustryDetail,
    selectedWeekDate
  } = useAppStore();
  
  useEffect(() => {
    if (selectedIndustry) {
      fetchIndustryDetail(selectedIndustry);
    }
  }, [selectedIndustry, fetchIndustryDetail]);
  
  const handleStockClick = useCallback((stock: { code: string; name: string; change20d: number; industry: string; industryLevel2: string }) => {
    setSelectedStock(selectedStock?.code === stock.code ? null : stock);
  }, [selectedStock, setSelectedStock]);
  
  if (!selectedIndustry) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">行业详情</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Building2 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>请从左侧选择一个行业</p>
            <p className="text-sm">查看详细信息</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (isLoading && !industryDetail) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader>
          <CardTitle className="text-lg">加载中...</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">加载行业详情...</div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{selectedIndustry}</CardTitle>
          {industryDetail?.momentum && (
            <div className={cn("px-3 py-1 rounded-full text-sm font-medium", 
              getMomentumStyle(industryDetail.momentum.score).bg,
              getMomentumStyle(industryDetail.momentum.score).text
            )}>
              动量: {industryDetail.momentum.score.toFixed(2)}
            </div>
          )}
        </div>
        
        {industryDetail?.momentum && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              上榜: {industryDetail.momentum.count}
            </span>
            <span className="flex items-center gap-1">
              <Building2 className="w-4 h-4" />
              成分: {industryDetail.momentum.total}
            </span>
            {industryDetail.momentum.consecutiveWeeks > 1 && (
              <Badge variant="outline">
                连续上榜 {industryDetail.momentum.consecutiveWeeks} 周
              </Badge>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <Tabs defaultValue="stocks" className="h-full flex flex-col">
          <TabsList className="mx-4 mt-2">
            <TabsTrigger value="stocks">入选个股</TabsTrigger>
            <TabsTrigger value="trend">动量趋势</TabsTrigger>
            <TabsTrigger value="analysis">AI分析</TabsTrigger>
          </TabsList>
          
          <TabsContent value="stocks" className="flex-1 mt-2 overflow-hidden">
            <ScrollArea className="h-full px-4 pb-4">
              <div className="space-y-2">
                {industryDetail?.stocks.map((stock) => (
                  <div
                    key={stock.code}
                    onClick={() => handleStockClick(stock)}
                    className={cn(
                      "p-3 rounded-lg border bg-card hover:bg-accent cursor-pointer transition-colors",
                      selectedStock?.code === stock.code && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{stock.name}</div>
                        <div className="text-xs text-muted-foreground">{stock.code}</div>
                      </div>
                      <div className="text-right">
                        <div className={cn(
                          "font-bold",
                          stock.change20d > 0 ? "text-red-500" : "text-green-500"
                        )}>
                          {stock.change20d > 0 ? '+' : ''}{stock.change20d.toFixed(2)}%
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {stock.industry}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="trend" className="flex-1 mt-2 overflow-hidden px-4 pb-4">
            {industryDetail?.trend && industryDetail.trend.length > 0 ? (
              <div className="h-full min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={industryDetail.trend.slice().reverse()}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="score" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                      name="动量分值"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--chart-2))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--chart-2))' }}
                      name="上榜数量"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                暂无历史趋势数据
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="analysis" className="flex-1 mt-2 overflow-hidden px-4 pb-4">
            <ScrollArea className="h-full">
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    AI 分析建议
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    请使用右侧AI助手获取对「{selectedIndustry}」行业的深入分析。
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    可分析内容：
                  </p>
                  <ul className="text-sm text-muted-foreground list-disc list-inside mt-1">
                    <li>行业上涨的核心逻辑</li>
                    <li>驱动因素分析</li>
                    <li>持续性判断</li>
                    <li>风险提示</li>
                  </ul>
                </div>
                
                <div className="p-4 rounded-lg border">
                  <h4 className="font-medium mb-2">快速操作</h4>
                  <div className="space-y-2">
                    <button className="w-full text-left p-2 rounded hover:bg-accent text-sm flex items-center justify-between group">
                      <span>在东方财富查看行业资讯</span>
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button className="w-full text-left p-2 rounded hover:bg-accent text-sm flex items-center justify-between group">
                      <span>在同花顺查看行业数据</span>
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                    <button className="w-full text-left p-2 rounded hover:bg-accent text-sm flex items-center justify-between group">
                      <span>在慧博查看行业研报</span>
                      <ExternalLink className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
