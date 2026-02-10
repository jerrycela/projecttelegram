import { TmuxManager } from '../tmux/manager.js';
import { HealthCheck } from './health-check.js';
import { getLogger } from '../utils/logger.js';
import { Telegraf } from 'telegraf';

const logger = getLogger();

export class RestartService {
  private healthCheck: HealthCheck;
  private restartCount: number = 0;
  private maxRestarts: number = 3;
  private restartWindow: number = 60 * 60 * 1000; // 1 小時
  private restartTimestamps: number[] = [];

  constructor(healthCheckInterval: number = 10000) {
    this.healthCheck = new HealthCheck(healthCheckInterval);
  }

  /**
   * 開始監控並自動重啟
   */
  async monitor(
    tmuxManager: TmuxManager,
    telegramBot: Telegraf,
    notifyUserId: number
  ): Promise<void> {
    logger.info('啟動自動重啟服務');

    this.healthCheck.start(tmuxManager, async () => {
      await this.handleUnhealthy(tmuxManager, telegramBot, notifyUserId);
    });
  }

  /**
   * 停止監控
   */
  stop(): void {
    this.healthCheck.stop();
    logger.info('停止自動重啟服務');
  }

  /**
   * 處理不健康狀態
   */
  private async handleUnhealthy(
    tmuxManager: TmuxManager,
    telegramBot: Telegraf,
    notifyUserId: number
  ): Promise<void> {
    // 檢查重啟次數限制
    const now = Date.now();
    this.restartTimestamps = this.restartTimestamps.filter(
      (timestamp) => now - timestamp < this.restartWindow
    );

    if (this.restartTimestamps.length >= this.maxRestarts) {
      logger.error('重啟次數已達上限，停止自動重啟', {
        count: this.restartTimestamps.length,
        window: this.restartWindow,
      });

      await telegramBot.telegram.sendMessage(
        notifyUserId,
        `❌ Claude Code session 異常，但重啟次數已達上限（${this.maxRestarts} 次/小時）\n\n請手動檢查`
      );

      return;
    }

    // 記錄重啟時間
    this.restartTimestamps.push(now);
    this.restartCount++;

    logger.warn('偵測到 tmux session 異常，準備重啟', {
      restartCount: this.restartCount,
      recentRestarts: this.restartTimestamps.length,
    });

    await this.restart(tmuxManager, telegramBot, notifyUserId);
  }

  /**
   * 執行重啟
   */
  private async restart(
    tmuxManager: TmuxManager,
    telegramBot: Telegraf,
    notifyUserId: number
  ): Promise<void> {
    try {
      await telegramBot.telegram.sendMessage(
        notifyUserId,
        `⚠️ Claude Code session 異常，正在重啟... (${this.restartTimestamps.length}/${this.maxRestarts})`
      );

      // 嘗試終止現有 session
      try {
        await tmuxManager.killSession();
      } catch (error) {
        logger.warn('終止 session 時發生錯誤（可能已經終止）', { error });
      }

      // 等待一下
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // 建立新 session
      await tmuxManager.ensureSession();

      logger.info('✅ tmux session 已重啟');

      await telegramBot.telegram.sendMessage(
        notifyUserId,
        '✅ Claude Code session 已重啟'
      );
    } catch (error) {
      logger.error('重啟 session 失敗', { error });

      await telegramBot.telegram.sendMessage(
        notifyUserId,
        '❌ 重啟 Claude Code session 失敗，請手動檢查'
      );
    }
  }

  /**
   * 檢查是否正在運行
   */
  isRunning(): boolean {
    return this.healthCheck.isRunning();
  }
}
