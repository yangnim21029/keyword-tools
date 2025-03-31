import { Timestamp } from 'firebase-admin/firestore';
import { CACHE_EXPIRY_TIME, COLLECTIONS, db } from '../firebase';

/**
 * 快取關鍵詞建議到 Firestore
 */
export async function cacheKeywordSuggestions(query: string, region: string, language: string, suggestions: string[]): Promise<void> {
  if (!db) {
    console.error("Firestore not initialized for cacheKeywordSuggestions");
    return;
  }
  try {
    const cacheId = `${query}_${region}_${language}`;
    await db.collection(COLLECTIONS.KEYWORD_SUGGESTIONS).doc(cacheId).set({
      query,
      region,
      language,
      suggestions,
      timestamp: Timestamp.now(),
    });
    console.log(`快取關鍵詞建議: ${cacheId}`);
  } catch (error) {
    console.error("快取關鍵詞建議時出錯:", error);
  }
}

/**
 * 從 Firestore 獲取快取的關鍵詞建議（如果未過期）
 */
export async function getCachedKeywordSuggestions(query: string, region: string, language: string): Promise<string[] | null> {
  if (!db) {
    console.error("Firestore not initialized for getCachedKeywordSuggestions");
    return null;
  }
  try {
    const cacheId = `${query}_${region}_${language}`;
    const docSnap = await db.collection(COLLECTIONS.KEYWORD_SUGGESTIONS).doc(cacheId).get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用快取關鍵詞建議: ${cacheId}`);
        return data.suggestions;
      } else {
        console.log(`關鍵詞建議快取已過期: ${cacheId}`);
      }
    }
    return null;
  } catch (error) {
    console.error("獲取快取關鍵詞建議時出錯:", error);
    return null;
  }
}

/**
 * 快取 URL 建議到 Firestore
 */
export async function cacheUrlSuggestions(url: string, region: string, language: string, suggestions: string[]): Promise<void> {
  if (!db) {
    console.error("Firestore not initialized for cacheUrlSuggestions");
    return;
  }
  try {
    // 使用 URL 的雜湊值作為一致性的快取 ID
    const urlHash = generateUrlHash(url);
    const cacheId = `${urlHash}_${region}_${language}`;
    await db.collection(COLLECTIONS.URL_SUGGESTIONS).doc(cacheId).set({
      url, // 儲存原始 URL
      region,
      language,
      suggestions,
      timestamp: Timestamp.now(),
    });
    console.log(`快取 URL 建議: ${url}`);
  } catch (error) {
    console.error("快取 URL 建議時出錯:", error);
  }
}

/**
 * 從 Firestore 獲取快取的 URL 建議（如果未過期）
 */
export async function getCachedUrlSuggestions(url: string, region: string, language: string): Promise<string[] | null> {
  if (!db) {
    console.error("Firestore not initialized for getCachedUrlSuggestions");
    return null;
  }
  try {
    const urlHash = generateUrlHash(url);
    const cacheId = `${urlHash}_${region}_${language}`;
    const docSnap = await db.collection(COLLECTIONS.URL_SUGGESTIONS).doc(cacheId).get();

    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用快取 URL 建議: ${url}`);
        return data.suggestions;
      } else {
        console.log(`URL 建議快取已過期: ${url}`);
      }
    }
    return null;
  } catch (error) {
    console.error("獲取快取 URL 建議時出錯:", error);
    return null;
  }
}

/**
 * 生成 URL 的雜湊值，用於一致的快取 ID
 */
function generateUrlHash(url: string): string {
  // 簡單的雜湊函數，用於生成固定長度的字串
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    const char = url.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // 轉換為 32 位整數
  }
  return Math.abs(hash).toString(16); // 轉換為十六進制並取絕對值
} 