# Storage Layer - 資料持久化模組

本模組負責 Telegram Claude Bot 的資料持久化，包含 SQLite 資料庫與檔案系統整合。

## 模組架構

```
storage/
├── db.ts              # 資料庫初始化與連線管理
├── conversation.ts    # 對話記錄 CRUD 操作
├── output.ts          # 輸出儲存管理
├── index.ts           # 統一匯出
└── __test__.ts        # 測試腳本
```

## 核心功能

### 1. 資料庫管理 (`db.ts`)

#### 初始化資料庫

```typescript
import { initDatabase } from './storage'

const db = initDatabase()
```

自動建立：
- `data/db.sqlite` 檔案
- `conversations` 表
- 索引（user_id + timestamp, timestamp）

#### 取得資料庫實例

```typescript
import { getDatabase } from './storage'

const db = getDatabase()
```

#### 關閉資料庫

```typescript
import { closeDatabase } from './storage'

closeDatabase()
```

#### 優化資料庫

```typescript
import { vacuumDatabase } from './storage'

vacuumDatabase()
```

### 2. 對話記錄管理 (`conversation.ts`)

#### 儲存對話記錄

```typescript
import { saveConversation } from './storage'

const conversation = saveConversation({
  user_id: 123456789,
  question: '什麼是 TypeScript？',
  summary: 'TypeScript 是 JavaScript 的超集，增加了型別系統。',
  full_output: 'This is a short output.',
  // full_output_path: 'data/outputs/output-123.txt' // 若輸出儲存為檔案
})

console.log('對話 ID:', conversation.id)
```

#### 取得最新對話

```typescript
import { getLatestConversation } from './storage'

const latest = getLatestConversation(123456789)

if (latest) {
  console.log('最新問題:', latest.question)
  console.log('摘要:', latest.summary)
}
```

#### 根據 ID 取得對話

```typescript
import { getConversationById } from './storage'

const conversation = getConversationById(1)

if (conversation) {
  console.log('問題:', conversation.question)
}
```

#### 取得使用者的所有對話

```typescript
import { getConversationsByUser } from './storage'

const conversations = getConversationsByUser(
  123456789,  // user_id
  50,         // limit (預設 50)
  0           // offset (預設 0)
)

conversations.forEach(conv => {
  console.log(`${conv.id}. ${conv.question}`)
})
```

#### 清理舊資料

```typescript
import { cleanOldData } from './storage'

const deletedCount = cleanOldData(30) // 清理超過 30 天的資料

console.log('已清理:', deletedCount, '筆')
```

#### 取得統計資訊

```typescript
import { getStats } from './storage'

const stats = getStats()

console.log('總對話數:', stats.totalConversations)
console.log('總使用者數:', stats.totalUsers)
console.log('最舊記錄:', new Date(stats.oldestTimestamp).toISOString())
console.log('最新記錄:', new Date(stats.newestTimestamp).toISOString())
```

### 3. 輸出儲存管理 (`output.ts`)

#### 儲存輸出

根據輸出長度自動決定儲存方式：
- **≤ 5000 字元**：儲存在 SQLite
- **> 5000 字元**：儲存為檔案

```typescript
import { saveOutput } from './storage'

const output = 'Claude Code 的回應內容...'

const { full_output, full_output_path } = saveOutput(output)

if (full_output) {
  console.log('已儲存至資料庫')
} else if (full_output_path) {
  console.log('已儲存至檔案:', full_output_path)
}
```

#### 讀取輸出

自動判斷從資料庫或檔案讀取：

```typescript
import { getOutput } from './storage'

const conversation = getLatestConversation(123456789)

if (conversation) {
  const output = getOutput(
    conversation.full_output,
    conversation.full_output_path
  )

  console.log('完整輸出:', output)
}
```

#### 刪除輸出檔案

```typescript
import { deleteOutput } from './storage'

deleteOutput('data/outputs/output-123.txt')
```

