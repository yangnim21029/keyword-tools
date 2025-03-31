'use server';

import { ALPHABET, LANGUAGES, REGIONS, SYMBOLS } from '@/app/config/constants';
import { fetchAutocomplete, fetchSuggestionWithDelay, getSearchVolume } from '@/app/services/googleAds';
import { analyzeHtmlContent, analyzeSerpResultsHtml, getSerpAnalysis } from '@/app/services/serp';
import { SearchHistoryDetailResult, SearchHistoryListResult, SuggestionsResult } from '@/app/types';
import { UrlFormData } from '@/types';
// import { OpenAI } from 'openai'; // 保持註釋
import {
  getDatabaseStats,
  getSearchHistoryList
} from '@/app/services/firebase';
import {
  deleteSearchHistory,
  saveSearchHistory,
  updateSearchHistoryWithClusters,
  updateSearchHistoryWithPersonas as updateFirebaseHistoryWithPersonas
} from '@/app/services/firebase/history';
import { estimateProcessingTime } from '@/lib/utils-common';
import { revalidateTag } from 'next/cache';

// --- Vercel AI SDK Imports ---
// --- End Vercel AI SDK Imports ---

// const openai_legacy = new OpenAI({ // 保持註釋
//   apiKey: process.env.OPENAI_API_KEY,
// });

// 获取数据库统计信息
export async function getFirebaseStats() {
  try {
    const stats = await getDatabaseStats();
    return stats;
  } catch (error) {
    console.error('獲取數據庫統計信息失敗:', error);
    return { error: '獲取數據庫統計信息失敗' };
  }
}

// Get available regions
export async function getRegions() {
  return { regions: REGIONS, languages: LANGUAGES };
}

// Get Google autocomplete suggestions
export async function getKeywordSuggestions(query: string, region: string, language: string, useAlphabet: boolean = true, useSymbols: boolean = false): Promise<SuggestionsResult> {
  'use server';
  
  try {
    // 直接從API獲取建議數據
    console.log(`從API獲取關鍵詞建議: ${query}, 區域: ${region}, 語言: ${language}`);
    
    // 初始化搜索變數
    const searchPrefix = query.trim();
    let allSuggestions: string[] = [];
    
    // 基本搜索 - 使用原始關鍵詞
    const baseResults = await fetchAutocomplete(searchPrefix, region, language);
    allSuggestions = [...baseResults];
    
    // 如果啟用了字母擴展搜索
    if (useAlphabet) {
      const alphabetPromises = ALPHABET.map(letter => 
        fetchAutocomplete(`${searchPrefix} ${letter}`, region, language)
      );
      const alphabetResults = await Promise.all(alphabetPromises);
      const flatAlphabetResults = alphabetResults.flat();
      allSuggestions = [...allSuggestions, ...flatAlphabetResults];
    }
    
    // 如果啟用了符號擴展搜索
    if (useSymbols) {
      const symbolPromises = SYMBOLS.map(symbol => 
        fetchAutocomplete(`${searchPrefix} ${symbol}`, region, language)
      );
      const symbolResults = await Promise.all(symbolPromises);
      const flatSymbolResults = symbolResults.flat();
      allSuggestions = [...allSuggestions, ...flatSymbolResults];
    }
    
    // 始终过滤简体中文，无论语言设置
    const { filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    let filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    
    // 移除重複項
    const uniqueSuggestions = [...new Set(filteredSuggestions)];
    
    // 計算獲取搜索量的預估時間
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);
    
    return { 
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedVolumeTime,
      fromCache: false,
      sourceInfo: '數據來源: Google Autocomplete API'
    };
  } catch (error) {
    console.error('獲取關鍵詞建議時出錯:', error);
    return { 
      suggestions: [], 
      estimatedProcessingTime: 0, 
      fromCache: false, 
      sourceInfo: '數據來源: 獲取失敗'
    };
  }
}

