#!/bin/bash
# 代码质量修复脚本
# 使用方法: chmod +x code-quality-fixes.sh && ./code-quality-fixes.sh

echo "=== 代码质量修复脚本 ==="
echo ""

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "错误: 请在项目根目录运行此脚本"
    exit 1
fi

echo "1. 删除冗余目录..."
if [ -d "src/src" ]; then
    rm -rf src/src
    echo "   ✓ 已删除 src/src/"
else
    echo "   - src/src/ 不存在"
fi

if [ -d "agent-service/agents_old" ]; then
    rm -rf agent-service/agents_old
    echo "   ✓ 已删除 agent-service/agents_old/"
else
    echo "   - agent-service/agents_old/ 不存在"
fi

echo ""
echo "2. 修复 next.config.ts..."
if [ -f "next.config.ts" ]; then
    # 备份原文件
    cp next.config.ts next.config.ts.backup
    
    # 移除 ignoreBuildErrors
    sed -i '/ignoreBuildErrors/d' next.config.ts
    echo "   ✓ 已移除 ignoreBuildErrors 配置"
else
    echo "   - next.config.ts 不存在"
fi

echo ""
echo "3. 创建日志工具..."
mkdir -p src/lib
cat > src/lib/logger.ts << 'EOF'
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
}

class Logger {
  private level: LogLevel
  private context: string

  constructor(context: string = 'App') {
    this.context = context
    this.level = (process.env.LOG_LEVEL as LogLevel) || 'info'
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args)
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.log(this.formatMessage('info', message), ...args)
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args)
    }
  }

  error(message: string, error?: Error | unknown) {
    if (this.shouldLog('error')) {
      const errorDetails = error instanceof Error 
        ? `${error.message}\n${error.stack}` 
        : String(error)
      console.error(this.formatMessage('error', message), errorDetails)
    }
  }
}

export function createLogger(context: string): Logger {
  return new Logger(context)
}

export const logger = new Logger('App')
EOF
echo "   ✓ 已创建 src/lib/logger.ts"

echo ""
echo "4. 统计需要手动修复的 any 类型..."
any_count=$(grep -r ": any" src --include="*.ts" --include="*.tsx" 2>/dev/null | wc -l)
echo "   发现约 ${any_count} 处 : any 类型需要手动修复"

echo ""
echo "=== 修复完成 ==="
echo ""
echo "后续手动修复建议:"
echo "1. 修复 TypeScript 类型错误后运行: bun run build"
echo "2. 将 console.log 替换为 logger (见 src/lib/logger.ts)"
echo "3. 全局状态改用数据库存储 (见代码示例文档)"
echo ""