#### 清理孤立檔案

清理資料庫中無對應記錄的輸出檔案：

```typescript
import { cleanOrphanedOutputs } from './storage'
import { getDatabase } from './storage'

const db = getDatabase()

const stmt = db.prepare('SELECT full_output_path FROM conversations WHERE full_output_path IS NOT NULL')
const rows = stmt.all() as Array<{ full_output_path: string }>
const validPaths = rows.map(row => row.full_output_path)

const deletedCount = cleanOrphanedOutputs(validPaths)

console.log('已清理孤立檔案:', deletedCount, '個')
```

## 資料結構

### Conversation 型別

```typescript
interface Conversation {
  id: number
  user_id: number
  question: string
  summary: string | null
  full_output: string | null
  full_output_path: string | null
  timestamp: number
}
```

### ConversationInput 型別

```typescript
interface ConversationInput {
  user_id: number
  question: string
  summary?: string
  full_output?: string
  full_output_path?: string
}
```

## 環境變數

```env
# 資料庫配置
DB_PATH=./data/db.sqlite
OUTPUT_DIR=./data/outputs

# 資料保留
DATA_RETENTION_DAYS=30
```

## 完整範例

```typescript
import {
  initDatabase,
  saveConversation,
  getLatestConversation,
  saveOutput,
  getOutput,
  cleanOldData,
  closeDatabase
} from './storage'

async function example() {
  try {
    initDatabase()

    const userQuestion = '什麼是 TypeScript？'
    const claudeResponse = 'TypeScript 是 JavaScript 的超集，增加了型別系統...'
    const summary = 'TypeScript 是 JavaScript 的超集，增加了型別系統。'

    const { full_output, full_output_path } = saveOutput(claudeResponse)

    const conversation = saveConversation({
      user_id: 123456789,
      question: userQuestion,
      summary,
      full_output,
      full_output_path
    })

    console.log('對話已儲存，ID:', conversation.id)

    const latest = getLatestConversation(123456789)

    if (latest) {
      const fullOutput = getOutput(latest.full_output, latest.full_output_path)
      console.log('完整回應:', fullOutput)
    }

    const deletedCount = cleanOldData(30)
    console.log('已清理:', deletedCount, '筆舊資料')

  } catch (error) {
    console.error('錯誤:', error)
  } finally {
    closeDatabase()
  }
}

example()
```

## 測試

執行測試腳本：

```bash
npx ts-node src/storage/__test__.ts
```

## 錯誤處理

所有函式都包含完整的錯誤處理：

- 資料庫初始化失敗：拋出錯誤並顯示詳細訊息
- 檔案操作失敗：拋出錯誤並記錄日誌
- SQL 執行失敗：拋出錯誤並顯示 SQL 錯誤訊息

建議在應用層使用 try-catch 捕獲錯誤：

```typescript
try {
  const conversation = saveConversation({ ... })
} catch (error) {
  console.error('儲存對話失敗:', error)
  // 回傳錯誤給使用者
}
```

## 效能考量

- **索引優化**：`user_id + timestamp` 複合索引加速查詢
- **檔案分割**：大型輸出自動儲存為檔案，避免資料庫膨脹
- **定期清理**：建議每日執行 `cleanOldData()` 刪除舊資料
- **VACUUM**：定期執行 `vacuumDatabase()` 優化資料庫空間

## 安全性

- **SQL Injection 防護**：使用 prepared statements
- **檔案路徑驗證**：檢查檔案存在性
- **資料庫權限**：建議設定 `chmod 600` 限制存取
- **環境變數保護**：敏感設定存放在 `.env` 檔案

## 未來擴充

- [ ] 支援全文搜尋（FTS5）
- [ ] 支援資料匯出（JSON, CSV）
- [ ] 支援資料加密
- [ ] 支援多使用者分頁查詢
- [ ] 支援 PostgreSQL（production 環境）