// 獲取 URL 建議的函數
export async function getUrlSuggestions(formData: UrlFormData): Promise<SuggestionsResult> {
  'use server';
  
  try {
    const { url, region, language } = formData;
    
    if (!url) {
      return { 
        suggestions: [], 
        estimatedProcessingTime: 0, 
        error: 'URL 不能為空',
        sourceInfo: '數據來源: 輸入驗證失敗'
      };
    }
    
    // 直接從API分析URL
    console.log(`從API分析URL: ${url}, 區域: ${region}, 語言: ${language}`);
    
    // 從 URL 解析潛在關鍵詞
    const { hostname, pathname } = new URL(url);
    
    // 獲取域名部分
    const domain = hostname.replace(/^www\./, '');
    const domainParts = domain.split('.')
      .filter(part => !['com', 'org', 'net', 'edu', 'gov', 'io', 'co'].includes(part));
    
    // 獲取路徑部分
    const pathParts = pathname.split('/')
      .filter(part => part && part.length > 2)
      .map(part => part.replace(/-|_/g, ' '));
    
    // 組合潛在關鍵詞
    const potentialKeywords = [...domainParts, ...pathParts];
    
    console.log('從 URL 提取的潛在關鍵詞:', potentialKeywords);
    
    if (potentialKeywords.length === 0) {
      return { 
        suggestions: [], 
        estimatedProcessingTime: 0, 
        error: '無法從 URL 提取關鍵詞',
        sourceInfo: '數據來源: URL 解析失敗'
      };
    }
    
    // 獲取每個潛在關鍵詞的建議
    let allSuggestions: string[] = [];
    
    // 為了避免請求過多，只使用前 5 個關鍵詞
    for (const keyword of potentialKeywords.slice(0, 5)) {
      console.log(`從關鍵詞 "${keyword}" 獲取建議`);
      const suggestions = await fetchAutocomplete(keyword, region, language);
      allSuggestions = [...allSuggestions, ...suggestions];
    }
    
    // 無論何种語言設置，始终过滤简体中文
    const { filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    let filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    
    // 移除重複項
    const uniqueSuggestions = [...new Set(filteredSuggestions)];
    
    console.log(`從 URL 獲取到 ${uniqueSuggestions.length} 個建議`);
    
    // 計算獲取搜索量的預估時間
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);
    
    return { 
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedVolumeTime,
      fromCache: false,
      sourceInfo: '數據來源: URL 分析 + Google Autocomplete API'
    };
  } catch (error) {
    console.error('獲取 URL 建議時出錯:', error);
    return { 
      suggestions: [], 
      estimatedProcessingTime: 0,
      error: error instanceof Error ? error.message : '獲取 URL 建議失敗',
      fromCache: false,
      sourceInfo: '數據來源: 獲取失敗'
    };
  }
}

// 获取搜索历史列表
export async function fetchSearchHistory(limit: number = 50, forceRefresh: boolean = false): Promise<SearchHistoryListResult> {
  'use server';
  const sourceInfo = '數據來源: Firebase Firestore';
  try {
    const historyList = await getSearchHistoryList(limit);
    
    // 如果強制刷新，重置緩存
    if (forceRefresh) {
      revalidateTag('history');
      fetch('/api/revalidate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tags: ['history'] }),
        next: { tags: ['history'] }
      });
      
      console.log('[Server] 搜索歷史列表緩存已重置');
    }
    
    return { data: historyList, sourceInfo };
  } catch (error) {
    console.error('獲取搜索歷史失敗:', error);
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      return { 
        data: [], 
        sourceInfo, 
        error: `配額超出: ${error.message}`
      };
    }
    return { 
      data: [], 
      sourceInfo, 
      error: error instanceof Error ? error.message : '獲取搜索歷史失敗' 
    };
  }
}

// 獲取歷史記錄詳情 
export async function fetchSearchHistoryDetail(historyId: string, noCache: boolean = false): Promise<SearchHistoryDetailResult> {
  'use server';
  const sourceInfo = '數據來源: Firebase Firestore';
  try {
    if (!historyId) {
      throw new Error('historyId 為空');
    }
    // 使用 getHistoryDetail server action 獲取詳細信息
    const historyDetail = await getHistoryDetail(historyId);
    
    if (!historyDetail) {
      return { 
        data: null, 
        sourceInfo,
        error: '未找到對應的歷史記錄'
      };
    }
    
    return { 
      data: historyDetail, 
      sourceInfo 
    };
  } catch (error) {
    console.error('獲取歷史記錄詳情失敗:', error);
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      return { 
        data: null, 
        sourceInfo, 
        error: `配額超出: ${error.message}`
      };
    }
    return { 
      data: null, 
      sourceInfo, 
      error: error instanceof Error ? error.message : '獲取歷史記錄詳情失敗' 
    };
  }
}

