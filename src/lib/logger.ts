type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3
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
    return `[${new Date().toISOString()}] [${level.toUpperCase()}] [${this.context}] ${message}`
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) console.debug(this.formatMessage('debug', message), ...args)
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) console.log(this.formatMessage('info', message), ...args)
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('warn')) console.warn(this.formatMessage('warn', message), ...args)
  }

  error(message: string, error?: Error | unknown) {
    if (this.shouldLog('error')) {
      const details = error instanceof Error ? `${error.message}\n${error.stack}` : String(error)
      console.error(this.formatMessage('error', message), details)
    }
  }
}

export function createLogger(context: string): Logger { return new Logger(context) }
export const logger = new Logger('App')
