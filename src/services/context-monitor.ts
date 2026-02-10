import { TmuxManager } from '../tmux/manager.js';
import { getLogger } from '../utils/logger.js';
import { Telegraf } from 'telegraf';

const logger = getLogger();

interface ContextStatus {
  usage: number; // 0.0 - 1.0
  tokenCount: number;
  maxTokens: number;
}

export class ContextMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastUsage: number = 0;
  private compactThreshold: number;
  private checkInterval: number;

  constructor(compactThreshold: number = 0.8, checkInterval: number = 30000) {
    this.compactThreshold = compactThreshold;
    this.checkInterval = checkInterval;
  }

  /**
   * 開始監控 context window
   */
  start(
    tmuxManager: TmuxManager,
    telegramBot: Telegraf,
    notifyUserId: number
  ): void {
    if (this.intervalId) {
      logger.warn('ContextMonitor 已經在運行');
      return;
    }

    logger.info('開始監控 context window', {
      threshold: this.compactThreshold,
      interval: this.checkInterval,
    });

    this.intervalId = setInterval(async () => {
      try {
        const status = await this.getContextStatus();

        if (status && status.usage >= this.compactThreshold) {
          logger.warn('Context window 接近上限，準備執行 compact', {
            usage: status.usage,
          });

          await this.executeCompact(tmuxManager, telegramBot, notifyUserId, status);
        } else if (status) {
          logger.debug('Context window 使用率正常', { usage: status.usage });
          this.lastUsage = status.usage;
        }
      } catch (error) {
        logger.error('監控 context window 時發生錯誤', { error });
      }
    }, this.checkInterval);
  }

  /**
   * 停止監控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('停止監控 context window');
    }
  }

  /**
   * 取得 context window 狀態（從 claude-mem API）
   */
  private async getContextStatus(): Promise<ContextStatus | null> {
    try {
      const response = await fetch('http://localhost:37777/api/status');

      if (!response.ok) {
        logger.warn('無法取得 claude-mem 狀態', { status: response.status });
        return null;
      }

      const data = (await response.json()) as any;

      // 假設 claude-mem API 返回的格式
      // 實際格式需要根據 claude-mem 的 API 調整
      if (data.contextWindow) {
        return {
          usage: data.contextWindow.usage || 0,
          tokenCount: data.contextWindow.tokenCount || 0,
          maxTokens: data.contextWindow.maxTokens || 200000,
        };
      }

      return null;
    } catch (error) {
      logger.debug('無法連接到 claude-mem API', { error });
      return null;
    }
  }

  /**
   * 執行 compact
   */
  private async executeCompact(
    tmuxManager: TmuxManager,
    telegramBot: Telegraf,
    notifyUserId: number,
    status: ContextStatus
  ): Promise<void> {
    try {
      const usagePercentage = (status.usage * 100).toFixed(1);

      logger.info('執行 /compact 命令', { usage: status.usage });

      // 通知使用者
      await telegramBot.telegram.sendMessage(
        notifyUserId,
        `⚠️ Context window 已達 ${usagePercentage}%，正在執行壓縮...`
      );

      // 發送 /compact 命令
      await tmuxManager.sendKeys('/compact');

      // 等待 compact 完成（假設需要 5 秒）
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // 再次檢查狀態
      const newStatus = await this.getContextStatus();
      const newUsagePercentage = newStatus
        ? (newStatus.usage * 100).toFixed(1)
        : '未知';

      await telegramBot.telegram.sendMessage(
        notifyUserId,
        `✅ Context window 已壓縮（${usagePercentage}% → ${newUsagePercentage}%）`
      );

      logger.info('Compact 執行完成', {
        oldUsage: status.usage,
        newUsage: newStatus?.usage,
      });

      this.lastUsage = newStatus?.usage || 0;
    } catch (error) {
      logger.error('執行 compact 時發生錯誤', { error });

      await telegramBot.telegram.sendMessage(
        notifyUserId,
        '❌ 執行 compact 時發生錯誤'
      );
    }
  }

  /**
   * 檢查是否正在監控
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