// 删除特定搜索历史记录
export async function deleteSearchHistoryRecord(historyId: string) {
  'use server';
  try {
    const success = await deleteSearchHistory(historyId);
    return { success };
  } catch (error) {
    console.error('刪除搜索歷史失敗:', error);
    
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    
    return { success: false, error: '刪除搜索歷史失敗' };
  }
}

// 保存分群結果到歷史記錄
export async function saveClustersToHistory(
  mainKeyword: string,
  region: string,
  language: string,
  suggestions: string[],
  searchResults: any[],
  clusters: Record<string, string[]>
) {
  'use server';
  try {
    // 保存基本數據和分群，獲取 historyId
    const historyId = await saveSearchHistory(
      mainKeyword,
      region,
      language,
      suggestions,
      searchResults,
      clusters
    );
    
    if (!historyId) {
      throw new Error('保存歷史記錄失敗：未能獲取 historyId');
    }

    console.log('已保存完整歷史記錄 (包含分群) 到 Firebase', historyId);
    return { success: true, historyId };
  } catch (error) {
    console.error('保存分群結果到歷史失敗:', error);
    
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '保存分群結果失敗'
    };
  }
}

// 更新歷史記錄的分群結果
export async function updateHistoryWithClusters(
  historyId: string,
  clusters: Record<string, string[]>
) {
  'use server';
  try {
    const success = await updateSearchHistoryWithClusters(historyId, clusters);
    
    console.log('更新歷史記錄分群結錄:', success ? '成功' : '失敗');
    return { success, historyId };
  } catch (error) {
    console.error('更新歷史記錄分群結果失敗:', error);
    
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    
    return { success: false, error: '更新分群結果失敗' };
  }
}

// 更新為正確的完整函數定義
// 添加新函數 - 用於保存歷史記錄聚類結果
export async function saveHistoryClusteringResults(historyId: string, clusters: Record<string, string[]>) {
  'use server';
  try {
    const { updateSearchHistoryWithClusters } = await import('@/app/services/firebase/history');
    const result = await updateSearchHistoryWithClusters(historyId, clusters);
    
    // 在保存後重置緩存
    // 重置歷史記錄相關的標籤
    revalidateTag('history');  // 主歷史標籤
    revalidateTag(`history-${historyId}`);  // 特定歷史記錄標籤
    console.log(`[Server] 緩存標籤已重置，historyId: ${historyId}`);
    
    return { success: true, historyId };
  } catch (error) {
    console.error('更新歷史記錄聚類失敗:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '更新歷史記錄聚類失敗' 
    };
  }
}

// 導出導入的服務函數 (假設它們本身是 async)
export {
  analyzeHtmlContent,
  analyzeSerpResultsHtml, getSearchVolume, getSerpAnalysis
};

// 獲取歷史記錄詳情
export async function getHistoryDetail(historyId: string) {
  'use server';
  try {
    if (!historyId) {
      throw new Error('historyId 為空');
    }

    console.log(`[Server] 正在獲取歷史記錄詳情 ID: ${historyId} (始終清除緩存)`);
    const { getSearchHistoryDetail } = await import('@/app/services/firebase/history');

    // 使用標籤重置相關緩存
    revalidateTag('history');
    revalidateTag(`history-${historyId}`);
    console.log(`[Server] 歷史記錄詳情緩存已重置，historyId: ${historyId}`);

    const result = await getSearchHistoryDetail(historyId);

    console.log(`[Server] 歷史記錄詳情獲取 ${result ? '成功' : '失敗'} (無緩存)`);
    if (result && result.clusters) {
      console.log(`[Server] 歷史記錄包含 ${Object.keys(result.clusters).length} 個分群`);

      // 為了確保序列化/反序列化正確，我們用 JSON 處理一下
      const processedResult = {
        ...result,
        // 明確序列化和反序列化 clusters，避免數據丟失
        clusters: JSON.parse(JSON.stringify(result.clusters))
      };

      console.log('[Server] 處理後的 clusters 數據:', {
        hasClustersBefore: !!result.clusters,
        hasProcessedClusters: !!processedResult.clusters,
        clusterKeysBefore: Object.keys(result.clusters).length,
        processedClusterKeys: Object.keys(processedResult.clusters).length
      });

      return processedResult;
    } else {
      console.log(`[Server] 歷史記錄不包含分群數據`);
    }

    // 返回類型為 any，避免類型問題
    return result as any;
  } catch (error) {
    console.error('[Server] 獲取歷史記錄詳情失敗:', error);
    throw error;
  }
}

