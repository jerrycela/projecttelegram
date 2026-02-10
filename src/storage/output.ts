import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const OUTPUT_DIR = process.env.OUTPUT_DIR || './data/outputs'
const MAX_DB_OUTPUT_LENGTH = 5000

/**
 * 確保輸出目錄存在
 */
function ensureOutputDir(): void {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true })
    console.log('✅ 輸出目錄已建立:', OUTPUT_DIR)
  }
}

/**
 * 產生輸出檔案路徑
 */
function generateOutputPath(timestamp: number): string {
  return join(OUTPUT_DIR, `output-${timestamp}.txt`)
}

/**
 * 儲存輸出
 * 若輸出長度 > 5000 字元，儲存為檔案並返回檔案路徑
 * 否則返回完整輸出文字
 */
export function saveOutput(output: string): {
  full_output: string | null
  full_output_path: string | null
} {
  try {
    if (output.length > MAX_DB_OUTPUT_LENGTH) {
      ensureOutputDir()

      const timestamp = Date.now()
      const filePath = generateOutputPath(timestamp)

      writeFileSync(filePath, output, 'utf-8')

      console.log(`✅ 輸出已儲存至檔案 (${output.length} 字元):`, filePath)

      return {
        full_output: null,
        full_output_path: filePath
      }
    } else {
      console.log(`✅ 輸出已儲存至資料庫 (${output.length} 字元)`)

      return {
        full_output: output,
        full_output_path: null
      }
    }
  } catch (error) {
    console.error('❌ 儲存輸出失敗:', error)
    throw new Error(`儲存輸出失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 讀取輸出
 * 根據 full_output 或 full_output_path 決定從資料庫或檔案讀取
 */
export function getOutput(
  full_output: string | null,
  full_output_path: string | null
): string {
  try {
    if (full_output) {
      return full_output
    }

    if (full_output_path) {
      if (!existsSync(full_output_path)) {
        throw new Error(`輸出檔案不存在: ${full_output_path}`)
      }

      const content = readFileSync(full_output_path, 'utf-8')
      console.log(`✅ 已從檔案讀取輸出 (${content.length} 字元):`, full_output_path)

      return content
    }

    throw new Error('無可用的輸出來源（full_output 和 full_output_path 皆為空）')
  } catch (error) {
    console.error('❌ 讀取輸出失敗:', error)
    throw new Error(`讀取輸出失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 刪除輸出檔案
 */
export function deleteOutput(full_output_path: string): void {
  try {
    if (!existsSync(full_output_path)) {
      console.warn(`⚠️  輸出檔案不存在，無需刪除: ${full_output_path}`)
      return
    }

    unlinkSync(full_output_path)
    console.log(`✅ 輸出檔案已刪除:`, full_output_path)
  } catch (error) {
    console.error('❌ 刪除輸出檔案失敗:', error)
    throw new Error(`刪除輸出檔案失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 清理孤立的輸出檔案（資料庫中無對應記錄）
 * 需搭配 conversation.ts 使用
 */
export function cleanOrphanedOutputs(validPaths: string[]): number {
  try {
    ensureOutputDir()

    const fs = require('fs')
    const allFiles = fs.readdirSync(OUTPUT_DIR)
      .filter((file: string) => file.startsWith('output-') && file.endsWith('.txt'))
      .map((file: string) => join(OUTPUT_DIR, file))

    const validPathSet = new Set(validPaths)
    const orphanedFiles = allFiles.filter((file: string) => !validPathSet.has(file))

    let deletedCount = 0

    for (const file of orphanedFiles) {
      try {
        unlinkSync(file)
        deletedCount++
      } catch (error) {
        console.warn(`⚠️  無法刪除孤立檔案: ${file}`, error)
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ 已清理 ${deletedCount} 個孤立的輸出檔案`)
    } else {
      console.log('ℹ️  無孤立的輸出檔案需要清理')
    }

    return deletedCount
  } catch (error) {
    console.error('❌ 清理孤立輸出檔案失敗:', error)
    throw new Error(`清理孤立輸出檔案失敗: ${error instanceof Error ? error.message : String(error)}`)
  }
}
