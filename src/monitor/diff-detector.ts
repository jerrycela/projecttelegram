import { getLogger } from '../utils/logger.js';

export class DiffDetector {
  private logger = getLogger();

  /**
   * 提取新增的內容
   * @param previousOutput 前一次的輸出
   * @param currentOutput 當前的輸出
   * @returns 新增的內容
   */
  extractNewContent(previousOutput: string, currentOutput: string): string {
    if (!previousOutput) {
      return currentOutput;
    }

    // 簡單的字串差異：找出新增的部分
    if (currentOutput.startsWith(previousOutput)) {
      const newContent = currentOutput.substring(previousOutput.length);
      this.logger.debug('提取新內容', {
        previousLength: previousOutput.length,
        currentLength: currentOutput.length,
        newLength: newContent.length,
      });
      return newContent;
    }

    // 如果不是簡單的附加，返回整個當前輸出
    this.logger.warn('無法識別差異模式，返回完整輸出');
    return currentOutput;
  }

  /**
   * 偵測回應是否結束
   * @param output 當前輸出
   * @returns 是否結束
   */
  detectResponseEnd(output: string): boolean {
    const trimmed = output.trim();

    // 檢查是否以 Claude prompt 結尾
    const endPatterns = [
      /> $/m, // 標準 Claude prompt
      /claude>$/m, // 自訂 prompt
      /\$ $/m, // Shell prompt（可能在某些情況下出現）
    ];

    for (const pattern of endPatterns) {
      if (pattern.test(trimmed)) {
        this.logger.debug('偵測到回應結束', { pattern: pattern.source });
        return true;
      }
    }

    return false;
  }

  /**
   * 檢查輸出是否有變化
   * @param previousOutput 前一次的輸出
   * @param currentOutput 當前的輸出
   * @returns 是否有變化
   */
  hasChanged(previousOutput: string, currentOutput: string): boolean {
    return previousOutput !== currentOutput;
  }
}
