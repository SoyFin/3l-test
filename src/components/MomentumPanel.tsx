'use client';

import { useAppStore, IndustryMomentum } from '@/hooks/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, RefreshCw, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useCallback } from 'react';

// 获取动量分值颜色
function getMomentumStyle(score: number) {
  if (score <= 1) {
    return {
      text: 'text-gray-600 dark:text-gray-400',
      bg: 'bg-gray-100 dark:bg-gray-800',
      badge: 'secondary' as const,
      label: '效应弱'
    };
  } else if (score >= 7) {
    return {
      text: 'text-orange-600 dark:text-orange-400',
      bg: 'bg-orange-100 dark:bg-orange-900/30',
      badge: 'destructive' as const,
      label: '接近高潮'
    };
  }
  return {
    text: 'text-green-600 dark:text-green-400',
    bg: 'bg-green-50 dark:bg-green-900/20',
    badge: 'default' as const,
    label: '正常'
  };
}

// 趋势图标
function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  switch (trend) {
    case 'up':
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    case 'down':
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    default:
      return <Minus className="w-4 h-4 text-gray-400" />;
  }
}

export default function MomentumPanel() {
  const {
    momentumList,
    selectedWeekDate,
    availableWeeks,
    selectedIndustry,
    isLoading,
    fetchMomentumList,
    setSelectedWeekDate,
    setSelectedIndustry
  } = useAppStore();
  
  useEffect(() => {
    fetchMomentumList();
  }, [fetchMomentumList]);
  
  const handleWeekChange = useCallback((weekDate: string) => {
    setSelectedWeekDate(weekDate);
    fetchMomentumList(weekDate);
  }, [setSelectedWeekDate, fetchMomentumList]);
  
  const handleIndustryClick = useCallback((industry: string) => {
    setSelectedIndustry(industry === selectedIndustry ? null : industry);
  }, [selectedIndustry, setSelectedIndustry]);
  
  const handleRefresh = useCallback(() => {
    fetchMomentumList(selectedWeekDate);
  }, [fetchMomentumList, selectedWeekDate]);
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2 space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            动量排行榜
          </CardTitle>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-1.5 rounded-md hover:bg-accent transition-colors"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">周度:</span>
          <Select value={selectedWeekDate} onValueChange={handleWeekChange}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="选择日期" />
            </SelectTrigger>
            <SelectContent>
              {availableWeeks.map(week => (
                <SelectItem key={week} value={week}>{week}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* 颜色图例 */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-gray-400" />
            <span className="text-muted-foreground">效应弱 (≤1)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-green-500" />
            <span className="text-muted-foreground">正常</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-orange-500" />
            <span className="text-muted-foreground">接近高潮 (≥7)</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4 pb-4">
          {momentumList.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {isLoading ? '加载中...' : '暂无数据，请先上传周度数据'}
            </div>
          ) : (
            <div className="space-y-2">
              {momentumList.map((item) => {
                const style = getMomentumStyle(item.score);
                return (
                  <div
                    key={item.industry}
                    onClick={() => handleIndustryClick(item.industry)}
                    className={cn(
                      "p-3 rounded-lg cursor-pointer transition-all border",
                      style.bg,
                      "hover:shadow-md",
                      selectedIndustry === item.industry && "ring-2 ring-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-lg w-6">#{item.rank}</span>
                        <div>
                          <div className="font-medium">{item.industry}</div>
                          <div className="text-xs text-muted-foreground">
                            上榜 {item.count} / 成分 {item.total}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className={cn("font-bold text-xl", style.text)}>
                            {item.score.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <TrendIcon trend={item.trend} />
                            {item.consecutiveWeeks > 1 && (
                              <Badge variant="outline" className="text-xs px-1 py-0 h-4">
                                {item.consecutiveWeeks}周
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
