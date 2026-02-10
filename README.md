# Telegram Claude Code Remote Control

透過 Telegram Bot 遠端操作本機上運行的 Claude Code，實現長時間互動對話。

## 功能特色

- ✅ **遠端控制**：透過 Telegram 隨時隨地與本機的 Claude Code 互動
- ✅ **智慧摘要**：使用 Claude Haiku 4.5 生成簡潔的繁體中文摘要
- ✅ **完整輸出**：可查看 Claude Code 的完整回應
- ✅ **自動 Compact**：監控 context window，接近上限時自動壓縮
- ✅ **健康監控**：定期檢查 tmux session，異常時自動重啟
- ✅ **資料持久化**：SQLite + 檔案系統儲存對話歷史
- ✅ **安全認證**：Telegram User ID 白名單驗證

## 系統需求

- Node.js >= 18
- tmux
- Claude Code CLI
- Telegram Bot Token
- Anthropic API Key

## 安裝步驟

### 1. Clone 專案

```bash
git clone https://github.com/jerrycela/projecttelegram.git
cd projecttelegram
```

### 2. 安裝依賴

```bash
npm install
```

### 3. 配置環境變數

複製 `.env.example` 並重命名為 `.env`：

```bash
cp .env.example .env
```

編輯 `.env` 檔案，填入你的配置：

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here
ALLOWED_USER_IDS=123456789

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxx

# tmux Configuration
TMUX_SESSION_NAME=claude-tg-bot
CLAUDE_COMMAND=claude --dangerously-skip-permissions

# Database Configuration
DB_PATH=./data/db.sqlite
OUTPUT_DIR=./data/outputs

# Monitoring Configuration
POLL_INTERVAL=2000
CONTEXT_CHECK_INTERVAL=30000
CONTEXT_THRESHOLD=0.8
HEALTH_CHECK_INTERVAL=10000

# Data Retention
DATA_RETENTION_DAYS=30

# Logging
LOG_LEVEL=info
```

### 4. 取得 Telegram Bot Token

1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 發送 `/newbot` 建立新 bot
3. 按照指示設定 bot 名稱和 username
4. 複製收到的 Token 到 `.env` 的 `TELEGRAM_BOT_TOKEN`

### 5. 取得你的 Telegram User ID

1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 發送任意訊息
3. 複製收到的 ID 到 `.env` 的 `ALLOWED_USER_IDS`

### 6. 編譯專案

```bash
npm run build
```

### 7. 啟動 Bot

```bash
npm start
```

## 使用指南

### 可用命令

| 命令 | 說明 |
|------|------|
| `/start` | 顯示歡迎訊息和可用命令 |
| `/ask <問題>` | 向 Claude Code 提問 |
| `/detail` | 查看最新完整輸出 |
| `/status` | 查看 Claude Code 狀態 |
| `/reset` | 重置 Claude Code session（執行 `/clear`） |

### 使用範例

1. **提問**

```
/ask 什麼是 TypeScript?
```

Bot 會：
- 將問題發送到 Claude Code
- 等待回應完成
- 生成簡潔的繁體中文摘要
- 傳送摘要給你

2. **查看完整輸出**

```
/detail
```

Bot 會傳送最近一次對話的完整 Claude Code 回應。

3. **檢查狀態**

```
/status
```

Bot 會顯示 Claude Code session 的狀態資訊。

4. **重置 Session**

```
/reset
```

Bot 會執行 `/clear` 清除對話歷史。

## 自動化功能

### 自動 Compact

- 每 30 秒檢查一次 context window 使用率（透過 claude-mem API）
- 達到 80% 時自動執行 `/compact`
- 推送 Telegram 通知告知壓縮前後的使用率

### 自動重啟

- 每 10 秒檢查一次 tmux session 健康狀態
- 連續 3 次檢查失敗時自動重啟
- 推送 Telegram 通知告知重啟狀態
- 限制每小時最多重啟 3 次

### 自動清理

- 每天凌晨 3 點自動清理超過 30 天的舊資料
- 刪除資料庫記錄和對應的輸出檔案

## 使用 PM2 管理

推薦使用 PM2 來管理 Bot 進程：

### 安裝 PM2

```bash
npm install -g pm2
```

### 啟動 Bot

```bash
pm2 start dist/index.js --name telegram-claude-bot
```

### 查看狀態

```bash
pm2 status
```

### 查看日誌

```bash
pm2 logs telegram-claude-bot
```

### 重啟 Bot

```bash
pm2 restart telegram-claude-bot
```

### 停止 Bot

```bash
pm2 stop telegram-claude-bot
```

### 開機自動啟動

```bash
pm2 startup
pm2 save
```

## 專案結構

```
telegram-claude-bot/
├── src/
│   ├── index.ts                    # 主程式進入點
│   ├── bot/
│   │   ├── bot.ts                  # Telegraf bot 初始化
│   │   ├── commands.ts             # 命令處理器
│   │   ├── middleware.ts           # 認證中介軟體
│   │   └── formatter.ts            # 回應格式化工具
│   ├── tmux/
│   │   └── manager.ts              # tmux session 管理
│   ├── monitor/
│   │   ├── output-monitor.ts       # 輸出監控
│   │   ├── diff-detector.ts        # 差異偵測
│   │   └── summarizer.ts           # 摘要生成
│   ├── storage/
│   │   ├── db.ts                   # SQLite 初始化
│   │   ├── conversation.ts         # 對話記錄 CRUD
│   │   └── output.ts               # 輸出檔案管理
│   ├── services/
│   │   ├── context-monitor.ts      # Context window 監控
│   │   ├── health-check.ts         # 健康檢查
│   │   └── restart-service.ts      # 自動重啟服務
│   └── utils/
│       ├── logger.ts               # 日誌工具
│       ├── config.ts               # 配置管理
│       └── errors.ts               # 錯誤處理
├── config/
├── data/
│   ├── db.sqlite                   # SQLite 資料庫
│   └── outputs/                    # 完整輸出檔案目錄
├── logs/                           # 日誌目錄
└── docs/
    └── plans/                      # 設計文件
