import { Context } from 'telegraf';
import { TmuxManager } from '../tmux/manager.js';
import { OutputMonitor } from '../monitor/output-monitor.js';
import { Summarizer } from '../monitor/summarizer.js';
import { saveConversation, getLatestConversation } from '../storage/conversation.js';
import { saveOutput, getOutput } from '../storage/output.js';
import { formatSummary, formatFullOutput, formatStatus } from './formatter.js';
import { getLogger } from '../utils/logger.js';
import { Config } from '../utils/config.js';

const logger = getLogger();

export class CommandHandler {
  private tmuxManager: TmuxManager;
  private summarizer: Summarizer;
  private config: Config;

  constructor(tmuxManager: TmuxManager, summarizer: Summarizer, config: Config) {
    this.tmuxManager = tmuxManager;
    this.summarizer = summarizer;
    this.config = config;
  }

  /**
   * /start 命令
   */
  async handleStart(ctx: Context): Promise<void> {
    logger.info('使用者執行 /start 命令', { userId: ctx.from?.id });

    const message = `👋 歡迎使用 Telegram Claude Code Remote Control！

可用命令：
/ask <問題> - 向 Claude Code 提問
/detail - 查看最新完整輸出
/status - 查看 Claude Code 狀態
/reset - 重置 Claude Code session

範例：
/ask 什麼是 TypeScript?`;

    await ctx.reply(message);
  }

  /**
   * /ask 命令
   */
  async handleAsk(ctx: Context): Promise<void> {
    if (!ctx.message || !('text' in ctx.message)) {
      await ctx.reply('❌ 無法讀取訊息');
      return;
    }

    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ 無法識別使用者');
      return;
    }

    const text = ctx.message.text;
    const question = text.replace('/ask', '').trim();

    if (!question) {
      await ctx.reply('❌ 請提供問題\n\n範例：/ask 什麼是 TypeScript?');
      return;
    }

    logger.info('使用者提問', { userId, question });

    try {
      // 確保 tmux session 存在
      await this.tmuxManager.ensureSession();

      // 發送問題到 Claude Code
      await this.tmuxManager.sendKeys(question);

      // 通知使用者正在處理
      await ctx.reply('⏳ 正在處理你的問題...');

      // 啟動輸出監控
      const monitor = new OutputMonitor();
      monitor.start(
        this.tmuxManager,
        async (fullOutput: string) => {
          try {
            logger.info('收到完整輸出', { length: fullOutput.length });

            // 生成摘要
            const summary = await this.summarizer.summarize(fullOutput);

            // 儲存輸出
            const { full_output, full_output_path } = saveOutput(fullOutput);

            // 儲存對話記錄
            saveConversation({
              user_id: userId,
              question,
              summary,
              full_output: full_output || undefined,
              full_output_path: full_output_path || undefined,
            });

            // 回傳摘要
            const formattedSummary = formatSummary(summary);
            await ctx.reply(formattedSummary, { parse_mode: 'Markdown' });

            logger.info('摘要已傳送給使用者', { userId });
          } catch (error) {
            logger.error('處理輸出時發生錯誤', { error });
            await ctx.reply('❌ 處理回應時發生錯誤');
          }
        },
        this.config.pollInterval
      );
    } catch (error) {
      logger.error('/ask 命令執行失敗', { error });
      await ctx.reply('❌ 執行命令時發生錯誤');
    }
  }

  /**
   * /detail 命令
   */
  async handleDetail(ctx: Context): Promise<void> {
    const userId = ctx.from?.id;
    if (!userId) {
      await ctx.reply('❌ 無法識別使用者');
      return;
    }

    logger.info('使用者執行 /detail 命令', { userId });

    try {
      // 取得最新對話
      const conversation = getLatestConversation(userId);

      if (!conversation) {
        await ctx.reply('❌ 找不到最近的對話記錄');
        return;
      }

      // 取得完整輸出
      const fullOutput = getOutput(
        conversation.full_output,
        conversation.full_output_path
      );

      // 格式化並發送（可能分段）
      const messages = formatFullOutput(fullOutput);

      for (const message of messages) {
        await ctx.reply(message, { parse_mode: 'Markdown' });
      }

      logger.info('完整輸出已傳送', { userId, segments: messages.length });
    } catch (error) {
      logger.error('/detail 命令執行失敗', { error });
      await ctx.reply('❌ 執行命令時發生錯誤');
    }
  }

  /**
   * /status 命令
   */
  async handleStatus(ctx: Context): Promise<void> {
    logger.info('使用者執行 /status 命令', { userId: ctx.from?.id });

    try {
      const sessionActive = await this.tmuxManager.sessionExists();

      let sessionInfo = '';
      if (sessionActive) {
        sessionInfo = await this.tmuxManager.getSessionInfo();
      }

      const status = formatStatus({
        sessionActive,
        // TODO: 從 claude-mem API 取得 context usage
        contextUsage: undefined,
        lastActivity: new Date(),
      });

      let message = status;
      if (sessionInfo) {
        message += `\n\nSession Info:\n\`${sessionInfo}\``;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      logger.error('/status 命令執行失敗', { error });
      await ctx.reply('❌ 執行命令時發生錯誤');
    }
  }

  /**
   * /reset 命令
   */
  async handleReset(ctx: Context): Promise<void> {
    logger.info('使用者執行 /reset 命令', { userId: ctx.from?.id });

    try {
      await ctx.reply('⚠️ 正在重置 Claude Code session...');

      // 發送 /clear 命令
      await this.tmuxManager.sendKeys('/clear');

      // 等待一下讓命令執行
      await new Promise((resolve) => setTimeout(resolve, 2000));

      await ctx.reply('✅ Claude Code session 已重置');

      logger.info('Session 重置成功', { userId: ctx.from?.id });
    } catch (error) {
      logger.error('/reset 命令執行失敗', { error });
      await ctx.reply('❌ 重置失敗');
    }
  }
}
