# 部署指南

## 快速開始

### 1. 前置準備

確認以下工具已安裝：

```bash
# 檢查 Node.js（需要 >= 18）
node --version

# 檢查 tmux
tmux -V

# 檢查 Claude Code CLI
claude --version
```

### 2. 配置 .env

建立 `.env` 檔案：

```bash
cp .env.example .env
```

編輯 `.env`，填入你的配置：

| 環境變數 | 說明 | 範例 |
|---------|------|------|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot Token | `123456:ABC-DEF...` |
| `ALLOWED_USER_IDS` | 允許的使用者 ID（逗號分隔） | `123456789,987654321` |
| `ANTHROPIC_API_KEY` | Anthropic API Key | `sk-ant-xxx` |

### 3. 安裝依賴

```bash
npm install
```

### 4. 編譯

```bash
npm run build
```

### 5. 測試運行

```bash
npm start
```

### 6. 在 Telegram 測試

1. 在 Telegram 中找到你的 Bot
2. 發送 `/start`
3. 發送 `/ask 你好`
4. 等待摘要回應

---

## PM2 生產環境部署

### 安裝 PM2

```bash
npm install -g pm2
```

### 啟動 Bot

```bash
pm2 start dist/index.js --name telegram-claude-bot
```

### 設定開機自動啟動

```bash
pm2 startup
pm2 save
```

### 常用 PM2 命令

```bash
# 查看狀態
pm2 status

# 查看日誌
pm2 logs telegram-claude-bot

# 即時日誌
pm2 logs telegram-claude-bot --lines 100

# 重啟
pm2 restart telegram-claude-bot

# 停止
pm2 stop telegram-claude-bot

# 刪除
pm2 delete telegram-claude-bot
```

---

## 環境變數詳解

### Telegram 配置

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

取得方式：
1. 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)
2. 發送 `/newbot`
3. 按照指示設定 bot 名稱和 username
4. 複製收到的 Token

```env
ALLOWED_USER_IDS=123456789
```

