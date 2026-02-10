import Anthropic from '@anthropic-ai/sdk';
import { getLogger } from '../utils/logger.js';
import { APIError } from '../utils/errors.js';

export class Summarizer {
  private client: Anthropic;
  private logger = getLogger();

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async summarize(fullOutput: string, maxRetries: number = 3): Promise<string> {
    this.logger.debug('開始生成摘要', { outputLength: fullOutput.length });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: 'claude-haiku-4-5',
          max_tokens: 500,
          temperature: 0.3,
          messages: [
            {
              role: 'user',
              content: `請將以下 Claude Code 的回應摘要為 2-3 句話的重點（繁體中文）：

${fullOutput}

摘要：`,
            },
          ],
        });

        const summary =
          response.content[0].type === 'text' ? response.content[0].text : '';

        this.logger.info('摘要生成成功', { summaryLength: summary.length });
        return summary;
      } catch (error) {
        this.logger.warn(`摘要生成失敗 (嘗試 ${attempt}/${maxRetries})`, { error });

        if (attempt === maxRetries) {
          this.logger.error('摘要生成達到最大重試次數', { error });
          // 返回前 500 字元作為備用
          return this.getFallbackSummary(fullOutput);
        }

        // 指數退避
        await this.sleep(Math.pow(2, attempt) * 1000);
      }
    }

    return this.getFallbackSummary(fullOutput);
  }

  private getFallbackSummary(fullOutput: string): string {
    const fallback = fullOutput.substring(0, 500);
    this.logger.info('使用備用摘要（前 500 字元）');
    return `⚠️ 摘要生成失敗，以下為部分內容：\n\n${fallback}${
      fullOutput.length > 500 ? '...' : ''
    }`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