// 獲取關鍵詞建議的函數（帶延遲，專門用於點擊關鍵詞卡片獲取補充關鍵詞）
export async function getKeywordSuggestionsWithDelay(query: string, region: string, language: string): Promise<SuggestionsResult> {
  'use server';
  
  try {
    // 直接從API獲取建議數據，使用帶有延遲的函數
    console.log(`從API獲取補充關鍵詞建議: ${query}, 區域: ${region}, 語言: ${language}`);
    
    // 初始化搜索變數
    const searchPrefix = query.trim();
    let allSuggestions: string[] = [];
    
    // 基本搜索 - 使用原始關鍵詞，使用帶有50ms延遲的API
    const baseResults = await fetchSuggestionWithDelay(searchPrefix, region, language);
    allSuggestions = [...baseResults];
    
    // 始终过滤简体中文，无论语言设置
    const { filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    let filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    
    // 移除重複項
    const uniqueSuggestions = [...new Set(filteredSuggestions)];
    
    return { 
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: 0,
      fromCache: false,
      sourceInfo: '數據來源: Google Autocomplete API (帶延遲)'
    };
  } catch (error) {
    console.error('獲取補充關鍵詞建議時出錯:', error);
    return { 
      suggestions: [], 
      estimatedProcessingTime: 0, 
      fromCache: false, 
      sourceInfo: '數據來源: 獲取失敗'
    };
  }
}

// 更新搜索歷史的搜索結果
export async function updateSearchHistoryWithResults(
  historyId: string,
  searchResults: any[]
) {
  'use server';
  try {
    if (!historyId) {
      throw new Error('historyId 為空');
    }

    // 導入 Firebase 服務
    const { updateSearchHistoryWithResults } = await import('@/app/services/firebase/history');
    const success = await updateSearchHistoryWithResults(historyId, searchResults);

    if (!success) {
      throw new Error('更新搜索結果失敗');
    }

    // 重置相關標籤
    revalidateTag('history');  // 主歷史標籤
    revalidateTag(`history-${historyId}`);  // 特定歷史記錄標籤
    console.log(`[Server] 搜索結果更新後緩存標籤已重置，historyId: ${historyId}`);

    return { success: true, historyId };
  } catch (error) {
    console.error('更新搜索歷史結果失敗:', error);
    
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '更新搜索結果失敗' 
    };
  }
}

// 更新搜索歷史的用戶畫像
export async function updateSearchHistoryWithPersonas(
  historyId: string,
  personas: any[]
) {
  'use server';
  try {
    if (!historyId) {
      throw new Error('historyId 為空');
    }

    // 使用重命名後的導入函數
    const success = await updateFirebaseHistoryWithPersonas(historyId, personas);

    if (!success) {
      throw new Error('更新用戶畫像失敗');
    }

    // 重置相關標籤
    revalidateTag('history');  // 主歷史標籤
    revalidateTag(`history-${historyId}`);  // 特定歷史記錄標籤
    console.log(`[Server] 用戶畫像更新後緩存標籤已重置，historyId: ${historyId}`);

    return { success: true, historyId };
  } catch (error) {
    console.error('更新搜索歷史用戶畫像失敗:', error);
    
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : '更新用戶畫像失敗' 
    };
  }
}

