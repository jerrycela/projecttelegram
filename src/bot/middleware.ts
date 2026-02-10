import { Context, MiddlewareFn } from 'telegraf';
import { getLogger } from '../utils/logger.js';
import { AuthenticationError } from '../utils/errors.js';

const logger = getLogger();

/**
 * User ID 白名單認證中介軟體
 * @param allowedUserIds 允許的 User ID 列表
 */
export function authMiddleware(allowedUserIds: number[]): MiddlewareFn<Context> {
  return async (ctx, next) => {
    const userId = ctx.from?.id;

    if (!userId) {
      logger.warn('收到沒有 User ID 的請求');
      await ctx.reply('❌ 無法識別使用者');
      return;
    }

    if (!allowedUserIds.includes(userId)) {
      logger.warn('未授權的使用者嘗試存取', { userId });
      await ctx.reply('❌ 未授權的使用者');
      throw new AuthenticationError('Unauthorized user');
    }

    logger.debug('使用者認證成功', { userId });
    await next();
  };
}

/**
 * 請求速率限制中介軟體
 * @param maxRequestsPerMinute 每分鐘最大請求數
 */
export function rateLimitMiddleware(maxRequestsPerMinute: number = 10): MiddlewareFn<Context> {
  const userRequests = new Map<number, number[]>();

  return async (ctx, next) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;

    // 取得使用者的請求記錄
    const requests = userRequests.get(userId) || [];

    // 清理超過 1 分鐘的記錄
    const recentRequests = requests.filter((timestamp) => timestamp > oneMinuteAgo);

    if (recentRequests.length >= maxRequestsPerMinute) {
      logger.warn('使用者超過速率限制', { userId, requestCount: recentRequests.length });
      await ctx.reply('⚠️ 請求過於頻繁，請稍後再試');
      return;
    }

    // 記錄新請求
    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    await next();
  };
}

/**
 * 錯誤處理中介軟體
 */
export function errorMiddleware(): MiddlewareFn<Context> {
  return async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      logger.error('處理請求時發生錯誤', { error });

      if (error instanceof AuthenticationError) {
        // 認證錯誤已經在 authMiddleware 中處理
        return;
      }

      await ctx.reply('❌ 處理請求時發生錯誤，請稍後再試');
    }
  };
}