```

## 常見問題

### Q: Bot 沒有回應？

A: 檢查以下項目：
1. 確認 Bot 正在運行：`pm2 status` 或 `ps aux | grep node`
2. 檢查日誌：`pm2 logs telegram-claude-bot` 或查看 `logs/` 目錄
3. 確認 tmux session 存在：`tmux ls`
4. 確認你的 User ID 在白名單中

### Q: 摘要生成失敗？

A: 可能原因：
1. Anthropic API Key 無效或額度不足
2. 網路連線問題
3. Claude API 暫時無法使用

Bot 會自動返回前 500 字元作為備用摘要。

### Q: tmux session 無法建立？

A: 確認：
1. tmux 已安裝：`which tmux`
2. Claude Code CLI 已安裝：`which claude`
3. `.env` 中的 `CLAUDE_COMMAND` 正確

### Q: Context window 監控無法運作？

A: 確認 claude-mem plugin 正在運行：
```bash
curl http://localhost:37777/api/status
```

如果無法連接，啟動 Claude Code 並確保 claude-mem plugin 已安裝。

### Q: 如何備份對話歷史？

A: 對話歷史儲存在：
- SQLite 資料庫：`data/db.sqlite`
- 輸出檔案：`data/outputs/*.txt`

定期備份這些檔案即可。

## 安全性說明

- ✅ 使用 Telegram User ID 白名單驗證
- ✅ 使用 `execFile()` 防止命令注入
- ✅ 環境變數保護（`.env` 不提交到 Git）
- ✅ SQLite 檔案權限限制
- ⚠️ 使用 `--dangerously-skip-permissions` 需謹慎（僅限信任環境）

## 成本估算

**Claude API (Haiku 4.5)**：
- 輸入：$0.25 per 1M tokens
- 輸出：$1.25 per 1M tokens

**預估每月成本**（假設每天 50 次對話）：
- ~$1.5/月

## 授權

MIT

## 貢獻

歡迎提交 Issue 和 Pull Request！

## 聯絡

- GitHub: [jerrycela/projecttelegram](https://github.com/jerrycela/projecttelegram)
