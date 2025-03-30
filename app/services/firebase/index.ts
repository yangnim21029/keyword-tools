// 導出共享配置
export { CACHE_EXPIRY_TIME, COLLECTIONS, db } from './config';

// 導出歷史相關功能
export {
    getSearchHistoryDetail, getSearchHistoryList, saveSearchHistory, updateSearchHistoryWithClusters
} from './history';

// 導出統計相關功能
export { getDatabaseStats } from './stats';

// 導出 SERP 數據相關功能
export {
    generateSerpDocumentId, getSerpResults, saveSerpResults
} from './serp_storage';

// 導出 HTML 分析更新功能
export { updateSerpResultWithHtmlAnalysis } from './serp_storage';
