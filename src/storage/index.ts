/**
 * Storage Layer - 統一匯出
 */

export {
  initDatabase,
  getDatabase,
  closeDatabase,
  vacuumDatabase
} from './db'

export {
  saveConversation,
  getLatestConversation,
  getConversationById,
  getConversationsByUser,
  cleanOldData,
  getStats
} from './conversation'

export type {
  Conversation,
  ConversationInput
} from './conversation'

export {
  saveOutput,
  getOutput,
  deleteOutput,
  cleanOrphanedOutputs
} from './output'
