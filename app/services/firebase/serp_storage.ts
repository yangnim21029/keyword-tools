
/**
 * @review - This function updates HTML analysis in the Firestore SERP cache.
 * Since the cache is being removed, review if/where this HTML analysis should be saved instead (e.g., in the main history document).
 * 更新 SERP 結果中的 HTML 分析 (使用 Read-Modify-Write Top-Level Map 策略)
 */
// Removed commented out function: updateSerpResultWithHtmlAnalysis

/**
 * @review - This function updates HTML analysis in the Firestore SERP cache.
 * Since the cache is being removed, review if/where this HTML analysis should be saved instead (e.g., in the main history document).
 * 更新 SERP 結果中的 HTML 分析 (使用 Read-Modify-Write Top-Level Map 策略)
 */
/* // Commented out as the SERP cache collection is being removed
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
      console.log(`[updateSerpResultWithHtmlAnalysis] 找不到文檔 ${documentId} (可能已被刪除或從未創建，因為快取已移除)`);
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
*/ 