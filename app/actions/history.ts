'use server';

import {
    deleteSearchHistory,
    getSearchHistoryDetail as getSearchHistoryDetailFromFirebase,
    getSearchHistoryList,
    saveSearchHistory,
    updateSearchHistoryWithClusters,
    updateSearchHistoryWithPersonas,
    updateSearchHistoryWithResults
} from '@/app/services/firebase/history'; // Assuming this path is correct
import { SearchHistoryDetailResult, SearchHistoryListResult } from '@/app/types'; // Assuming this path is correct
import { revalidateTag } from 'next/cache';

// 获取搜索历史列表
export async function fetchKeywordResearchHistoryList(limit: number = 50, forceRefresh: boolean = false): Promise<SearchHistoryListResult> {
    const sourceInfo = '數據來源: Firebase Firestore';
    try {
        if (forceRefresh) {
            revalidateTag('history');
            console.log('[Server Action] Revalidated history tag due to forceRefresh.');
        }
        const historyList = await getSearchHistoryList(limit);
        return { data: historyList, sourceInfo };
    } catch (error) {
        console.error('獲取搜索歷史列表失敗:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let userFriendlyError = '獲取搜索歷史列表失敗';
        if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota exceeded')) {
            userFriendlyError = `獲取歷史列表失敗: 配額超出。請稍後再試。 (${errorMessage})`;
        } else if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED')) {
            userFriendlyError = '獲取歷史列表失敗: 權限不足。請檢查您的登錄狀態或權限設置。';
        }
        return {
            data: [],
            sourceInfo,
            error: userFriendlyError
        };
    }
}

// 获取特定搜索历史详情
export async function fetchKeywordResearchHistoryDetail(historyId: string): Promise<SearchHistoryDetailResult> {
    const sourceInfo = '數據來源: Firebase Firestore';
    try {
        // No need to revalidateTag here unless specifically needed when fetching detail
        const historyDetail = await getSearchHistoryDetailFromFirebase(historyId);
        if (!historyDetail) {
            return { error: '找不到指定的歷史記錄', sourceInfo, data: null };
        }
        return { data: historyDetail, sourceInfo };
    } catch (error) {
        console.error(`獲取歷史詳情 (${historyId}) 失敗:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         let userFriendlyError = `獲取歷史詳情 (${historyId}) 失敗`;
         if (errorMessage.includes('RESOURCE_EXHAUSTED') || errorMessage.includes('Quota exceeded')) {
            userFriendlyError = `獲取歷史詳情失敗: 配額超出。請稍後再試。 (${errorMessage})`;
        } else if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED')) {
            userFriendlyError = '獲取歷史詳情失敗: 權限不足。請檢查您的登錄狀態或權限設置。';
        }
        return { error: userFriendlyError, sourceInfo, data: null };
    }
}

// 删除特定搜索历史
export async function deleteKeywordResearchHistory(historyId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await deleteSearchHistory(historyId);
        revalidateTag('history'); // Revalidate after deletion
        console.log(`[Server Action] Revalidated history tag after deleting ${historyId}.`);
        return { success: true };
    } catch (error) {
        console.error(`刪除歷史記錄 (${historyId}) 失敗:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let userFriendlyError = `刪除歷史記錄 (${historyId}) 失敗`;
         if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED')) {
            userFriendlyError = '刪除歷史記錄失敗: 權限不足。請檢查您的登錄狀態或權限設置。';
        }
        return { success: false, error: userFriendlyError };
    }
}

// 保存新的搜索历史记录
export async function saveKeywordResearch(
    mainKeyword: string,
    region: string,
    language: string,
    suggestions: string[],
    searchResults: any[] = [],
    clusters?: Record<string, string[]> | null // Add optional clusters parameter
): Promise<{ historyId: string | null; error?: string }> {
    const sourceInfo = '數據來源: Firebase Firestore';
    try {
        // Call the service function with individual arguments, including clusters
        const historyId = await saveSearchHistory(
            mainKeyword,
            region,
            language,
            suggestions,
            searchResults,
            clusters // Pass clusters (might be null/undefined)
        );

        if (!historyId) {
          throw new Error('Failed to save history in service layer');
        }

        revalidateTag('history');
        console.log(`[Server Action] Revalidated history tag after saving new entry ${historyId}.`);
        return { historyId };
    } catch (error) {
        console.error('保存搜索歷史失敗:', error);
         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
         let userFriendlyError = '保存搜索歷史失敗';
         if (errorMessage.includes('permission-denied') || errorMessage.includes('PERMISSION_DENIED')) {
            userFriendlyError = '保存搜索歷史失敗: 權限不足。';
        } else if (errorMessage.includes('ALREADY_EXISTS')) {
            userFriendlyError = '保存搜索歷史失敗: 記錄已存在。';
        } else if (errorMessage === 'Failed to save history in service layer') {
             userFriendlyError = '保存搜索歷史失敗: 數據庫服務錯誤。';
        }
        return { historyId: null, error: userFriendlyError };
    }
}

// 更新历史记录 - 添加搜索结果 (e.g., volume, CPC)
export async function updateKeywordResearchHistoryWithResults(
    historyId: string,
    searchResults: any[] // Define a stricter type, e.g., KeywordResult[]
): Promise<{ success: boolean; error?: string }> {
    try {
        await updateSearchHistoryWithResults(historyId, searchResults);
        // Optionally revalidate if detail view needs immediate update
        // revalidateTag(`history_${historyId}`); 
        return { success: true };
    } catch (error) {
        console.error(`更新歷史記錄 (${historyId}) 的結果失敗:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `更新結果失敗: ${errorMessage}` };
    }
}

// 更新历史记录 - 添加聚类结果
export async function updateHistoryWithClusters(
    historyId: string,
    clusters: Record<string, string[]>
): Promise<{ success: boolean; error?: string }> {
    try {
        await updateSearchHistoryWithClusters(historyId, clusters);
        // Optionally revalidate
        // revalidateTag(`history_${historyId}`); 
        return { success: true };
    } catch (error) {
        console.error(`更新歷史記錄 (${historyId}) 的聚類失敗:`, error);
         const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `更新聚類失敗: ${errorMessage}` };
    }
}

// 更新历史记录 - 添加用户画像结果
export async function updateKeywordResearchHistoryWithPersonas(
    historyId: string,
    personas: any[] // Define a stricter type
): Promise<{ success: boolean; error?: string }> {
    try {
        await updateSearchHistoryWithPersonas(historyId, personas);
        // Optionally revalidate
        // revalidateTag(`history_${historyId}`); 
        return { success: true };
    } catch (error) {
        console.error(`更新歷史記錄 (${historyId}) 的用戶畫像失敗:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `更新用戶畫像失敗: ${errorMessage}` };
    }
}


// --- Potentially redundant or internal functions from original file ---
// These were present in the outline but might be duplicates or intended for internal service use.
// Review if they are needed as exported server actions.

// // Example: Internal detail fetch (might not need exporting)
// async function getKeywordResearchHistoryDetailInternal(historyId: string) {
//   // ... implementation ...
// }

// // Example: Saving clusters (might be handled by updateHistoryWithClusters)
// async function saveClustersToHistory(...) {
//   // ... implementation ...
// }

// // Example: Saving clustering results (seems duplicate of updateHistoryWithClusters)
// async function saveHistoryClusteringResults(...) {
//  // ... implementation ...
// } 