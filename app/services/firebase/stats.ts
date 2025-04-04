import { COLLECTIONS, db } from './config';

/**
 * 獲取 Firebase 數據庫統計信息
 */
export async function getDatabaseStats() {
  if (!db) return {};
  
  try {
    const stats: Record<string, number | string> = {};
    
    // 獲取各集合的文檔數量
    for (const collection of Object.values(COLLECTIONS)) {
      const querySnapshot = await db.collection(collection).count().get();
      stats[collection] = querySnapshot.data().count;
    }
    
    // 添加時間戳
    stats.timestamp = new Date().toISOString();
    
    return stats;
  } catch (error) {
    console.error('獲取數據庫統計信息失敗:', error);
    return { error: '獲取數據庫統計信息失敗' };
  }
} 