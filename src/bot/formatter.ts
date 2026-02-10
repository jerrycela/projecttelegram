import { getLogger } from '../utils/logger.js';

const logger = getLogger();

/**
 * Telegram 訊息最大長度
 */
const TELEGRAM_MAX_LENGTH = 4096;

/**
 * 格式化摘要訊息
 * @param summary 摘要內容
 * @returns 格式化後的訊息
 */
export function formatSummary(summary: string): string {
  return `📝 *摘要*\n\n${summary}\n\n_使用 /detail 查看完整輸出_`;
}

/**
 * 格式化完整輸出訊息
 * @param fullOutput 完整輸出
 * @returns 格式化後的訊息（可能分段）
 */
export function formatFullOutput(fullOutput: string): string[] {
  const prefix = '📄 *完整輸出*\n\n';
  const content = fullOutput;

  // 如果內容在限制內，直接返回
  if (prefix.length + content.length <= TELEGRAM_MAX_LENGTH) {
    return [prefix + content];
  }

  // 需要分段
  logger.info('輸出過長，需要分段', { length: content.length });

  const messages: string[] = [];
  const chunkSize = TELEGRAM_MAX_LENGTH - 100; // 預留一些空間給前綴和後綴
  let currentPosition = 0;

  while (currentPosition < content.length) {
    const chunk = content.substring(currentPosition, currentPosition + chunkSize);
    const isFirst = currentPosition === 0;
    const isLast = currentPosition + chunkSize >= content.length;

    let message = '';
    if (isFirst) {
      message = `${prefix}${chunk}`;
    } else {
      message = chunk;
    }

    if (!isLast) {
      message += '\n\n_（續）_';
    }

    messages.push(message);
    currentPosition += chunkSize;
  }

  return messages;
}

/**
 * 格式化狀態訊息
 * @param status 狀態資訊
 */
export function formatStatus(status: {
  sessionActive: boolean;
  contextUsage?: number;
  lastActivity?: Date;
}): string {
  let message = '📊 *Claude Code 狀態*\n\n';

  message += `Session: ${status.sessionActive ? '✅ 運行中' : '❌ 未運行'}\n`;

  if (status.contextUsage !== undefined) {
    const percentage = (status.contextUsage * 100).toFixed(1);
    message += `Context Usage: ${percentage}%\n`;
  }

  if (status.lastActivity) {
    const timeAgo = getTimeAgo(status.lastActivity);
    message += `Last Activity: ${timeAgo}\n`;
  }

  return message;
}

/**
 * 計算時間差
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) {
    return '剛剛';
  } else if (diffMinutes < 60) {
    return `${diffMinutes} 分鐘前`;
  } else {
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) {
      return `${diffHours} 小時前`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} 天前`;
    }
  }
}
