import { safeParse } from '@/app/lib/zod-utils';
import { firebaseSerpResultsMapSchema, htmlAnalysisResultSchema, ProcessedSerpResult } from '@/lib/schemas';
import { Timestamp } from 'firebase-admin/firestore';
import { CACHE_EXPIRY_TIME, COLLECTIONS, db } from './config';

/**
 * 保存 SERP 結果到 Firestore
 */
export async function saveSerpResults(keywords: string[], region: string, language: string, results: any) {
  if (!db) return;
  
  try {
    // 確保結果是可序列化的（轉換為純 JSON 並重新解析）
    // 這會移除任何不可序列化的元素，如日期、函數、循環引用等
    const serializableResults = JSON.parse(JSON.stringify(results));
    
    // 使用 Zod 驗證並轉換結果（在轉換過程中添加 originalQuery 字段）
    const transformedSchema = firebaseSerpResultsMapSchema.transform((map: Record<string, ProcessedSerpResult>) => {
      // 為每個關鍵詞結果添加原始查詢關鍵詞字段
      Object.entries(map).forEach(([key, value]) => {
        if (value) {
          map[key] = {
            ...value,
            originalQuery: key
          };
        }
      });
      return map;
    });
    
    const validationResult = safeParse(
      transformedSchema, 
      serializableResults, 
      'SERP 結果'
    );
    
    const finalResults = validationResult || serializableResults;
    
    const cacheId = generateSerpDocumentId(keywords, region, language);
    await db.collection(COLLECTIONS.SERP_RESULTS).doc(cacheId).set({
      keywords,  // 保存原始關鍵詞列表
      region,
      language,
      results: finalResults,
      timestamp: Timestamp.now(),
      searchQueries: keywords, // 額外保存搜索查詢，以便直接訪問
    });
    console.log(`已緩存 SERP 結果: ${cacheId}`);
  } catch (error) {
    console.error("緩存 SERP 結果時出錯:", error);
    throw error; // 向上拋出錯誤，以便調用者處理
  }
}

/**
 * 從 Firestore 獲取 SERP 結果 (帶有清理回退的嚴格驗證)
 */
