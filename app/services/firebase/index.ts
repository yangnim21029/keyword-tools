import {
  COLLECTIONS,
  db // Import the initialized db instance
} from './db-config'; // Corrected imports

// 導出 Firebase 初始化函數和 DB 實例
export { COLLECTIONS, db }; // Export db instead of getDb/initializeFirebaseAdmin

// 導出關鍵字數據相關
export * from './data-keyword-volume'; // Re-export functions like getKeywordVolumeList etc.
export type { KeywordVolumeListItem, KeywordVolumeObject } from './schema'; // Export specific types

// --- 導出 SERP 分析數據類型和函數 ---

// Export the main SERP data type from the schema, aliased for potential compatibility
export type { FirebaseSerpResultObject as FirebaseSerpDataDoc } from './schema';

// Export functions from data-serp-result
export {
  // deleteSerpAnalysisById, // Assuming delete function is named differently or not exported? Check data-serp-result.ts
  findSerpResultObjects as findSerpAnalysisByKeyword, // Corrected: Use findSerpResultObjects, alias remains findSerpAnalysisByKeyword
  getSerpResultById as getSerpAnalysisById, // Corrected: Use getSerpResultById, alias remains getSerpAnalysisById
  getSerpResultList as getSerpAnalysisList, // Corrected: Use getSerpResultList, alias remains getSerpAnalysisList
  getTotalSerpDataCount as getTotalAnalyzedSerpsCount
} from './data-serp-result';

// Export types from data-serp-result
export type {} from './data-serp-result'; // Keep this line if other types ARE exported and needed

// 導出通用 Schema 定義 (如果需要在外部使用)
// This re-exports AiContentTypeAnalysisJson, AiUserIntentAnalysisJson etc. from schema.ts
export * from './schema';