取得方式：
1. 在 Telegram 中找到 [@userinfobot](https://t.me/userinfobot)
2. 發送任意訊息
3. 複製收到的 ID

### Anthropic API 配置

```env
ANTHROPIC_API_KEY=sk-ant-xxx
```

取得方式：
1. 前往 [Anthropic Console](https://console.anthropic.com/)
2. 建立 API Key
3. 複製 Key

### tmux 配置

```env
TMUX_SESSION_NAME=claude-tg-bot
CLAUDE_COMMAND=claude --dangerously-skip-permissions
```

- `TMUX_SESSION_NAME`：tmux session 的名稱（可自訂）
- `CLAUDE_COMMAND`：啟動 Claude Code 的命令

⚠️ **安全性警告**：`--dangerously-skip-permissions` 會跳過所有權限檢查，僅在完全信任的環境使用。

### 監控配置

```env
POLL_INTERVAL=2000
CONTEXT_CHECK_INTERVAL=30000
CONTEXT_THRESHOLD=0.8
HEALTH_CHECK_INTERVAL=10000
```

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `POLL_INTERVAL` | 輪詢 tmux pane 的間隔（毫秒） | 2000 |
| `CONTEXT_CHECK_INTERVAL` | 檢查 context window 的間隔（毫秒） | 30000 |
| `CONTEXT_THRESHOLD` | 觸發 compact 的閾值（0-1） | 0.8 |
| `HEALTH_CHECK_INTERVAL` | 健康檢查間隔（毫秒） | 10000 |

### 資料配置

```env
DB_PATH=./data/db.sqlite
OUTPUT_DIR=./data/outputs
DATA_RETENTION_DAYS=30
```

| 變數 | 說明 | 預設值 |
|------|------|--------|
| `DB_PATH` | SQLite 資料庫路徑 | `./data/db.sqlite` |
| `OUTPUT_DIR` | 輸出檔案目錄 | `./data/outputs` |
| `DATA_RETENTION_DAYS` | 資料保留天數 | 30 |

---

## 疑難排解

### Bot 無法啟動

**症狀**：執行 `npm start` 後立即退出

**可能原因**：
1. 環境變數未設定
2. Telegram Bot Token 無效
3. Anthropic API Key 無效

**解決方法**：
```bash
# 檢查日誌
cat logs/bot-*.log

# 確認 .env 檔案存在
ls -la .env

# 測試環境變數載入
node -e "require('dotenv').config(); console.log(process.env.TELEGRAM_BOT_TOKEN)"
```

### tmux session 無法建立

**症狀**：Bot 啟動但無法回應

**可能原因**：
1. tmux 未安裝
2. Claude Code CLI 未安裝
3. 權限不足

**解決方法**：
```bash
# 檢查 tmux
which tmux

# 檢查 Claude Code
which claude

# 手動測試建立 session
tmux new -d -s test-claude 'claude --dangerously-skip-permissions'
tmux ls
tmux kill-session -t test-claude
```

### 摘要生成失敗

**症狀**：收到「摘要生成失敗」訊息

**可能原因**：
1. Anthropic API Key 無效
2. API 額度不足
3. 網路連線問題

**解決方法**：
```bash
# 測試 API Key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Context Monitor 無法運作

**症狀**：沒有收到自動 compact 通知

**可能原因**：
1. claude-mem plugin 未安裝
2. claude-mem API 未啟動

**解決方法**：
```bash
# 測試 claude-mem API
curl http://localhost:37777/api/status

# 如果無回應，檢查 claude-mem plugin
claude plugin list

# 安裝 claude-mem（如果未安裝）
claude plugin install claude-mem --scope user
```

---

## 監控與維護

### 查看日誌

```bash
# PM2 日誌
pm2 logs telegram-claude-bot

# 檔案日誌
tail -f logs/bot-$(date +%Y-%m-%d).log
```

### 檢查資料庫

```bash
# 進入資料庫
sqlite3 data/db.sqlite

# 查看對話數量
SELECT COUNT(*) FROM conversations;

# 查看最近 10 筆對話
SELECT id, user_id, question, timestamp FROM conversations ORDER BY timestamp DESC LIMIT 10;

# 退出
.quit
```

### 清理舊資料

```bash
# 手動執行清理（清理超過 30 天的資料）
node -e "
const { initDatabase } = require('./dist/storage/db.js');
const { cleanOldData } = require('./dist/storage/conversation.js');
initDatabase();
const count = cleanOldData(30);
console.log(\`已清理 \${count} 筆資料\`);
"
```

### 備份資料

```bash
# 建立備份目錄
mkdir -p backups/$(date +%Y%m%d)

# 備份資料庫
cp data/db.sqlite backups/$(date +%Y%m%d)/

# 備份輸出檔案
cp -r data/outputs backups/$(date +%Y%m%d)/

# 壓縮備份
tar -czf backups/backup-$(date +%Y%m%d).tar.gz backups/$(date +%Y%m%d)/
```

---

## 效能優化

### 調整輪詢間隔

如果遇到效能問題，可以調整輪詢間隔：

```env
# 預設：2 秒輪詢一次
POLL_INTERVAL=2000

# 較慢的輪詢（節省 CPU）
POLL_INTERVAL=5000

# 較快的輪詢（更即時）
POLL_INTERVAL=1000
```

### 調整 context 檢查間隔

```env
# 預設：30 秒檢查一次
CONTEXT_CHECK_INTERVAL=30000

# 較少檢查（節省 API 請求）
CONTEXT_CHECK_INTERVAL=60000

# 較頻繁檢查（更及時 compact）
CONTEXT_CHECK_INTERVAL=15000
```

### 調整資料保留天數

```env
# 預設：保留 30 天
DATA_RETENTION_DAYS=30

# 保留更短時間（節省空間）
DATA_RETENTION_DAYS=7

# 保留更長時間
DATA_RETENTION_DAYS=90
```

---

## 安全性最佳實踐

1. **環境變數保護**
   - 永遠不要將 `.env` 提交到 Git
   - 使用 `.env.example` 作為範本

2. **User ID 白名單**
   - 定期檢查 `ALLOWED_USER_IDS`
   - 移除不再需要的使用者

3. **API Key 輪換**
   - 定期更新 Telegram Bot Token
   - 定期更新 Anthropic API Key

4. **權限管理**
   - 確認 `data/` 目錄權限為 700
   - 確認 `.env` 檔案權限為 600

```bash
chmod 700 data
chmod 600 .env
```

5. **日誌管理**
   - 定期清理舊日誌
   - 不要在日誌中記錄敏感資訊

---

## 更新與升級

### 更新專案

```bash
# 拉取最新程式碼
git pull origin main

# 安裝新依賴
npm install

# 重新編譯
npm run build

# 重啟 Bot
pm2 restart telegram-claude-bot
```

### 更新依賴套件

```bash
# 檢查過期套件
npm outdated

# 更新套件
npm update

# 重新編譯和重啟
npm run build && pm2 restart telegram-claude-bot
```

---

## 常見問題

### Q: 如何支援多個使用者？

A: 在 `.env` 中用逗號分隔多個 User ID：

```env
ALLOWED_USER_IDS=123456789,987654321,111222333
```

### Q: 如何更改 Bot 名稱？

A: 在 Telegram 中找到 [@BotFather](https://t.me/BotFather)，發送 `/setname`，選擇你的 Bot，輸入新名稱。

### Q: 如何停用自動 compact？

A: 將 `CONTEXT_THRESHOLD` 設為 1（永遠不會觸發）：

```env
CONTEXT_THRESHOLD=1.0
```

### Q: 如何停用自動重啟？

A: 目前沒有開關，但可以調整健康檢查間隔到很長：

```env
HEALTH_CHECK_INTERVAL=3600000  # 1 小時
```

或直接修改程式碼註解掉 RestartService。

### Q: 如何匯出所有對話？

A: 使用 SQLite 命令匯出：

```bash
sqlite3 data/db.sqlite <<EOF
.headers on
.mode csv
.output conversations.csv
SELECT * FROM conversations;
.quit
EOF
```

---

## 支援

遇到問題？請：
1. 查看日誌：`pm2 logs telegram-claude-bot`
2. 查看 GitHub Issues：[jerrycela/projecttelegram/issues](https://github.com/jerrycela/projecttelegram/issues)
3. 提交新 Issue 並附上錯誤訊息和環境資訊
