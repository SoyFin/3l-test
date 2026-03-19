'use client';

import { useAppStore } from '@/hooks/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { 
  Bot, 
  Copy, 
  ExternalLink, 
  FileText, 
  MessageSquare,
  Sparkles,
  Check,
  BookOpen,
  Search,
  TrendingUp
} from 'lucide-react';
import { useState, useCallback } from 'react';

// AI平台链接
const AI_PLATFORMS = [
  { name: '通义千问', url: 'https://qianwen.aliyun.com/', color: 'bg-blue-500' },
  { name: 'Kimi', url: 'https://kimi.moonshot.cn/', color: 'bg-purple-500' },
  { name: '文心一言', url: 'https://yiyan.baidu.com/', color: 'bg-red-500' },
  { name: '豆包', url: 'https://www.doubao.com/', color: 'bg-green-500' },
];

// 研报平台链接
const REPORT_PLATFORMS = [
  { name: '慧博', url: 'http://www.hibor.com.cn/', icon: FileText },
  { name: '东财研报', url: 'https://data.eastmoney.com/report/', icon: Search },
  { name: '同花顺', url: 'https://stockpage.10jqka.com.cn/', icon: TrendingUp },
  { name: '萝卜投研', url: 'https://robo.datayes.com/', icon: Bot },
  { name: '韭研公社', url: 'https://www.jiuyangongshe.com/', icon: BookOpen },
];

// 提示词模板
const PROMPT_TEMPLATES = [
  {
    title: '行业分析',
    template: '请分析{industry}行业的投资逻辑，包括：\n1. 行业上涨的核心驱动因素\n2. 行业发展前景\n3. 主要风险点\n4. 重点关注的公司',
  },
  {
    title: '个股分析',
    template: '请分析{stock}（{code}）的投资价值：\n1. 公司主营业务\n2. 行业地位\n3. 财务状况\n4. 投资风险',
  },
  {
    title: '动量分析',
    template: '{industry}行业近期动量分值为{score}，上榜股票{count}只，请分析该行业是否值得投资，以及投资时机。',
  },
  {
    title: '对比分析',
    template: '请对比分析{industry}行业与其他热门行业的投资价值，包括成长性、确定性、估值等方面。',
  },
];

// 复制到剪贴板
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AIAssistantPanel() {
  const { selectedIndustry, industryDetail, selectedStock } = useAppStore();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const handleCopy = useCallback(async (template: string, index: number) => {
    let text = template;
    
    // 替换占位符
    text = text.replace('{industry}', selectedIndustry || '所选行业');
    text = text.replace('{stock}', selectedStock?.name || '所选股票');
    text = text.replace('{code}', selectedStock?.code || '');
    text = text.replace('{score}', industryDetail?.momentum?.score?.toFixed(2) || '');
    text = text.replace('{count}', String(industryDetail?.momentum?.count || ''));
    
    const success = await copyToClipboard(text);
    if (success) {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  }, [selectedIndustry, selectedStock, industryDetail]);
  
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="w-5 h-5" />
          AI助手
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-4 pb-4">
          {/* 当前选中信息 */}
          {(selectedIndustry || selectedStock) && (
            <div className="mb-4 p-3 rounded-lg bg-muted/50">
              <div className="text-sm font-medium mb-2">当前选中</div>
              <div className="flex flex-wrap gap-2">
                {selectedIndustry && (
                  <Badge variant="secondary">{selectedIndustry}</Badge>
                )}
                {selectedStock && (
                  <Badge variant="outline">{selectedStock.name} ({selectedStock.code})</Badge>
                )}
              </div>
            </div>
          )}
          
          {/* 提示词模板 */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              提示词模板
            </div>
            <div className="space-y-2">
              {PROMPT_TEMPLATES.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{item.title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2"
                      onClick={() => handleCopy(item.template, index)}
                    >
                      {copiedIndex === index ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {item.template.replace(/\{[^}]+\}/g, '...')}
                  </p>
                </div>
              ))}
            </div>
          </div>
          
          {/* AI平台跳转 */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              AI平台
            </div>
            <div className="grid grid-cols-2 gap-2">
              {AI_PLATFORMS.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div className={cn("w-2 h-2 rounded-full", platform.color)} />
                  <span className="text-sm">{platform.name}</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
              ))}
            </div>
          </div>
          
          {/* 研报平台跳转 */}
          <div className="mb-4">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              研报平台
            </div>
            <div className="space-y-2">
              {REPORT_PLATFORMS.map((platform) => (
                <a
                  key={platform.name}
                  href={platform.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-2 rounded-lg border hover:bg-accent transition-colors"
                >
                  <platform.icon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{platform.name}</span>
                  <ExternalLink className="w-3 h-3 ml-auto opacity-50" />
                </a>
              ))}
            </div>
          </div>
          
          {/* 股票详情 */}
          {selectedStock && (
            <div className="mb-4">
              <div className="text-sm font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                个股详情
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="font-medium mb-1">{selectedStock.name}</div>
                <div className="text-xs text-muted-foreground mb-2">{selectedStock.code}</div>
                <div className="text-sm">
                  <span className="text-muted-foreground">20日涨幅:</span>
                  <span className={cn(
                    "ml-1 font-medium",
                    selectedStock.change20d > 0 ? "text-red-500" : "text-green-500"
                  )}>
                    {selectedStock.change20d > 0 ? '+' : ''}{selectedStock.change20d.toFixed(2)}%
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t flex gap-2">
                  <a
                    href={`https://quote.eastmoney.com/${selectedStock.code.includes('.SH') ? 'sh' : 'sz'}${selectedStock.code.split('.')[0]}.html`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      东财详情
                    </Button>
                  </a>
                  <a
                    href={`https://stockpage.10jqka.com.cn/${selectedStock.code.split('.')[0]}/`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1"
                  >
                    <Button variant="outline" size="sm" className="w-full">
                      同花顺
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          )}
          
          {/* 使用说明 */}
          <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">使用说明：</p>
            <ul className="list-disc list-inside space-y-1">
              <li>选择行业后可获取分析模板</li>
              <li>点击复制按钮复制提示词</li>
              <li>跳转AI平台粘贴提问</li>
              <li>使用研报平台查找深度分析</li>
            </ul>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// cn utility function
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
