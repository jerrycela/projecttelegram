import dotenv from 'dotenv';
import path from 'path';

// 載入環境變數
dotenv.config();

export interface Config {
  // Telegram
  telegramBotToken: string;
  allowedUserIds: number[];

  // Anthropic API
  anthropicApiKey: string;

  // tmux
  tmuxSessionName: string;
  claudeCommand: string;

  // Database
  dbPath: string;
  outputDir: string;

  // Monitoring
  pollInterval: number;
  contextCheckInterval: number;
  contextThreshold: number;
  healthCheckInterval: number;

  // Data Retention
  dataRetentionDays: number;

  // Logging
  logLevel: string;
}

function parseUserIds(userIdsStr: string | undefined): number[] {
  if (!userIdsStr) {
    throw new Error('ALLOWED_USER_IDS is required');
  }
  return userIdsStr.split(',').map((id) => {
    const parsed = parseInt(id.trim(), 10);
    if (isNaN(parsed)) {
      throw new Error(`Invalid user ID: ${id}`);
    }
    return parsed;
  });
}

export function loadConfig(): Config {
  const requiredEnvVars = [
    'TELEGRAM_BOT_TOKEN',
    'ALLOWED_USER_IDS',
    'ANTHROPIC_API_KEY',
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  return {
    // Telegram
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN!,
    allowedUserIds: parseUserIds(process.env.ALLOWED_USER_IDS),

    // Anthropic API
    anthropicApiKey: process.env.ANTHROPIC_API_KEY!,

    // tmux
    tmuxSessionName: process.env.TMUX_SESSION_NAME || 'claude-tg-bot',
    claudeCommand: process.env.CLAUDE_COMMAND || 'claude --dangerously-skip-permissions',

    // Database
    dbPath: process.env.DB_PATH || './data/db.sqlite',
    outputDir: process.env.OUTPUT_DIR || './data/outputs',

    // Monitoring
    pollInterval: parseInt(process.env.POLL_INTERVAL || '2000', 10),
    contextCheckInterval: parseInt(process.env.CONTEXT_CHECK_INTERVAL || '30000', 10),
    contextThreshold: parseFloat(process.env.CONTEXT_THRESHOLD || '0.8'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '10000', 10),

    // Data Retention
    dataRetentionDays: parseInt(process.env.DATA_RETENTION_DAYS || '30', 10),

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
  };
}