export async function getSerpResults(keywords: string[], region: string, language: string) {
  if (!db) return null;
  
  const cacheId = generateSerpDocumentId(keywords, region, language);
  try {
    const docSnap = await db.collection(COLLECTIONS.SERP_RESULTS).doc(cacheId).get();
    
    // --- Basic checks: Existence, Data, Timestamp, Expiry, results field --- 
    if (!docSnap.exists) {/*... log and return null ...*/ console.log(`[getSerpResults] 未找到緩存文檔: ${cacheId}`); return null; }
    const data = docSnap.data();
    if (!data) {/*... log and return null ...*/ console.log(`[getSerpResults] 緩存文檔數據為空: ${cacheId}`); return null; }
    const timestamp = data.timestamp?.toDate();
    if (!timestamp) {/*... log and return null ...*/ console.log(`[getSerpResults] 緩存文檔缺少時間戳: ${cacheId}`); return null; }
    const now = new Date();
    if (now.getTime() - timestamp.getTime() >= CACHE_EXPIRY_TIME) {/*... log and return null ...*/ console.log(`[getSerpResults] 緩存已過期: ${cacheId}`); return null; }
    if (!data.results || typeof data.results !== 'object' || Object.keys(data.results).length === 0) {/*... log and return null ...*/ console.log(`[getSerpResults] 緩存文檔 results 字段無效或為空: ${cacheId}`); return null; }
    // --- End Basic Checks ---

    // --- Debugging Summary (Keep as is) --- 
    try {
      const keywordsInCache = Object.keys(data.results || {});
      const firstKeyword = keywordsInCache[0];
      const firstKeywordData = firstKeyword ? data.results[firstKeyword] : null;
      const firstKeywordResultsCount = Array.isArray(firstKeywordData?.results) ? firstKeywordData.results.length : 0;
      const firstResultSummary = firstKeywordResultsCount > 0 && firstKeywordData.results[0] ? { url: firstKeywordData.results[0].url, title: firstKeywordData.results[0].title?.substring(0, 50) + '...', htmlAnalysisExists: firstKeywordData.results[0].hasOwnProperty('htmlAnalysis'), htmlAnalysisValue: firstKeywordData.results[0].htmlAnalysis === null ? 'null' : typeof firstKeywordData.results[0].htmlAnalysis === 'object' ? 'Object' : undefined } : null;
      const summary = { message: `Raw data for ${cacheId}`, keywordsCount: keywordsInCache.length, firstKeyword: firstKeyword || 'N/A', firstKeywordResultsCount: firstKeywordResultsCount, firstResultSummary: firstResultSummary };
      console.log(`[getSerpResults] Raw data summary from Firestore:`, JSON.stringify(summary, null, 2));
    } catch (logError) { console.error(`[getSerpResults] Error generating raw data summary for ${cacheId}:`, logError); console.log(`[getSerpResults] Raw data keys from Firestore for ${cacheId}:`, Object.keys(data.results || {})); }
    // --- End Debugging --- 
    
    // 補全 originalQuery
    const resultsWithQuery = { ...data.results };
    Object.keys(resultsWithQuery).forEach(key => {
        if (resultsWithQuery[key] && typeof resultsWithQuery[key] === 'object' && !resultsWithQuery[key].originalQuery) {
            resultsWithQuery[key] = { ...resultsWithQuery[key], originalQuery: key };
        }
    });

    // 1. 嘗試嚴格驗證
    const validationResult = firebaseSerpResultsMapSchema.safeParse(resultsWithQuery);

    if (validationResult.success) {
        if (Object.keys(validationResult.data).length > 0) {
            console.log(`[getSerpResults] 緩存數據驗證成功 (包含 htmlAnalysis): ${cacheId}`);
            return validationResult.data; // Success!
        } else {
            console.log(`[getSerpResults] 緩存數據驗證成功但結果為空: ${cacheId}`);
            return null; 
        }
    } else {
        // 2. 驗證失敗 - 嘗試清理 htmlAnalysis 並重新驗證
        console.warn(`[getSerpResults] 完整驗證失敗，嘗試清理 htmlAnalysis 並重試: ${cacheId}`, validationResult.error.format());
        try {
            // Create a deep copy to avoid modifying the original object used in logs etc.
            const resultsToClean = JSON.parse(JSON.stringify(resultsWithQuery)); 
            let cleanedSuccessfully = true;

            for (const keyword in resultsToClean) {
                if (resultsToClean[keyword] && Array.isArray(resultsToClean[keyword].results)) {
                    resultsToClean[keyword].results.forEach((item: any) => {
                        if (item && typeof item === 'object' && item.hasOwnProperty('htmlAnalysis')) {
                            delete item.htmlAnalysis; // Delete the field
                        }
                    });
                } else {
                    // If structure is already wrong here, mark as failed
                    console.warn(`[getSerpResults] Cleaning failed: Invalid structure for keyword ${keyword} results.`);
                    cleanedSuccessfully = false;
                    break; 
                }
            }

            if (cleanedSuccessfully) {
                // Re-validate the cleaned data
                const cleanedValidationResult = firebaseSerpResultsMapSchema.safeParse(resultsToClean);
                if (cleanedValidationResult.success && Object.keys(cleanedValidationResult.data).length > 0) {
                    console.log(`[getSerpResults] 清理後的數據驗證成功 (已移除 htmlAnalysis): ${cacheId}`);
                    return cleanedValidationResult.data; // Return cleaned data
                } else {
                    console.warn(`[getSerpResults] 清理後的數據驗證仍然失敗或為空，返回 null: ${cacheId}`, cleanedValidationResult.error?.format());
                    return null;
                }
            } else {
                // Cleaning itself failed due to structure issues
                return null;
            }
        } catch (cleanupError) {
            console.error(`[getSerpResults] 清理 htmlAnalysis 時發生錯誤: ${cacheId}`, cleanupError);
            return null;
        }
    }

  } catch (error) {
    const currentCacheId = generateSerpDocumentId(keywords, region, language);
    console.error(`[getSerpResults] 獲取或處理緩存 SERP 結果時最外層出錯 (${currentCacheId}):`, error);
    return null;
  }
}

/**
 * 生成 Firestore 文檔 ID
 */
