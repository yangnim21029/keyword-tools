// 導出共享配置
export { COLLECTIONS, db } from './config';

// 導出歷史相關功能
export {
    getSearchHistoryDetail, getSearchHistoryList, saveSearchHistory, updateSearchHistoryWithClusters
} from './history';

// 導出統計相關功能
export { getDatabaseStats } from './stats';

// 導出 HTML 分析更新功能
export { updateSerpResultWithHtmlAnalysis } from './serp_storage';
