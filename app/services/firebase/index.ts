// 導出共享配置
export { COLLECTIONS, db } from './db-config';

// 導出關鍵字研究相關功能
export {
  deleteKeywordResearch,
  getKeywordResearchDetail,
  getKeywordResearchSummaryList,
  saveKeywordResearch,
  updateKeywordResearchResults,
  getTotalKeywordResearchCount
} from './db-keyword-research';

// 導出 SERP 分析相關功能
export {
  deleteSerpAnalysisById,
  findSerpAnalysisByKeyword,
  getSerpAnalysisById,
  getSerpAnalysisList,
  saveSerpAnalysis
} from './db-serp';

// 導出 SERP 分析數據類型
export type { FirebaseSerpAnalysisDoc, SerpAnalysisData } from './db-serp';

// Export clustering related DB functions if needed
// export { updateKeywordResearchClusters } from './db-keyword-research';
