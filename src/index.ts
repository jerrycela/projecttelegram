import { loadConfig } from './utils/config.js';
import { getLogger } from './utils/logger.js';
import { initDatabase } from './storage/db.js';
import { TmuxManager } from './tmux/manager.js';
import { Summarizer } from './monitor/summarizer.js';
import { TelegramBot } from './bot/bot.js';
import { ContextMonitor } from './services/context-monitor.js';
import { RestartService } from './services/restart-service.js';
import { cleanOldData } from './storage/conversation.js';

const logger = getLogger();

async function main(): Promise<void> {
  try {
    logger.info('='.repeat(50));
    logger.info('Telegram Claude Code Remote Control 啟動中...');
    logger.info('='.repeat(50));

    // 1. 載入配置
    logger.info('[1/7] 載入配置...');
    const config = loadConfig();
    logger.info('✅ 配置載入完成', {
      telegramBotToken: config.telegramBotToken ? '已設定' : '未設定',
      allowedUsers: config.allowedUserIds.length,
      tmuxSession: config.tmuxSessionName,
    });

    // 2. 初始化資料庫
    logger.info('[2/7] 初始化資料庫...');
    initDatabase();

    // 3. 清理舊資料
    logger.info('[3/7] 清理舊資料...');
    const deletedCount = cleanOldData(config.dataRetentionDays);
    if (deletedCount > 0) {
      logger.info(`✅ 已清理 ${deletedCount} 筆超過 ${config.dataRetentionDays} 天的舊資料`);
    }

    // 4. 初始化 tmux manager
    logger.info('[4/7] 初始化 tmux manager...');
    const tmuxManager = new TmuxManager({
      sessionName: config.tmuxSessionName,
      claudeCommand: config.claudeCommand,
    });

    // 檢查是否有現有 session
    const sessionExists = await tmuxManager.sessionExists();
    if (sessionExists) {
      logger.info('✅ 偵測到現有 tmux session，將接管使用');
      const sessionInfo = await tmuxManager.getSessionInfo();
      logger.info(`Session Info: ${sessionInfo}`);
    } else {
      logger.info('建立新的 tmux session...');
      await tmuxManager.ensureSession();
      logger.info('✅ tmux session 已建立');
    }

    // 5. 初始化 Summarizer
    logger.info('[5/7] 初始化 Summarizer...');
    const summarizer = new Summarizer(config.anthropicApiKey);
    logger.info('✅ Summarizer 初始化完成');

    // 6. 初始化 Telegram Bot
    logger.info('[6/7] 初始化 Telegram Bot...');
    const bot = new TelegramBot(config, tmuxManager, summarizer);
    logger.info('✅ Telegram Bot 初始化完成');

    // 7. 啟動監控服務
    logger.info('[7/7] 啟動監控服務...');

    // Context Monitor
    const contextMonitor = new ContextMonitor(
      config.contextThreshold,
      config.contextCheckInterval
    );
    contextMonitor.start(
      tmuxManager,
      bot.getBot(),
      config.allowedUserIds[0] // 使用第一個允許的使用者 ID
    );
    logger.info('✅ Context Monitor 已啟動');

    // Restart Service (包含 Health Check)
    const restartService = new RestartService(config.healthCheckInterval);
    await restartService.monitor(
      tmuxManager,
      bot.getBot(),
      config.allowedUserIds[0]
    );
    logger.info('✅ Restart Service 已啟動');

    // 8. 啟動 Telegram Bot
    logger.info('啟動 Telegram Bot...');
    await bot.start();

    logger.info('='.repeat(50));
    logger.info('✅ 所有服務已啟動，Bot 正在運行');
    logger.info('='.repeat(50));

    // 9. 設定定時清理任務（每天凌晨 3 點）
    scheduleDataCleanup(config.dataRetentionDays);
  } catch (error) {
    logger.error('啟動失敗', { error });
    process.exit(1);
  }
}

/**
 * 排程資料清理任務
 */
function scheduleDataCleanup(retentionDays: number): void {
  const now = new Date();
  const nextCleanup = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    3,
    0,
    0,
    0
  );

  const msUntilNextCleanup = nextCleanup.getTime() - now.getTime();

  logger.info('排程資料清理任務', {
    nextCleanup: nextCleanup.toISOString(),
    msUntil: msUntilNextCleanup,
  });

  setTimeout(() => {
    logger.info('執行排程資料清理...');
    try {
      const deletedCount = cleanOldData(retentionDays);
      logger.info(`排程清理完成，已刪除 ${deletedCount} 筆資料`);
    } catch (error) {
      logger.error('排程清理失敗', { error });
    }

    // 排程下一次清理（24 小時後）
    setInterval(
      () => {
        try {
          const deletedCount = cleanOldData(retentionDays);
          logger.info(`排程清理完成，已刪除 ${deletedCount} 筆資料`);
        } catch (error) {
          logger.error('排程清理失敗', { error });
        }
      },
      24 * 60 * 60 * 1000
    );
  }, msUntilNextCleanup);
}

// 執行主程式
main();
