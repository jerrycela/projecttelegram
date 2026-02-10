# Telegram Claude Code Remote Control - 設計文件

**日期**：2026-02-10
**專案**：telegram-claude-bot
**GitHub**：https://github.com/jerrycela/projecttelegram

---

## 專案概述

建立一個 Telegram Bot，讓使用者能夠透過手機遠端操作本機上運行的 Claude Code，實現長時間互動對話。

### 核心目標

- 透過 Telegram 隨時隨地與本機的 Claude Code 互動
- 保持完整的對話上下文（像在終端機前一樣使用）
- 簡潔的摘要回應（適合手機閱讀），同時能查看完整輸出
- 支援長時間連續對話，自動管理 context window

---

## 設計決策

### 1. Session 管理方式

**選擇**：tmux + `claude --dangerously-skip-permissions`

**理由**：
- 保留 Claude Code 的完整工具能力（File operations, MCP servers, etc.）
- 可以捕獲完整的輸出流
- 支援 session 接管（重啟後恢復）

**替代方案考慮**：
- ❌ 直接使用 Anthropic API：無法使用 Claude Code 的工具和 MCP servers
- ❌ 混合方案：增加複雜度，收益不明顯

### 2. 回應策略

**選擇**：等待完整回應後生成摘要

**流程**：
1. 使用者發送問題
2. 發送到 tmux session
3. 輪詢監控輸出（每 2 秒）
4. 偵測回應結束（`> ` 或 `claude>` prompt）
5. 生成摘要（Claude Haiku 4.5 API）
6. 傳送摘要到 Telegram
7. 完整輸出儲存到資料庫/檔案

**摘要格式**：繁體中文，2-3 句話重點

**替代方案考慮**：
- ❌ 即時串流：Telegram API 編輯訊息有頻率限制
- ❌ 分段回應：可能訊息過多，不適合手機

### 3. Context Window 管理

**選擇**：自動監控 + `/compact`

**機制**：
- 透過 claude-mem API (`localhost:37777`) 監控 context window 使用率
- 接近上限（例如 80%）時自動執行 `/compact`
- 推送 Telegram 通知告知使用者
- 保留重要對話脈絡，只壓縮舊內容

**手動命令**：
- `/reset` - 手動清除 session（執行 `/clear`）

**替代方案考慮**：
- ❌ `/clear`：會清除所有對話歷史，不保留脈絡
- ❌ 多 session 模式：初期不需要，可未來擴充

### 4. 安全性設計

**認證機制**：Telegram User ID 白名單

**Session 處理**：
- Bot 啟動時若偵測到現有 tmux session，直接接管
- 支援重啟後恢復對話

**指令信任**：
- 完全信任白名單使用者（單一使用者在自己機器上）
- 不建立指令黑名單（避免誤判）

**使用 `execFile()` 而非 `exec()`**：
- 防止 shell 命令注入攻擊
- 所有 tmux 指令使用陣列參數

### 5. 資料持久化

**儲存方案**：SQLite + 檔案系統

**SQLite Schema**：
```sql
CREATE TABLE conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  summary TEXT,
  full_output TEXT,
  full_output_path TEXT,
  timestamp INTEGER NOT NULL
);
```

**檔案儲存規則**：
- 輸出 > 5000 字元：儲存為檔案 (`data/outputs/output-{timestamp}.txt`)
- 輸出 ≤ 5000 字元：直接儲存在 SQLite

**自動清理**：
- 保留最近 30 天的資料
- 檔案與資料庫記錄同步刪除
- 每日檢查一次（凌晨 3 點）

---

## 系統架構

```
Telegram 使用者
    ↓
Telegram Bot (Telegraf)
    ├─ User Authentication (白名單)
    ├─ Command Handler (/ask, /detail, /status, /reset)
    └─ Response Formatter (摘要生成)
    ↓
tmux Manager ←→ Output Monitor ←→ Context Monitor
    ├─ Session Management    ├─ Pane Capture          ├─ claude-mem API
    ├─ Send Input            ├─ Diff Detection        └─ Auto /compact
    └─ Auto Restart          └─ Summarization
    ↓
tmux session: claude-tg-bot
    └─ pane 0: claude --dangerously-skip-permissions
    ↓
Storage Layer
    ├─ SQLite (metadata, short outputs)
    └─ File System (long outputs)
```

---

## 核心模組

### 1. tmux Manager (`src/tmux/manager.ts`)

**職責**：
- 建立/檢查 tmux session
- 發送輸入到 Claude Code
- 捕獲輸出（`tmux capture-pane`）
- 終止 session

**關鍵方法**：
```typescript
class TmuxManager {
  async ensureSession(): Promise<void>
  async sendKeys(text: string): Promise<void>
  async capturePane(): Promise<string>
  async killSession(): Promise<void>
  async sessionExists(): Promise<boolean>
}
```

**安全性**：使用 `execFile()` 防止命令注入

### 2. Output Monitor (`src/monitor/output-monitor.ts`)

**職責**：
- 輪詢 tmux pane（每 2 秒）
- 偵測輸出變化
- 偵測回應結束（prompt 出現）
- 觸發摘要生成

**回應結束標誌**：
- `> ` （標準 Claude prompt）
- `claude>` （自訂 prompt）
- 超時機制（30 秒無變化）

### 3. Summarizer (`src/monitor/summarizer.ts`)

