import type { SearchHistoryItem } from '@/lib/schemas'; // Update path and combine types
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './config';

/**
 * 保存搜索歷史到 Firebase
 */
export async function saveSearchHistory(
  mainKeyword: string, 
  region: string, 
  language: string, 
  suggestions: string[], 
  searchResults: any[],
  clusters?: Record<string, string[]> | null
): Promise<string | null> {
  if (!db) return null;
  
  try {
    // 創建歷史記錄
    const historyData = {
      mainKeyword,
      region,
      language,
      suggestions,
      searchResults,
      clusters: clusters || null, // 添加分群結果
      timestamp: Timestamp.now()
    };
    
    // 使用 add 方法自動生成文檔 ID
    const docRef = await db.collection(COLLECTIONS.SEARCH_HISTORY).add(historyData);
    console.log(`已保存搜索歷史: ${docRef.id}${clusters ? '，包含分群結果' : ''}`);
    
    return docRef.id; // 返回生成的歷史記錄 ID
  } catch (error) {
    console.error('保存搜索歷史失敗:', error);
    return null;
  }
}

/**
 * 獲取搜索歷史列表，按時間倒序排列
 */
export async function getSearchHistoryList(limit: number = 50) {
  if (!db) return [];
  
  try {
    // 查詢最近的歷史記錄，按時間戳倒序排列，限制數量
    const querySnapshot = await db.collection(COLLECTIONS.SEARCH_HISTORY)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    if (querySnapshot.empty) {
      return [];
    }
    
    // 轉換查詢結果為數組
    const historyList = querySnapshot.docs.map(doc => {
      const data = doc.data();
      
      // 获取原始 Timestamp 对象并转换为 Date 对象
      const originalTimestamp = data.timestamp?.toDate() || new Date(); // Provide a default date if timestamp is missing
      
      // 計算分群數量
      const clustersCount = data.clusters ? Object.keys(data.clusters).length : 0;
      
      return {
        id: doc.id,
        mainKeyword: data.mainKeyword || '',
        region: data.region || '',
        language: data.language || '',
        timestamp: originalTimestamp, // 返回原始 Date 对象
        suggestionCount: data.suggestions?.length || 0, // 添加 suggestionCount
        resultsCount: data.searchResults?.length || 0, // 修正名稱為 resultsCount
        suggestionsPreview: data.suggestions?.slice(0, 5) || [], // 保留建議預覽，使用不同名稱
        clustersCount // 添加分群數量
      };
    });
    
    return historyList;
  } catch (error) {
    console.error('獲取搜索歷史列表失敗:', error);
    throw error; // 向上傳播錯誤，讓調用方處理
  }
}

/**
 * 獲取特定搜索歷史詳情
 */
export async function getSearchHistoryDetail(historyId: string): Promise<SearchHistoryItem | null> {
  if (!db) return null;
  
  try {
    // 獲取特定歷史記錄文檔
    const docSnap = await db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId).get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的搜索歷史: ${historyId}`);
      return null;
    }
    
    const data = docSnap.data();
    if (!data) return null;
    
    // 轉換 Timestamp 為 Date
    const timestamp = data.timestamp?.toDate() || new Date(); 
    
    // 計算 Count 字段
    const suggestionCount = data.suggestions?.length || 0;
    const resultsCount = data.searchResults?.length || 0;
    const clustersCount = data.clusters ? Object.keys(data.clusters).length : 0;
    
    // 返回完整的歷史記錄數據，包括 clusters
    const historyDetail: SearchHistoryItem = {
      id: historyId,
      mainKeyword: data.mainKeyword || '',
      region: data.region || '',
      language: data.language || '',
      timestamp: timestamp, 
      suggestions: data.suggestions || [],
      searchResults: data.searchResults || [],
      clusters: data.clusters || null,
      suggestionCount: suggestionCount,
      resultsCount: resultsCount,
      clustersCount: clustersCount > 0 ? clustersCount : undefined
    };

    console.log(`歷史記錄詳情 ${historyId} 載入完成:`, {
      hasMainKeyword: !!historyDetail.mainKeyword,
      suggestionCount: historyDetail.suggestionCount,
      resultsCount: historyDetail.resultsCount,
      clustersCount: clustersCount,
      hasClusters: !!historyDetail.clusters,
    });
    
    return historyDetail;

  } catch (error) {
    console.error(`獲取搜索歷史詳情失敗: ${historyId}`, error);
    throw error; // 向上傳播錯誤，讓調用方處理
  }
}

/**
 * 刪除特定搜索歷史記錄
 * @param historyId 要刪除的歷史記錄ID
 * @returns 是否成功刪除
 */
export async function deleteSearchHistory(historyId: string): Promise<boolean> {
  if (!db) return false;
  
  try {
    // 刪除歷史記錄文檔
    await db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId).delete();
    console.log(`已刪除搜索歷史: ${historyId}`);
    
    return true;
  } catch (error) {
    console.error('刪除搜索歷史失敗:', error);
    return false;
  }
}

/**
 * 更新現有搜索歷史記錄的分群結果
 * @param historyId 歷史記錄ID
 * @param clusters 分群結果
 * @returns 是否成功更新
 */
export async function updateSearchHistoryWithClusters(
  historyId: string, 
  clusters: Record<string, string[]>
): Promise<boolean> {
  if (!db) return false;
  
  try {
    // 檢查歷史記錄是否存在
    const docRef = db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的搜索歷史: ${historyId}`);
      return false;
    }
    
    // 更新分群結果和時間戳
    await docRef.update({
      clusters: clusters,
      updatedAt: Timestamp.now()
    });
    
    console.log(`已更新搜索歷史的分群結果: ${historyId}`);
    return true;
  } catch (error) {
    console.error('更新搜索歷史分群結果失敗:', error);
    return false;
  }
}

/**
 * 更新現有搜索歷史記錄的搜索結果
 * @param historyId 歷史記錄ID
 * @param searchResults 更新的搜索結果數據
 * @returns 是否成功更新
 */
export async function updateSearchHistoryWithResults(
  historyId: string, 
  searchResults: any[]
): Promise<boolean> {
  if (!db) return false;
  
  try {
    // 檢查歷史記錄是否存在
    const docRef = db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的搜索歷史: ${historyId}`);
      return false;
    }
    
    // 更新搜索結果和時間戳
    await docRef.update({
      searchResults: searchResults,
      resultsCount: searchResults.length,
      lastUpdated: Timestamp.now()
    });
    
    console.log(`已更新搜索歷史的搜索結果: ${historyId}, 共 ${searchResults.length} 條`);
    return true;
  } catch (error) {
    console.error('更新搜索歷史搜索結果失敗:', error);
    return false;
  }
}

/**
 * 更新現有搜索歷史記錄的用戶畫像
 * @param historyId 歷史記錄ID
 * @param personas 用戶畫像數據
 * @returns 是否成功更新
 */
export async function updateSearchHistoryWithPersonas(
  historyId: string, 
  personas: any[]
): Promise<boolean> {
  if (!db) return false;
  
  try {
    // 檢查歷史記錄是否存在
    const docRef = db.collection(COLLECTIONS.SEARCH_HISTORY).doc(historyId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的搜索歷史: ${historyId}`);
      return false;
    }
    
    // 更新用戶畫像和時間戳
    await docRef.update({
      personas: personas,
      personasLastUpdated: Timestamp.now()
    });
    
    console.log(`已更新搜索歷史的用戶畫像: ${historyId}, 共 ${personas.length} 個畫像`);
    return true;
  } catch (error) {
    console.error('更新搜索歷史用戶畫像失敗:', error);
    return false;
  }
} 