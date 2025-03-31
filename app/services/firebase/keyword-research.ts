import "server-only";

import { AdPlanningData } from '@/app/actions/keyword-research';
import { Timestamp } from 'firebase-admin/firestore';
import { COLLECTIONS, db } from './config';

/**
 * 保存關鍵詞研究結果到 Firebase
 */
export async function saveKeywordResearch(
  mainKeyword: string, 
  region: string, 
  language: string, 
  suggestions: string[], 
  keywordIdeas: AdPlanningData[],
  clusters?: Record<string, string[]> | null
): Promise<string | null> {
  if (!db) return null;
  
  try {
    const researchData = {
      mainKeyword,
      region,
      language,
      suggestions,
      keywordIdeas,
      clusters: clusters || null,
      timestamp: Timestamp.now()
    };
    
    const docRef = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).add(researchData);
    console.log(`已保存關鍵詞研究: ${docRef.id}${clusters ? '，包含分群結果' : ''}`);
    
    return docRef.id;
  } catch (error) {
    console.error('保存關鍵詞研究失敗:', error);
    return null;
  }
}

/**
 * 獲取關鍵詞研究列表
 */
export async function getKeywordResearchList(limit: number = 50) {
  if (!db) return [];
  
  try {
    const querySnapshot = await db.collection(COLLECTIONS.KEYWORD_RESEARCH)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();
    
    if (querySnapshot.empty) {
      return [];
    }
    
    const researchList = querySnapshot.docs.map(doc => {
      const data = doc.data();
      const originalTimestamp = data.timestamp?.toDate() || new Date();
      const clustersCount = data.clusters ? Object.keys(data.clusters).length : 0;
      
      return {
        id: doc.id,
        mainKeyword: data.mainKeyword || '',
        region: data.region || '',
        language: data.language || '',
        timestamp: originalTimestamp,
        suggestionCount: data.suggestions?.length || 0,
        resultsCount: data.keywordIdeas?.length || 0,
        suggestionsPreview: data.suggestions?.slice(0, 5) || [],
        clustersCount
      };
    });
    
    return researchList;
  } catch (error) {
    console.error('獲取關鍵詞研究列表失敗:', error);
    throw error;
  }
}

/**
 * 獲取特定關鍵詞研究詳情
 */
export async function getKeywordResearchDetail(researchId: string) {
  if (!db) return null;
  
  try {
    const docSnap = await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的關鍵詞研究: ${researchId}`);
      return null;
    }
    
    const data = docSnap.data();
    if (!data) return null;
    
    const timestamp = data.timestamp?.toDate() || new Date();
    
    const suggestionCount = data.suggestions?.length || 0;
    const resultsCount = data.keywordIdeas?.length || 0;
    const clustersCount = data.clusters ? Object.keys(data.clusters).length : 0;
    
    const researchDetail = {
      id: researchId,
      mainKeyword: data.mainKeyword || '',
      region: data.region || '',
      language: data.language || '',
      timestamp: timestamp,
      suggestions: data.suggestions || [],
      keywordIdeas: data.keywordIdeas || [],
      clusters: data.clusters || null,
      suggestionCount,
      resultsCount,
      clustersCount: clustersCount > 0 ? clustersCount : undefined
    };

    console.log(`關鍵詞研究詳情 ${researchId} 載入完成:`, {
      hasMainKeyword: !!researchDetail.mainKeyword,
      suggestionCount: researchDetail.suggestionCount,
      resultsCount: researchDetail.resultsCount,
      clustersCount,
      hasClusters: !!researchDetail.clusters,
    });
    
    return researchDetail;
  } catch (error) {
    console.error(`獲取關鍵詞研究詳情失敗: ${researchId}`, error);
    throw error;
  }
}

/**
 * 刪除特定關鍵詞研究記錄
 */
export async function deleteKeywordResearch(researchId: string): Promise<boolean> {
  if (!db) return false;
  
  try {
    await db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId).delete();
    console.log(`已刪除關鍵詞研究: ${researchId}`);
    return true;
  } catch (error) {
    console.error('刪除關鍵詞研究失敗:', error);
    return false;
  }
}

/**
 * 更新關鍵詞研究的分群結果
 */
export async function updateKeywordResearchClusters(
  researchId: string, 
  clusters: Record<string, string[]>
): Promise<boolean> {
  if (!db) return false;
  
  try {
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的關鍵詞研究: ${researchId}`);
      return false;
    }
    
    await docRef.update({
      clusters: clusters,
      updatedAt: Timestamp.now()
    });
    
    console.log(`已更新關鍵詞研究的分群結果: ${researchId}`);
    return true;
  } catch (error) {
    console.error('更新關鍵詞研究分群結果失敗:', error);
    return false;
  }
}

/**
 * 更新關鍵詞研究的結果數據
 */
export async function updateKeywordResearchResults(
  researchId: string, 
  keywordIdeas: AdPlanningData[]
): Promise<boolean> {
  if (!db) return false;
  
  try {
    const docRef = db.collection(COLLECTIONS.KEYWORD_RESEARCH).doc(researchId);
    const docSnap = await docRef.get();
    
    if (!docSnap.exists) {
      console.log(`找不到指定 ID 的關鍵詞研究: ${researchId}`);
      return false;
    }
    
    await docRef.update({
      keywordIdeas: keywordIdeas,
      resultsCount: keywordIdeas.length,
      lastUpdated: Timestamp.now()
    });
    
    console.log(`已更新關鍵詞研究結果: ${researchId}, 共 ${keywordIdeas.length} 條`);
    return true;
  } catch (error) {
    console.error('更新關鍵詞研究結果失敗:', error);
    return false;
  }
} 