# Telegram Claude Code Remote Control - 專案完成

## 概述

成功實作了一個 Telegram Bot，讓使用者能夠透過手機遠端操作本機上運行的 Claude Code，實現長時間互動對話。

**專案資訊**：
- 日期：2026-02-10
- GitHub：https://github.com/jerrycela/projecttelegram
- 本地路徑：/Users/admin/telegram-claude-bot

## 核心功能

### 1. 遠端控制
- 透過 Telegram 隨時隨地與本機的 Claude Code 互動
- 保持完整的對話上下文（像在終端機前一樣使用）
- 簡潔的摘要回應（適合手機閱讀），同時能查看完整輸出

### 2. 智慧摘要
- 使用 Claude Haiku 4.5 API 生成繁體中文摘要（2-3 句話）
- 等待完整回應後生成摘要（確保準確性）
- 指數退避重試機制（最多 3 次）

### 3. 自動 Context 管理
- 透過 claude-mem API (`localhost:37777`) 監控 context window 使用率
- 達到 80% 時自動執行 `/compact`（而非 `/clear`）
- 推送 Telegram 通知告知壓縮前後的使用率
- 保留重要對話脈絡

### 4. 健康監控與自動重啟
- 每 10 秒檢查 tmux session 健康狀態
- 連續 3 次檢查失敗時自動重啟
- 限制每小時最多重啟 3 次
- 推送 Telegram 通知告知重啟狀態

### 5. 資料持久化
- SQLite 資料庫儲存對話記錄
- 超過 5000 字元的輸出儲存為檔案
- 每天凌晨 3 點自動清理超過 30 天的舊資料

## 技術架構

### 技術棧
- **執行環境**：Node.js >= 18
- **語言**：TypeScript >= 5.0
- **Telegram 框架**：Telegraf >= 4.0
- **AI API**：@anthropic-ai/sdk >= 0.30
- **資料庫**：better-sqlite3 >= 11.0
- **Session 管理**：tmux + `claude --dangerously-skip-permissions`

### 模組架構

```
telegram-claude-bot/
├── src/
│   ├── bot/                    # Telegram Bot 核心
│   │   ├── bot.ts              # Telegraf 初始化
│   │   ├── commands.ts         # 命令處理器
│   │   ├── middleware.ts       # 認證與速率限制
│   │   └── formatter.ts        # 回應格式化
│   ├── tmux/                   # tmux 整合
│   │   └── manager.ts          # Session 管理
│   ├── monitor/                # 輸出監控
│   │   ├── output-monitor.ts   # 輪詢監控
│   │   ├── diff-detector.ts    # 差異偵測
│   │   └── summarizer.ts       # 摘要生成
│   ├── storage/                # 資料持久化
│   │   ├── db.ts               # SQLite 初始化
│   │   ├── conversation.ts     # 對話記錄 CRUD
│   │   └── output.ts           # 輸出檔案管理
│   ├── services/               # 監控服務
│   │   ├── context-monitor.ts  # Context window 監控
│   │   ├── health-check.ts     # 健康檢查
│   │   └── restart-service.ts  # 自動重啟
│   └── utils/                  # 工具函式
│       ├── logger.ts           # 日誌系統
│       ├── config.ts           # 配置管理
│       └── errors.ts           # 錯誤處理
```

## 設計決策

### Session 管理：tmux + Claude Code
- **選擇理由**：保留 Claude Code 的完整工具能力（File operations, MCP servers）
- **安全性**：使用 `execFile()` 防止命令注入
- **可靠性**：支援 session 接管（重啟後恢復）

### 回應策略：等待完整回應
- **優點**：摘要最完整準確
- **缺點**：等待時間較長（10-30 秒）
- **替代方案**：即時串流（受 Telegram API 限制）

### Context 管理：自動 Compact
- **優點**：保留對話脈絡，只壓縮舊內容
- **對比**：`/clear` 會清除所有歷史
- **觸發條件**：context usage >= 80%

## 可用命令

| 命令 | 說明 |
|------|------|
| `/start` | 顯示歡迎訊息和可用命令 |
| `/ask <問題>` | 向 Claude Code 提問 |
| `/detail` | 查看最新完整輸出 |
| `/status` | 查看 Claude Code 狀態 |
| `/reset` | 重置 Claude Code session |

## 安全性設計

1. **認證**：Telegram User ID 白名單驗證
2. **命令注入防護**：使用 `execFile()` 而非 `exec()`
3. **環境變數保護**：`.env` 不提交到 Git
4. **SQL Injection 防護**：使用 prepared statements
5. **速率限制**：10 次請求/分鐘
6. **檔案權限限制**：SQLite 檔案權限 600

## 效能與成本

### 預估每月成本（假設每天 50 次對話）
- **Claude API (Haiku 4.5)**：~$1.5/月
  - 輸入：$0.25 per 1M tokens → $1.13
  - 輸出：$1.25 per 1M tokens → $0.38

### 系統資源
- **CPU**：輪詢監控（每 2 秒）消耗低
- **記憶體**：Node.js 進程 ~50-100 MB
- **磁碟**：SQLite + 輸出檔案，30 天清理一次

## 部署步驟

### 1. 配置環境變數
```bash
cd telegram-claude-bot
cp .env.example .env
# 編輯 .env 填入 Token 和 API Key
```

### 2. 安裝依賴
```bash
npm install
```

### 3. 編譯
```bash
npm run build
```

### 4. 使用 PM2 啟動（推薦）
```bash
pm2 start dist/index.js --name telegram-claude-bot
pm2 startup
pm2 save
```

### 5. 在 Telegram 測試
- 發送 `/start` 查看歡迎訊息
- 發送 `/ask 你好` 測試完整流程

## 關鍵學習

### 1. tmux 整合技巧
- 使用 `tmux capture-pane -S -3000` 捕獲最近 3000 行
- 使用 `tmux send-keys -t session text C-m` 發送輸入（C-m = Enter）
- 使用 `tmux has-session -t session` 檢查 session 是否存在

### 2. 回應結束偵測
- 偵測 `> ` 或 `claude>` prompt
- 超時機制：30 秒無變化視為結束
- 差異偵測：比對前後輸出變化

### 3. 資料儲存策略
- 短輸出（≤5000 字元）：SQLite
- 長輸出（>5000 字元）：檔案系統
- 建立索引：`(user_id, timestamp DESC)` 優化查詢

### 4. 錯誤處理模式
- 指數退避重試（API 失敗）
- 備用方案（摘要失敗時返回前 500 字元）
- 優雅降級（監控失敗時繼續運行）

## 未來擴充方向

1. **多 Session 支援**：`/switch <session-name>` 切換不同專案
2. **檔案傳輸**：支援上傳截圖、下載產生的檔案
3. **語音輸入**：整合 Telegram 語音轉文字
4. **群組支援**：多人協作（需要權限管理）
5. **Web Dashboard**：視覺化監控介面
6. **智慧摘要**：根據使用者偏好客製化摘要風格

## 專案統計

- **檔案數量**：28 個原始檔
- **程式碼行數**：4,659 行
- **編譯輸出**：20 個 JavaScript 檔案
- **團隊成員**：4 位（team-lead + 3 個 teammates）
- **開發時間**：約 2 小時（使用 multi-agent 並行開發）

## 標籤

#專案完成 #Telegram #ClaudeCode #NodeJS #TypeScript #RemoteControl #Automation