**職責**：
- 呼叫 Claude Haiku 4.5 API
- 生成繁體中文摘要（2-3 句話）
- 錯誤處理（API 失敗時返回前 500 字元）

**API 配置**：
- Model: `claude-haiku-4-5`
- Max tokens: 500
- Temperature: 0.3（保持一致性）

### 4. Telegram Bot (`src/bot/`)

**Commands**：
- `/start` - 歡迎訊息
- `/ask <question>` - 發送問題給 Claude
- `/detail` - 查看最新完整輸出
- `/status` - 查看 Claude Code 狀態（context usage, session info）
- `/reset` - 手動清除 session

**Middleware**：
- User ID 白名單認證
- 請求速率限制（避免濫用）

### 5. Context Monitor (`src/services/context-monitor.ts`)

**職責**：
- 每 30 秒查詢 `localhost:37777/api/status`
- 監控 context window 使用率
- 達到 80% 時自動執行 `/compact`
- 推送 Telegram 通知

### 6. Health Check & Restart (`src/services/restart-service.ts`)

**職責**：
- 每 10 秒檢查 tmux session 健康狀態
- 異常時自動重啟
- 最多重試 3 次
- 推送 Telegram 通知

---

## 資料流程

### 正常對話流程

```
1. 使用者在 Telegram 發送：/ask 什麼是 TypeScript?
2. Bot 接收，驗證 User ID
3. tmuxManager.sendKeys("什麼是 TypeScript?")
4. OutputMonitor 開始輪詢
5. 偵測到輸出變化，繼續監控
6. 偵測到 prompt 出現（回應結束）
7. 呼叫 Summarizer.summarize(fullOutput)
8. 儲存到 SQLite/File
9. 回傳摘要到 Telegram
10. 停止監控，等待下一個問題
```

### Context Window 管理流程

```
1. ContextMonitor 每 30 秒查詢 claude-mem API
2. 發現 context usage = 82%
3. tmuxManager.sendKeys("/compact")
4. 等待 compact 完成
5. 推送 Telegram 通知："✅ Context window 已壓縮（82% → 45%）"
```

### 自動重啟流程

```
1. HealthCheck 發現 tmux session 不存在
2. RestartService.restart()
3. 推送通知："⚠️ Claude Code session 異常，正在重啟..."
4. killSession() → ensureSession()
5. 推送通知："✅ Claude Code session 已重啟"
```

---

## 技術棧

| 項目 | 技術選型 | 版本 |
|------|---------|------|
| 執行環境 | Node.js | >= 18 |
| 語言 | TypeScript | >= 5.0 |
| Telegram 框架 | Telegraf | >= 4.0 |
| AI API | @anthropic-ai/sdk | >= 0.30 |
| 資料庫 | better-sqlite3 | >= 11.0 |
| 環境變數 | dotenv | >= 16.0 |
| 程序管理 | PM2 | >= 5.0 |

---

## 環境變數

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token_here
ALLOWED_USER_IDS=123456789

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxx

# tmux 配置
TMUX_SESSION_NAME=claude-tg-bot
CLAUDE_COMMAND=claude --dangerously-skip-permissions

# 資料庫配置
DB_PATH=./data/db.sqlite
OUTPUT_DIR=./data/outputs

# 監控配置
POLL_INTERVAL=2000
CONTEXT_CHECK_INTERVAL=30000
CONTEXT_THRESHOLD=0.8
HEALTH_CHECK_INTERVAL=10000

# 資料保留
DATA_RETENTION_DAYS=30
```

---

## 錯誤處理策略

### tmux Session 異常

- 自動重啟（最多 3 次）
- 推送 Telegram 通知
- 記錄錯誤日誌

### Claude API 失敗

- 摘要失敗：返回前 500 字元
- Retry 機制（指數退避，最多 3 次）

### Telegram API 失敗

- 訊息過長：分段發送（4000 字元一段）
- 速率限制：排隊機制

### 資料庫錯誤

- 寫入失敗：記錄到檔案系統
- 讀取失敗：返回錯誤訊息

---

## 安全性檢查清單

- [x] Telegram User ID 白名單驗證
- [x] 使用 `execFile()` 防止命令注入
- [x] 環境變數保護（`.env` 不提交）
- [x] SQLite 檔案權限限制（600）
- [x] API 金鑰不暴露在程式碼中
- [x] Telegram API 請求節流

---

## 成本估算

**Claude API (Haiku 4.5)**：
- 輸入：$0.25 per 1M tokens
- 輸出：$1.25 per 1M tokens

**預估每月成本**（假設每天 50 次對話）：
- 輸入：50 × 30 × 3000 tokens ≈ 4.5M tokens → $1.13
- 輸出：50 × 30 × 200 tokens ≈ 0.3M tokens → $0.38
- **總計：~$1.5/月**

---

## 未來擴充方向

1. **多 session 支援**：`/switch <session-name>` 切換不同專案
2. **檔案傳輸**：支援上傳截圖、下載產生的檔案
3. **語音輸入**：整合 Telegram 語音轉文字
4. **Web Dashboard**：視覺化監控介面
5. **智慧摘要**：根據使用者偏好客製化摘要風格

---

## 參考資料

- [Telegraf 官方文件](https://telegraf.js.org/)
- [Anthropic API 文件](https://docs.anthropic.com/)
- [tmux 手冊](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [Claude Code 文件](https://docs.claude.ai/claude-code)
