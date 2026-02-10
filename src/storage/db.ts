import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'

const DB_PATH = process.env.DB_PATH || './data/db.sqlite'

let db: Database.Database | null = null

/**
 * 初始化 SQLite 資料庫連線
 * 建立 conversations 表
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db
  }

  try {
    const dbDir = dirname(DB_PATH)
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true })
    }

    db = new Database(DB_PATH)

    db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        question TEXT NOT NULL,
        summary TEXT,
        full_output TEXT,
        full_output_path TEXT,
        timestamp INTEGER NOT NULL
      )
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_user_timestamp
      ON conversations(user_id, timestamp DESC)
    `)

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_timestamp
      ON conversations(timestamp)
    `)

    console.log('✅ SQLite 資料庫初始化完成:', DB_PATH)

    return db
  } catch (error) {
    console.error('❌ SQLite 資料庫初始化失敗:', error)
    throw new Error(`資料庫初始化失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 取得資料庫實例
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

/**
 * 關閉資料庫連線
 */
export function closeDatabase(): void {
  if (db) {
    try {
      db.close()
      db = null
      console.log('✅ SQLite 資料庫連線已關閉')
    } catch (error) {
      console.error('❌ 關閉資料庫連線時發生錯誤:', error)
    }
  }
}

/**
 * 執行 VACUUM 優化資料庫
 */
export function vacuumDatabase(): void {
  const database = getDatabase()
  try {
    database.exec('VACUUM')
    console.log('✅ 資料庫 VACUUM 優化完成')
  } catch (error) {
    console.error('❌ 資料庫 VACUUM 失敗:', error)
    throw new Error(`資料庫優化失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}
