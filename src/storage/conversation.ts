import { getDatabase } from './db'

export interface Conversation {
  id: number
  user_id: number
  question: string
  summary: string | null
  full_output: string | null
  full_output_path: string | null
  timestamp: number
}

export interface ConversationInput {
  user_id: number
  question: string
  summary?: string
  full_output?: string
  full_output_path?: string
}

/**
 * 儲存對話記錄
 */
export function saveConversation(input: ConversationInput): Conversation {
  const db = getDatabase()

  try {
    const stmt = db.prepare(`
      INSERT INTO conversations (
        user_id, question, summary, full_output, full_output_path, timestamp
      ) VALUES (?, ?, ?, ?, ?, ?)
    `)

    const timestamp = Date.now()

    const result = stmt.run(
      input.user_id,
      input.question,
      input.summary ?? null,
      input.full_output ?? null,
      input.full_output_path ?? null,
      timestamp
    )

    const conversation: Conversation = {
      id: result.lastInsertRowid as number,
      user_id: input.user_id,
      question: input.question,
      summary: input.summary ?? null,
      full_output: input.full_output ?? null,
      full_output_path: input.full_output_path ?? null,
      timestamp
    }

    console.log(`✅ 對話記錄已儲存 (ID: ${conversation.id})`)

    return conversation
  } catch (error) {
    console.error('❌ 儲存對話記錄失敗:', error)
    throw new Error(`儲存對話記錄失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 取得最新的對話記錄
 */
export function getLatestConversation(userId: number): Conversation | null {
  const db = getDatabase()

  try {
    const stmt = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `)

    const row = stmt.get(userId) as Conversation | undefined

    return row ?? null
  } catch (error) {
    console.error('❌ 取得最新對話記錄失敗:', error)
    throw new Error(`取得最新對話記錄失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 根據 ID 取得對話記錄
 */
export function getConversationById(id: number): Conversation | null {
  const db = getDatabase()

  try {
    const stmt = db.prepare(`
      SELECT * FROM conversations
      WHERE id = ?
    `)

    const row = stmt.get(id) as Conversation | undefined

    return row ?? null
  } catch (error) {
    console.error('❌ 取得對話記錄失敗:', error)
    throw new Error(`取得對話記錄失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 取得使用者的所有對話記錄
 */
export function getConversationsByUser(
  userId: number,
  limit: number = 50,
  offset: number = 0
): Conversation[] {
  const db = getDatabase()

  try {
    const stmt = db.prepare(`
      SELECT * FROM conversations
      WHERE user_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `)

    const rows = stmt.all(userId, limit, offset) as Conversation[]

    return rows
  } catch (error) {
    console.error('❌ 取得使用者對話記錄失敗:', error)
    throw new Error(`取得使用者對話記錄失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 清理超過 N 天的舊資料
 */
export function cleanOldData(retentionDays: number = 30): number {
  const db = getDatabase()

  try {
    const cutoffTimestamp = Date.now() - retentionDays * 24 * 60 * 60 * 1000

    const stmt = db.prepare(`
      DELETE FROM conversations
      WHERE timestamp < ?
    `)

    const result = stmt.run(cutoffTimestamp)

    const deletedCount = result.changes

    if (deletedCount > 0) {
      console.log(`✅ 已清理 ${deletedCount} 筆超過 ${retentionDays} 天的舊資料`)
    } else {
      console.log(`ℹ️  無需清理資料（無超過 ${retentionDays} 天的記錄）`)
    }

    return deletedCount
  } catch (error) {
    console.error('❌ 清理舊資料失敗:', error)
    throw new Error(`清理舊資料失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 取得資料庫統計資訊
 */
export function getStats(): {
  totalConversations: number
  totalUsers: number
  oldestTimestamp: number | null
  newestTimestamp: number | null
} {
  const db = getDatabase()

  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM conversations')
    const totalRow = totalStmt.get() as { count: number }

    const usersStmt = db.prepare('SELECT COUNT(DISTINCT user_id) as count FROM conversations')
    const usersRow = usersStmt.get() as { count: number }

    const timeStmt = db.prepare('SELECT MIN(timestamp) as oldest, MAX(timestamp) as newest FROM conversations')
    const timeRow = timeStmt.get() as { oldest: number | null; newest: number | null }

    return {
      totalConversations: totalRow.count,
      totalUsers: usersRow.count,
      oldestTimestamp: timeRow.oldest,
      newestTimestamp: timeRow.newest
    }
  } catch (error) {
    console.error('❌ 取得資料庫統計失敗:', error)
    throw new Error(`取得資料庫統計失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}
