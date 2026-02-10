import { TmuxManager } from '../tmux/manager.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class HealthCheck {
  private intervalId: NodeJS.Timeout | null = null;
  private checkInterval: number;
  private consecutiveFailures: number = 0;
  private maxConsecutiveFailures: number = 3;

  constructor(checkInterval: number = 10000) {
    this.checkInterval = checkInterval;
  }

  /**
   * 開始健康檢查
   * @param tmuxManager tmux 管理器
   * @param onUnhealthy 當檢測到不健康時的回調函數
   */
  start(tmuxManager: TmuxManager, onUnhealthy: () => Promise<void>): void {
    if (this.intervalId) {
      logger.warn('HealthCheck 已經在運行');
      return;
    }

    logger.info('開始健康檢查', { interval: this.checkInterval });

    this.intervalId = setInterval(async () => {
      try {
        const healthy = await this.check(tmuxManager);

        if (healthy) {
          this.consecutiveFailures = 0;
        } else {
          this.consecutiveFailures++;
          logger.warn('健康檢查失敗', {
            consecutiveFailures: this.consecutiveFailures,
          });

          if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
            logger.error('連續健康檢查失敗，觸發不健康回調');
            await onUnhealthy();
            this.consecutiveFailures = 0; // 重置計數器
          }
        }
      } catch (error) {
        logger.error('執行健康檢查時發生錯誤', { error });
      }
    }, this.checkInterval);
  }

  /**
   * 停止健康檢查
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('停止健康檢查');
    }
  }

  /**
   * 執行一次健康檢查
   * @returns 是否健康
   */
  async check(tmuxManager: TmuxManager): Promise<boolean> {
    try {
      const exists = await tmuxManager.sessionExists();

      if (!exists) {
        logger.warn('tmux session 不存在');
        return false;
      }

      // TODO: 可以增加更多檢查項目，例如：
      // - 檢查 Claude Code 進程是否回應
      // - 檢查最近是否有輸出
      // - 檢查 CPU/記憶體使用率

      logger.debug('健康檢查通過');
      return true;
    } catch (error) {
      logger.error('健康檢查時發生錯誤', { error });
      return false;
    }
  }

  /**
   * 檢查是否正在運行
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
