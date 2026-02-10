import { TmuxManager } from '../tmux/manager.js';
import { DiffDetector } from './diff-detector.js';
import { getLogger } from '../utils/logger.js';

export type OutputCallback = (fullOutput: string) => Promise<void>;

export class OutputMonitor {
  private intervalId: NodeJS.Timeout | null = null;
  private lastOutput: string = '';
  private unchangedCount: number = 0;
  private maxUnchangedCount: number = 15; // 30 秒無變化 (2秒 * 15)
  private logger = getLogger();
  private diffDetector = new DiffDetector();

  /**
   * 開始監控 tmux pane 輸出
   * @param tmuxManager tmux 管理器
   * @param onNewOutput 當有新輸出時的回調函數
   * @param pollInterval 輪詢間隔（毫秒）
   */
  start(
    tmuxManager: TmuxManager,
    onNewOutput: OutputCallback,
    pollInterval: number = 2000
  ): void {
    if (this.intervalId) {
      this.logger.warn('OutputMonitor 已經在運行');
      return;
    }

    this.logger.info('開始監控輸出', { pollInterval });
    this.lastOutput = '';
    this.unchangedCount = 0;

    this.intervalId = setInterval(async () => {
      try {
        const currentOutput = await tmuxManager.capturePane();

        // 檢查是否有變化
        if (!this.diffDetector.hasChanged(this.lastOutput, currentOutput)) {
          this.unchangedCount++;
          this.logger.debug('輸出無變化', { unchangedCount: this.unchangedCount });

          // 超時處理
          if (this.unchangedCount >= this.maxUnchangedCount) {
            this.logger.warn('輸出超時無變化，停止監控');
            this.stop();
            await onNewOutput(currentOutput);
          }
          return;
        }

        // 重置計數器
        this.unchangedCount = 0;

        // 檢查是否回應結束
        if (this.diffDetector.detectResponseEnd(currentOutput)) {
          this.logger.info('偵測到回應結束');
          this.lastOutput = currentOutput;
          this.stop();
          await onNewOutput(currentOutput);
        } else {
          // 更新最後輸出，但繼續監控
          this.lastOutput = currentOutput;
          this.logger.debug('輸出有變化，繼續監控');
        }
      } catch (error) {
        this.logger.error('監控輸出時發生錯誤', { error });
        this.stop();
      }
    }, pollInterval);
  }

  /**
   * 停止監控
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.info('停止監控輸出');
    }
  }

  /**
   * 檢查是否正在監控
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }
}
