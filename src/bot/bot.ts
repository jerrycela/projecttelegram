import { Telegraf } from 'telegraf';
import { CommandHandler } from './commands.js';
import { authMiddleware, rateLimitMiddleware, errorMiddleware } from './middleware.js';
import { TmuxManager } from '../tmux/manager.js';
import { Summarizer } from '../monitor/summarizer.js';
import { Config } from '../utils/config.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger();

export class TelegramBot {
  private bot: Telegraf;
  private commandHandler: CommandHandler;
  private config: Config;

  constructor(config: Config, tmuxManager: TmuxManager, summarizer: Summarizer) {
    this.config = config;
    this.bot = new Telegraf(config.telegramBotToken);
    this.commandHandler = new CommandHandler(tmuxManager, summarizer, config);

    this.setupMiddleware();
    this.setupCommands();
  }

  /**
   * 設定中介軟體
   */
  private setupMiddleware(): void {
    // 錯誤處理（最外層）
    this.bot.use(errorMiddleware());

    // 認證
    this.bot.use(authMiddleware(this.config.allowedUserIds));

    // 速率限制
    this.bot.use(rateLimitMiddleware(10));

    logger.info('中介軟體設定完成');
  }

  /**
   * 設定命令處理器
   */
  private setupCommands(): void {
    this.bot.command('start', (ctx) => this.commandHandler.handleStart(ctx));
    this.bot.command('ask', (ctx) => this.commandHandler.handleAsk(ctx));
    this.bot.command('detail', (ctx) => this.commandHandler.handleDetail(ctx));
    this.bot.command('status', (ctx) => this.commandHandler.handleStatus(ctx));
    this.bot.command('reset', (ctx) => this.commandHandler.handleReset(ctx));

    // 處理未知命令
    this.bot.on('text', async (ctx) => {
      const text = ctx.message.text;

      // 如果是命令但不認識，提示使用者
      if (text.startsWith('/')) {
        await ctx.reply('❌ 未知的命令\n\n使用 /start 查看可用命令');
      } else {
        // 非命令文字，提示使用者使用 /ask
        await ctx.reply('請使用 /ask 命令來提問\n\n範例：/ask 什麼是 TypeScript?');
      }
    });

    logger.info('命令處理器設定完成');
  }

  /**
   * 啟動 bot
   */
  async start(): Promise<void> {
    try {
      logger.info('正在啟動 Telegram Bot...');

      // 啟動 bot（使用 long polling）
      await this.bot.launch();

      logger.info('✅ Telegram Bot 已啟動');

      // 優雅關閉
      process.once('SIGINT', () => this.stop('SIGINT'));
      process.once('SIGTERM', () => this.stop('SIGTERM'));
    } catch (error) {
      logger.error('啟動 Bot 失敗', { error });
      throw error;
    }
  }

  /**
   * 停止 bot
   */
  async stop(signal?: string): Promise<void> {
    logger.info(`收到 ${signal || '停止'} 訊號，正在關閉 Bot...`);
    this.bot.stop(signal);
    logger.info('✅ Telegram Bot 已停止');
  }

  /**
   * 取得 Telegraf 實例（用於測試或進階功能）
   */
  getBot(): Telegraf {
    return this.bot;
  }
}
