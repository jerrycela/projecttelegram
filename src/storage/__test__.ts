/**
 * Storage 模組測試腳本
 * 執行: npx ts-node src/storage/__test__.ts
 */

import {
  initDatabase,
  saveConversation,
  getLatestConversation,
  getConversationById,
  getStats,
  cleanOldData,
  saveOutput,
  getOutput,
  deleteOutput,
  closeDatabase
} from './index'

async function runTests() {
  console.log('🧪 開始測試 Storage 模組...\n')

  try {
    console.log('1️⃣  初始化資料庫')
    initDatabase()

    console.log('\n2️⃣  測試儲存短輸出（< 5000 字元）')
    const shortOutput = 'This is a short output.'
    const { full_output, full_output_path } = saveOutput(shortOutput)
    console.log('  - full_output:', full_output?.substring(0, 50))
    console.log('  - full_output_path:', full_output_path)

    console.log('\n3️⃣  測試儲存長輸出（> 5000 字元）')
    const longOutput = 'A'.repeat(6000)
    const longResult = saveOutput(longOutput)
    console.log('  - full_output:', longResult.full_output)
    console.log('  - full_output_path:', longResult.full_output_path)

    console.log('\n4️⃣  測試儲存對話記錄（短輸出）')
    const conv1 = saveConversation({
      user_id: 123456789,
      question: '什麼是 TypeScript？',
      summary: 'TypeScript 是 JavaScript 的超集，增加了型別系統。',
      ...(full_output && { full_output }),
      ...(full_output_path && { full_output_path })
    })
    console.log('  - 對話 ID:', conv1.id)
    console.log('  - 問題:', conv1.question)
    console.log('  - 摘要:', conv1.summary)

    console.log('\n5️⃣  測試儲存對話記錄（長輸出）')
    const conv2 = saveConversation({
      user_id: 123456789,
      question: '說明 Node.js 事件循環機制',
      summary: 'Node.js 使用事件驅動架構，透過事件循環處理非同步操作。',
      ...(longResult.full_output && { full_output: longResult.full_output }),
      ...(longResult.full_output_path && { full_output_path: longResult.full_output_path })
    })
    console.log('  - 對話 ID:', conv2.id)
    console.log('  - 問題:', conv2.question)

    console.log('\n6️⃣  測試取得最新對話記錄')
    const latest = getLatestConversation(123456789)
    console.log('  - 最新對話 ID:', latest?.id)
    console.log('  - 問題:', latest?.question)

    console.log('\n7️⃣  測試根據 ID 取得對話記錄')
    const byId = getConversationById(conv1.id)
    console.log('  - 對話 ID:', byId?.id)
    console.log('  - 問題:', byId?.question)

    console.log('\n8️⃣  測試讀取輸出（從資料庫）')
    if (conv1.full_output || conv1.full_output_path) {
      const output1 = getOutput(conv1.full_output, conv1.full_output_path)
      console.log('  - 輸出長度:', output1.length)
      console.log('  - 內容:', output1.substring(0, 50))
    }

    console.log('\n9️⃣  測試讀取輸出（從檔案）')
    if (conv2.full_output || conv2.full_output_path) {
      const output2 = getOutput(conv2.full_output, conv2.full_output_path)
      console.log('  - 輸出長度:', output2.length)
      console.log('  - 內容:', output2.substring(0, 50))
    }

    console.log('\n🔟 測試資料庫統計')
    const stats = getStats()
    console.log('  - 總對話數:', stats.totalConversations)
    console.log('  - 總使用者數:', stats.totalUsers)
    console.log('  - 最舊記錄:', stats.oldestTimestamp ? new Date(stats.oldestTimestamp).toISOString() : 'N/A')
    console.log('  - 最新記錄:', stats.newestTimestamp ? new Date(stats.newestTimestamp).toISOString() : 'N/A')

    console.log('\n1️⃣1️⃣  測試清理舊資料（0 天，應該清除所有資料）')
    const deletedCount = cleanOldData(0)
    console.log('  - 已刪除:', deletedCount, '筆')

    console.log('\n1️⃣2️⃣  測試刪除輸出檔案')
    if (longResult.full_output_path) {
      deleteOutput(longResult.full_output_path)
    }

    console.log('\n1️⃣3️⃣  測試清理後的統計')
    const finalStats = getStats()
    console.log('  - 總對話數:', finalStats.totalConversations)

    console.log('\n✅ 所有測試完成！')

  } catch (error) {
    console.error('\n❌ 測試失敗:', error)
    throw error
  } finally {
    console.log('\n📊 關閉資料庫連線')
    closeDatabase()
  }
}

runTests().catch(console.error)
