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
  deleteSerpAnalysisById, // Correct function name
  findSerpAnalysisByKeyword, // Correct function name
  getSerpAnalysisById,
  getSerpAnalysisList, // Correct function name
  getTotalAnalyzedSerpsCount, // Correct function name // Correct function name
  saveSerpAnalysis
} from './data-serp-result';

// Export types from data-serp-result
export type {
  // Also export the specific analysis types defined within data-serp-result if needed elsewhere
  ContentTypeAnalysisJson as DataSerpContentTypeAnalysisJson, // Alias to avoid name clash
  TitleAnalysisJson as DataSerpTitleAnalysisJson, // Alias to avoid name clash // Alias to avoid name clash
  UserIntentAnalysisJson as DataSerpUserIntentAnalysisJson, // Correct type name
  FirebaseSerpAnalysisDoc,
  SerpAnalysisData
} from './data-serp-result';

// 導出通用 Schema 定義 (如果需要在外部使用)
// This re-exports AiContentTypeAnalysisJson, AiUserIntentAnalysisJson etc. from schema.ts
export * from './schema';
