import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private logLevel: LogLevel;
  private logFile: string;

  constructor(logLevel: string = 'info', logDir: string = './logs') {
    this.logLevel = this.parseLogLevel(logLevel);
    this.logFile = path.join(logDir, `bot-${new Date().toISOString().split('T')[0]}.log`);

    // 確保 logs 目錄存在
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private parseLogLevel(level: string): LogLevel {
    const levelMap: Record<string, LogLevel> = {
      debug: LogLevel.DEBUG,
      info: LogLevel.INFO,
      warn: LogLevel.WARN,
      error: LogLevel.ERROR,
    };
    return levelMap[level.toLowerCase()] ?? LogLevel.INFO;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, meta?: unknown): string {
    const timestamp = new Date().toISOString();
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  private writeLog(level: string, message: string, meta?: unknown): void {
    const formatted = this.formatMessage(level, message, meta);

    // 輸出到 console
    console.log(formatted);

    // 寫入檔案
    fs.appendFileSync(this.logFile, formatted + '\n');
  }

  debug(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.writeLog('DEBUG', message, meta);
    }
  }

  info(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.writeLog('INFO', message, meta);
    }
  }

  warn(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.writeLog('WARN', message, meta);
    }
  }

  error(message: string, meta?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.writeLog('ERROR', message, meta);
    }
  }
}

// 單例模式
let loggerInstance: Logger | null = null;

export function getLogger(): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(
      process.env.LOG_LEVEL || 'info',
      process.env.LOG_DIR || './logs'
    );
  }
  return loggerInstance;
}
