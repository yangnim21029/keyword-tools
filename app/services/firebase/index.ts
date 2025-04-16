// 導出共享配置
export { COLLECTIONS, db } from './db-config';

// 導出關鍵字研究相關功能
export {
  getKeywordResearchDetail,
  getKeywordResearchList,
  saveKeywordResearch,
  updateKeywordResearchClusters,
  updateKeywordResearchResults
} from './db-keyword-research';

// 導出 SERP 分析相關功能
export {
  getSerpAnalysisBySanitizedId,
  getSerpAnalysisList,
  saveSerpAnalysis
} from './db-serp';

// 導出 SERP 分析數據類型 (可選，如果需要在其他地方使用)
export type { SerpAnalysisData } from './db-serp';