export function generateSerpDocumentId(keywords: string[], region: string, language: string): string {
  // 對關鍵詞排序並加入，確保相同關鍵詞集合有相同的 ID
  const keywordsStr = keywords.sort().join(',');
  return `${keywordsStr}_${region}_${language}`;
}

/**
 * 更新 SERP 結果中的 HTML 分析 (使用 Read-Modify-Write Top-Level Map 策略)
 */
export async function updateSerpResultWithHtmlAnalysis(documentId: string, keyword: string, url: string, htmlAnalysis: any) {
  if (!db) return;

  try {
    // 1. 驗證傳入的 htmlAnalysis 數據
    const validationResult = htmlAnalysisResultSchema.safeParse(htmlAnalysis);
    if (!validationResult.success) {
      console.error(`[updateSerpResultWithHtmlAnalysis] 提供的 HTML 分析數據驗證失敗 (URL: ${url}):`, validationResult.error.format());
      return; 
    }
    const validatedAnalysisData = validationResult.data;

    const docRef = db.collection(COLLECTIONS.SERP_RESULTS).doc(documentId);

    // 2. 讀取現有文檔數據
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      console.log(`[updateSerpResultWithHtmlAnalysis] 找不到文檔 ${documentId}`);
      return;
    }
    const currentData = docSnap.data();
    // Ensure top-level results map exists
    if (!currentData || typeof currentData.results !== 'object' || currentData.results === null) {
      console.log(`[updateSerpResultWithHtmlAnalysis] 文檔 ${documentId} 中找不到有效的頂層 results 映射`);
      return;
    }
    // Ensure data for the specific keyword exists
    if (!currentData.results[keyword] || typeof currentData.results[keyword] !== 'object') {
      console.log(`[updateSerpResultWithHtmlAnalysis] 在頂層 results 映射中找不到關鍵詞 ${keyword} 的數據`);
      return;
    }
    // Ensure the nested results array exists and is an array
    if (!Array.isArray(currentData.results[keyword].results)) {
      console.log(`[updateSerpResultWithHtmlAnalysis] 文檔 ${documentId} 中關鍵詞 ${keyword} 的 results 不是有效數組`);
      return;
    }

    // 3. 在內存中修改數據 (操作副本)
    const updatedResultsMap = { ...currentData.results }; // Copy top-level map
    const keywordDataToModify = { ...updatedResultsMap[keyword] }; // Copy specific keyword data
    const innerResultsArray = [...keywordDataToModify.results]; // Copy nested results array

    const resultIndex = innerResultsArray.findIndex((r: any) => r && r.url === url);

    if (resultIndex !== -1) {
      const originalResultItem = innerResultsArray[resultIndex];
      // 創建更新後的結果項
      const updatedResultItem = {
        ...originalResultItem,
        htmlAnalysis: validatedAnalysisData // Add the validated analysis
      };
      // 在副本數組中替換舊項
      innerResultsArray[resultIndex] = updatedResultItem;

      // 更新副本關鍵詞數據中的 results 數組
      keywordDataToModify.results = innerResultsArray;
      
      // 更新副本頂層映射中的關鍵詞數據
      updatedResultsMap[keyword] = keywordDataToModify;

      // 4. 寫回修改後的整個頂層 results 映射
      await docRef.update({
        results: updatedResultsMap, // Update the entire top-level results map
        lastUpdated: Timestamp.now()
      });
      console.log(`[updateSerpResultWithHtmlAnalysis] 已更新 ${keyword} 關鍵詞數據 (使用 Top-Level Map Update) for URL ${url}`);

    } else {
      console.log(`[updateSerpResultWithHtmlAnalysis] 在 ${keyword} 關鍵詞結果中找不到 URL ${url}，無法更新`);
    }

  } catch (error) {
    if (error instanceof Error && (error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('Quota exceeded'))) {
      console.warn(`[updateSerpResultWithHtmlAnalysis] Firebase 配額超出，無法更新 ${url} 的 HTML 分析。`);
    } else {
      console.error(`[updateSerpResultWithHtmlAnalysis] 更新 HTML 分析時出錯 (URL: ${url}):`, error);
    }
  }
} 