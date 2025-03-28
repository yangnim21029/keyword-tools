'use server';

import { KeywordFormData, UrlFormData, KeywordSuggestion, ClusteringResult } from '@/types';
import { SuggestionsResult, SearchVolumeResult, KeywordVolumeResult } from '@/app/types';
import { OpenAI } from 'openai';
import { filterSimplifiedChinese } from '@/utils/chineseDetector';
// 导入Firebase缓存服务
import { 
  // getCachedKeywordSuggestions, 
  // cacheKeywordSuggestions,
  // getCachedUrlSuggestions,
  // cacheUrlSuggestions,
  // getCachedSearchVolumes,
  // cacheSearchVolumes,
  getDatabaseStats,
  // getKeywordMetadata,  // 暫時不使用
  // cacheKeywordMetadata, // 暫時不使用
  saveSearchHistory,
  getSearchHistoryList,
  getSearchHistoryDetail,
  db,
  getHtmlContent,
  saveHtmlContent,
  updateSerpResultWithHtmlAnalysis
} from '@/app/services/firebase';
import { Timestamp } from 'firebase-admin/firestore';
import { JSDOM } from 'jsdom';

// Initialize OpenAI client for clustering functionality
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

// 获取数据库统计信息
export async function getFirebaseStats() {
  const stats = await getDatabaseStats();
  return stats;
}

// Regions data from the original Python app
const REGIONS = {
  "香港": "HK", 
  "台灣": "TW",
  "馬來西亞": "MY",
  "新加坡": "SG",
  "美國": "US",
  "韓國": "KR",
};

// 語言映射
const LANGUAGES = {
  'zh-TW': '繁體中文',
  'zh-CN': '簡體中文',
  'en': '英文',
  'ms': '馬來文', // 添加馬來文選項
  'ko': '韓文'
};

// Google Ads API 憑證從環境變量獲取
const DEVELOPER_TOKEN = process.env.DEVELOPER_TOKEN || 'YiAfPNYXVpCaFlKBefQ8_g';
const CLIENT_ID = process.env.CLIENT_ID || '880289378456-ij5d65pvqcb14ron1ge28tl62hf44tug.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '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';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || '1//0e5hZWMy5Ata5CgYIARAAGA4SNwF-L9Irb5871BKi6y5UxAmVPSJ3zdq4HoMsgI3NbaE1J9-v9Uq_Ru2a9YpF3H76Z7w5-zXHddQ';
const LOGIN_CUSTOMER_ID = process.env.LOGIN_CUSTOMER_ID || '5660962344';
const CUSTOMER_ID = process.env.CUSTOMER_ID || '5660962344';
const API_VERSION = 'v19'; // Google Ads API 版本

// 地區代碼映射
const LOCATION_CODES: Record<string, number> = {
  "TW": 2158,   // 台灣
  "HK": 2344,   // 香港
  "US": 2840,   // 美國
  "JP": 2392,   // 日本
  "UK": 2826,   // 英國
  "CN": 2156,   // 中國
  "AU": 2036,   // 澳洲
  "CA": 2124,   // 加拿大
  "SG": 2702,   // 新加坡
  "MY": 2458,   // 馬來西亞
  "DE": 2276,   // 德國
  "FR": 2250,   // 法國
  "KR": 2410,   // 韓國
  "IN": 2356    // 印度
};

// 語言代碼映射
const LANGUAGE_CODES: Record<string, number> = {
  "zh_TW": 1018,  // 繁體中文
  "zh_CN": 1000,  // 簡體中文
  "en": 1000,     // 英文
  "ja": 1005,     // 日文
  "ko": 1012,     // 韓文
  "ms": 1102,     // 馬來文
  "fr": 1002,     // 法文
  "de": 1001,     // 德文
  "es": 1003,     // 西班牙文
};

// Get available regions
export async function getRegions() {
  return { regions: REGIONS, languages: LANGUAGES };
}

// 計算預估處理時間（秒）
function estimateProcessingTime(keywords: string[], withVolume: boolean = false): number {
  // 基本處理時間
  let baseTime = 1.0;
  
  // 關鍵詞數量因素
  const keywordFactor = keywords.length * 0.1;
  
  // 如果需要獲取搜索量，處理時間會更長
  const volumeFactor = withVolume ? keywords.length * 0.5 : 0;
  
  // API 請求批次因素 (每 20 個關鍵詞一批，每批至少 2 秒)
  const batchFactor = withVolume ? Math.ceil(keywords.length / 20) * 2 : 0;
  
  // 總預估時間（秒）
  return Math.ceil(baseTime + keywordFactor + volumeFactor + batchFactor);
}

// Get Google autocomplete suggestions
export async function getKeywordSuggestions(query: string, region: string, language: string, useAlphabet: boolean = true, useSymbols: boolean = false): Promise<SuggestionsResult> {
  'use server';
  
  const symbols = ['?', '!', '@', '#', '$', '%', '&', '*', '(', ')', '-', '+', '=', '[', ']', '{', '}', '|', '\\', '/', '<', '>', ',', '.', ':', ';', '"', "'"];
  const alphabet = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
  
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
      const alphabetPromises = alphabet.map(letter => 
        fetchAutocomplete(`${searchPrefix} ${letter}`, region, language)
      );
      const alphabetResults = await Promise.all(alphabetPromises);
      const flatAlphabetResults = alphabetResults.flat();
      allSuggestions = [...allSuggestions, ...flatAlphabetResults];
    }
    
    // 如果啟用了符號擴展搜索
    if (useSymbols) {
      const symbolPromises = symbols.map(symbol => 
        fetchAutocomplete(`${searchPrefix} ${symbol}`, region, language)
      );
      const symbolResults = await Promise.all(symbolPromises);
      const flatSymbolResults = symbolResults.flat();
      allSuggestions = [...allSuggestions, ...flatSymbolResults];
    }
    
    // 始终过滤简体中文，无论语言设置
    const { detectChineseType, filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    let filteredSuggestions = filterSimplifiedChinese(allSuggestions);
    
    // 移除重複項
    const uniqueSuggestions = [...new Set(filteredSuggestions)];
    
    // 計算獲取搜索量的預估時間
    const estimatedVolumeTime = estimateProcessingTime(uniqueSuggestions, true);
    
    return { 
      suggestions: uniqueSuggestions,
      estimatedProcessingTime: estimatedVolumeTime,
      fromCache: false
    };
  } catch (error) {
    console.error('獲取關鍵詞建議時出錯:', error);
    return { suggestions: [], estimatedProcessingTime: 0, fromCache: false };
  }
}

// 獲取 URL 建議的函數
export async function getUrlSuggestions(formData: UrlFormData): Promise<SuggestionsResult> {
  'use server';
  
  try {
    const { url, region, language } = formData;
    
    if (!url) {
      return { suggestions: [], estimatedProcessingTime: 0, error: 'URL 不能為空' };
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
      return { suggestions: [], estimatedProcessingTime: 0, error: '無法從 URL 提取關鍵詞' };
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
      fromCache: false
    };
  } catch (error) {
    console.error('獲取 URL 建議時出錯:', error);
    return { 
      suggestions: [], 
      estimatedProcessingTime: 0,
      error: error instanceof Error ? error.message : '獲取 URL 建議失敗',
      fromCache: false
    };
  }
}

/**
 * 獲取 OAuth2 訪問令牌
 */
async function getAccessToken(): Promise<string> {
  try {
    // OAuth2 令牌端點
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    
    // 構建請求數據
    const data = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    });
    
    // 發送請求獲取令牌
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: data.toString()
    });
    
    if (!response.ok) {
      throw new Error(`獲取訪問令牌失敗: ${response.status} ${response.statusText}`);
    }
    
    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('獲取訪問令牌過程中發生錯誤:', error);
    throw error;
  }
}

/**
 * 使用 fetch API 發送 Google Ads API 請求
 */
async function fetchKeywordIdeas(keywords: string[], locationId: number, languageId: number): Promise<any> {
  try {
    // 獲取訪問令牌
    const accessToken = await getAccessToken();
    
    // API URL 格式
    const apiUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}:generateKeywordIdeas`;
    
    // 構建請求體 - 按照 curl 命令格式
    const requestBody = {
      language: `languageConstants/${languageId}`,
      geoTargetConstants: [
        `geoTargetConstants/${locationId}`
      ],
      includeAdultKeywords: false,
      keywordPlanNetwork: "GOOGLE_SEARCH",
      keywordSeed: {
        keywords: keywords
      }
    };
    
    console.log(`發送請求到 Google Ads API: ${apiUrl}`);
    
    // 發送請求
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': DEVELOPER_TOKEN,
        'login-customer-id': LOGIN_CUSTOMER_ID
      },
      body: JSON.stringify(requestBody)
    });
    
    // 檢查響應狀態
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`完整錯誤響應: ${errorText}`);
      
      // 嘗試從錯誤響應中提取更多信息
      let detailedError;
      try {
        const errorJson = JSON.parse(errorText);
        detailedError = JSON.stringify(errorJson.error || errorJson, null, 2);
      } catch {
        detailedError = errorText;
      }
      
      throw new Error(`API 請求失敗 (${apiUrl}): ${response.status} ${response.statusText}\n詳細錯誤: ${detailedError}`);
    }
    
    // 解析響應數據
    const data = await response.json();
    console.log(`成功獲取響應數據，關鍵詞數量: ${data.results ? data.results.length : 0}`);
    return data;
  } catch (error) {
    console.error('發送 API 請求過程中發生錯誤:', error);
    throw error; // 直接向上傳播錯誤
  }
}

// 獲取競爭程度描述
function getCompetitionLevel(competitionEnum: number): string {
  const competitionLevels: Record<number, string> = {
    0: "未知",
    1: "低",
    2: "中",
    3: "高",
    4: "超高"
  };
  return competitionLevels[competitionEnum] || String(competitionEnum);
}

// 获取搜索历史列表
export async function fetchSearchHistory(limit: number = 50) {
  'use server';
  try {
    const historyList = await getSearchHistoryList(limit);
    return historyList;
  } catch (error) {
    console.error('獲取搜索歷史失敗:', error);
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    // 其他錯誤情況下返回空數組
    return [];
  }
}

// 获取特定搜索历史的详细信息
export async function fetchSearchHistoryDetail(historyId: string) {
  'use server';
  try {
    const historyDetail = await getSearchHistoryDetail(historyId);
    return historyDetail;
  } catch (error) {
    console.error('獲取搜索歷史詳情失敗:', error);
    // 檢查是否為配額錯誤，如果是，將錯誤向上傳播以便前端處理
    if (error instanceof Error && 
        (error.message.includes('RESOURCE_EXHAUSTED') || 
         error.message.includes('Quota exceeded'))) {
      throw error;
    }
    // 其他錯誤情況下返回空
    return null;
  }
}

// Get search volume data for keywords using Google Ads API
export async function getSearchVolume(keywords: string[], region: string, mainKeyword: string = '', language: string = 'zh-TW'): Promise<SearchVolumeResult> {
  try {
    // 设置批处理大小和开始时间
    const batchSize = 20;
    const startTime = Date.now();
    
    // 计算预估处理时间
    const estimatedTime = estimateProcessingTime(keywords, true);
    
    // 首先过滤简体中文关键词
    const { filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    const filteredKeywords = filterSimplifiedChinese(keywords);
    
    // 去重处理
    const uniqueKeywords = [...new Set(filteredKeywords)];
    
    if (uniqueKeywords.length < keywords.length) {
      console.log(`已移除 ${keywords.length - uniqueKeywords.length} 個重複或簡體中文關鍵詞`);
    }
    
    // 不再尝试从缓存获取搜索量数据，直接从API获取
    console.log(`直接從API獲取 ${region} 地區的關鍵詞搜索量數據`);
    
    // Convert language format if needed
    const apiLanguage = region === 'TW' || region === 'HK' ? 'zh_TW' : 
                     region === 'CN' ? 'zh_CN' : 
                     region === 'MY' ? 'ms' :
                     region === 'KR' ? 'ko' : 'en';
    
    console.log(`獲取 ${region} 地區的關鍵詞搜尋量數據 (語言: ${apiLanguage})`);
    
    // 檢查必要的環境變量
    if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
      throw new Error('缺少 Google Ads API 憑證，請檢查環境變量設置');
    }

    // 定義結果陣列
    const allResults: KeywordVolumeResult[] = [];
    
    // 使用 Map 来跟踪已处理的关键词，避免重复
    const processedKeywords = new Map<string, boolean>();
    
    // 分批處理關鍵詞，避免一次請求過多
    for (let i = 0; i < uniqueKeywords.length; i += batchSize) {
      const batchKeywords = uniqueKeywords.slice(i, i + batchSize);
      
      const locationId = LOCATION_CODES[region.toUpperCase()] || 2158;
      const languageId = LANGUAGE_CODES[apiLanguage] || 1018;
      
      console.log(`處理批次 ${Math.floor(i/batchSize) + 1}，共 ${batchKeywords.length} 個關鍵詞`);
      
      // 使用 fetch API 獲取關鍵詞數據
      const response = await fetchKeywordIdeas(batchKeywords, locationId, languageId);
      
      // 處理 API 響應數據
      const keywordIdeas = response.results || [];
      
      // 處理每個關鍵詞數據
      for (const idea of keywordIdeas) {
        try {
          const text = idea.text || '';
          
          // 跳过已处理的关键词和简体中文
          if (processedKeywords.has(text)) continue;
          if (isSimplifiedChinese(text)) continue;
          
          // 提取指標數據
          const metrics = idea.keywordIdeaMetrics || {};
          
          const result: KeywordVolumeResult = {
            text: text,
            searchVolume: metrics.avgMonthlySearches || 0,
            competition: getCompetitionLevel(metrics.competition || 0),
            competitionIndex: typeof metrics.competitionIndex === 'number' ? Number(metrics.competitionIndex.toFixed(2)) : 0,
            cpc: metrics.lowTopOfPageBidMicros
              ? Number((metrics.lowTopOfPageBidMicros / 1000000).toFixed(2))
              : null,
          };
          
          allResults.push(result);
          processedKeywords.set(text, true);
          
          // 移除不必要的 logging
        } catch (itemError) {
          console.error(`處理關鍵詞數據時出錯:`, itemError);
          // 繼續處理下一個項目
        }
      }
      
      // 如果不是最後一批，添加延遲以避免 API 限制
      if (i + batchSize < uniqueKeywords.length) {
        console.log('等待 1 秒避免 API 限制...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // 按搜索量降序排序
    const sortedResults = allResults.sort((a, b) => b.searchVolume - a.searchVolume);
    
    // 计算实际处理时间（秒）
    const actualTime = Math.ceil((Date.now() - startTime) / 1000);
    
    // 不再缓存批量搜索结果到数据库
    
    // 只保存搜索历史
    let historyId = null;
    if (mainKeyword) {
      historyId = await saveSearchHistory(mainKeyword, region, language, uniqueKeywords, sortedResults);
      console.log(`已保存搜索歷史，ID: ${historyId}`);
    }
    
    return { 
      results: sortedResults,
      processingTime: {
        estimated: estimatedTime,
        actual: actualTime
      },
      fromCache: false,
      historyId
    };
  } catch (error) {
    console.error('獲取搜索量數據時出錯:', error);
    throw error; // 向上傳播錯誤
  }
}

// 检查字符串是否为简体中文
function isSimplifiedChinese(text: string): boolean {
  const { detectChineseType } = require('@/utils/chineseDetector');
  const type = detectChineseType(text);
  return type === 'simplified';
}

// 分析 SERP (搜尋引擎結果頁面)
export async function getSerpAnalysis(keywords: string[], region: string, language: string, maxResults: number = 100) {
  'use server';
  
  // 強制將maxResults設置為100，無論傳入的值是什麼
  maxResults = 100;
  
  try {
    if (!keywords || keywords.length === 0) {
      throw new Error('必須提供至少一個關鍵詞');
    }
    
    // 增加關鍵詞處理數量上限
    const MAX_KEYWORDS = 100;
    const limitedKeywords = keywords.slice(0, MAX_KEYWORDS);
    
    console.log(`開始分析關鍵詞 SERP 數據: ${limitedKeywords.join(', ')} (共 ${limitedKeywords.length} 個關鍵詞)`);
    
    // 獲取緩存結果
    try {
      const cacheResults = await getCachedSerpResults(limitedKeywords, region, language);
      if (cacheResults) {
        console.log('使用緩存的 SERP 分析結果');
        return {
          results: cacheResults,
          fromCache: true,
          totalKeywords: limitedKeywords.length
        };
      }
    } catch (cacheError) {
      // 如果是配額錯誤，記錄警告但繼續執行
      if (cacheError instanceof Error && 
          (cacheError.message.includes('RESOURCE_EXHAUSTED') || 
           cacheError.message.includes('Quota exceeded'))) {
        console.warn("Firebase 配額已用盡，無法檢查 SERP 緩存。繼續從 API 獲取數據。");
      } else {
        console.error("緩存檢查失敗，但將繼續從 API 獲取：", cacheError);
      }
    }
    
    // 使用正確的 Apify Actor ID 和 API 方式
    const apiToken = 'apify_api_n4QsZ7oEbTf359GZDTdb05i1U449og3Qzre3';
    const actorId = 'nFJndFXA5zjCTuudP';
    const apiUrl = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiToken}`;
    
    // 確保國家代碼為小寫，因為 Apify API 要求 countryCode 必須是小寫
    const countryCode = region ? region.toLowerCase() : "";
    
    // 準備請求體 - 確保格式與原始示例匹配
    const requestBody = {
      queries: limitedKeywords.join('\n'),
      resultsPerPage: maxResults,
      maxPagesPerQuery: 1,
      languageCode: language || "",
      countryCode: countryCode,
      forceExactMatch: false,
      mobileResults: false,
      includeUnfilteredResults: false,
      saveHtml: false,
      saveHtmlToKeyValueStore: false,
      includeIcons: false
    };
    
    console.log(`調用 Apify API 獲取 SERP 數據...(國家代碼: ${countryCode})`);
    
    // 發送請求到 Apify API
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
    
    if (!response.ok) {
      // 嘗試獲取更詳細的錯誤信息
      let errorDetails = '';
      try {
        const errorResponse = await response.text();
        errorDetails = `: ${errorResponse}`;
      } catch (e) {
        // 無法讀取詳細錯誤
      }
      
      throw new Error(`Apify API 請求失敗: ${response.status} ${response.statusText}${errorDetails}`);
    }
    
    // 解析 API 回應
    const items = await response.json();
    
    console.log(`API 返回了 ${Array.isArray(items) ? items.length : 0} 個項目`);
    
    // 處理和解析結果數據
    const processedResults = await processApifyResults(items);
    
    const actualKeywordCount = Object.keys(processedResults).length;
    console.log(`實際處理了 ${actualKeywordCount} 個關鍵詞的結果`);
    
    // 嘗試緩存結果，但不中斷流程
    try {
      await cacheSerpResults(limitedKeywords, region, language, processedResults);
    } catch (cacheError) {
      if (cacheError instanceof Error && 
          (cacheError.message.includes('RESOURCE_EXHAUSTED') || 
           cacheError.message.includes('Quota exceeded'))) {
        console.warn("Firebase 配額已用盡，無法緩存 SERP 結果。但結果仍會返回給用戶。");
      } else {
        console.error("緩存 SERP 結果失敗，但程序將繼續：", cacheError);
      }
    }
    
    return {
      results: processedResults,
      fromCache: false,
      totalKeywords: actualKeywordCount
    };
  } catch (error) {
    console.error('獲取 SERP 分析失敗:', error);
    throw error;
  }
}

// 處理 Apify 結果數據
async function processApifyResults(items: any[]) {
  const results: Record<string, any> = {};
  
  console.log('Apify API 回傳的原始資料:', JSON.stringify(items).substring(0, 200) + '...');
  
  if (!Array.isArray(items) || items.length === 0) {
    console.log('API 未返回有效資料，返回空結果');
    return {};
  }
  
  for (const item of items) {
    try {
      // 找到這個項目對應的關鍵詞
      let keyword = '';
      
      // 處理新API格式 - 從 searchQuery.term 中獲取關鍵詞
      if (item.searchQuery && item.searchQuery.term) {
        keyword = item.searchQuery.term;
      } else {
        // 兼容舊格式
        keyword = item.searchQuery || '';
      }
      
      if (!keyword) {
        console.log('跳過沒有關鍵詞的項目');
        continue;
      }
      
      console.log(`處理關鍵詞 "${keyword}" 的結果`);
      
      // 處理搜索結果
      const searchResults = item.organicResults || [];
      
      if (searchResults.length === 0) {
        console.log(`關鍵詞 "${keyword}" 沒有找到有機搜索結果`);
      }
      
      // 提取重要資訊
      const processedResults = searchResults.map((result: any) => ({
        title: result.title || '',
        url: result.url || '',
        displayUrl: result.displayedUrl || result.url || '',
        position: result.position || 0,
        description: result.description || '',
        siteLinks: result.siteLinks || [],
        emphasizedKeywords: result.emphasizedKeywords || [], // 保存強調關鍵詞
        htmlAnalysis: null // 初始化 HTML 分析結果為 null
      }));
      
      // 分析結果數據
      const analysis = analyzeSerpResults(processedResults);
      
      // 保存結果 - 擴展以包含更多有價值信息
      results[keyword] = {
        results: processedResults,
        analysis,
        timestamp: new Date().toISOString(),
        originalQuery: keyword,
        queryDetails: item.searchQuery || {}, // 完整的查詢詳情
        totalResults: item.resultsTotal || 0, // 總結果數量
        relatedQueries: item.relatedQueries || [], // 相關查詢
        peopleAlsoAsk: item.peopleAlsoAsk || [], // 人們也在問
        rawData: item // 保存原始完整資料以備後用
      };
      
      console.log(`已處理關鍵詞 "${keyword}" 的搜索結果，找到 ${processedResults.length} 個結果`);
      console.log(`相關查詢數量: ${(item.relatedQueries || []).length}`);
    } catch (error) {
      console.error('處理 SERP 結果項目時出錯:', error);
    }
  }
  
  console.log(`成功處理了 ${Object.keys(results).length} 個關鍵詞的 SERP 結果`);
  return results;
}

// 分析 SERP 結果並提取見解
function analyzeSerpResults(results: any[]) {
  const analysis = {
    totalResults: results.length,
    domains: {} as Record<string, number>,
    topDomains: [] as string[],
    avgTitleLength: 0,
    avgDescriptionLength: 0,
  };
  
  let totalTitleLength = 0;
  let totalDescLength = 0;
  
  // 計算各種指標
  for (const result of results) {
    // 提取域名
    try {
      const url = new URL(result.url);
      const domain = url.hostname;
      analysis.domains[domain] = (analysis.domains[domain] || 0) + 1;
    } catch (e) {
      // URL 解析錯誤，跳過
    }
    
    // 累計標題和描述長度
    if (result.title) totalTitleLength += result.title.length;
    if (result.description) totalDescLength += result.description.length;
  }
  
  // 計算平均值
  if (results.length > 0) {
    analysis.avgTitleLength = Math.round(totalTitleLength / results.length);
    analysis.avgDescriptionLength = Math.round(totalDescLength / results.length);
  }
  
  // 獲取頂級域名
  analysis.topDomains = Object.entries(analysis.domains)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([domain]) => domain);
  
  return analysis;
}

// 從 Firebase 獲取緩存的 SERP 結果
async function getCachedSerpResults(keywords: string[], region: string, language: string) {
  if (!db) return null;
  
  try {
    const cacheId = generateCacheId(keywords, region, language);
    const docSnap = await db.collection('serpResults').doc(cacheId).get();
    
    if (docSnap.exists) {
      const data = docSnap.data();
      if (!data) return null;
      
      const timestamp = data.timestamp.toDate();
      const now = new Date();
      
      // 檢查緩存是否過期 (7天)
      const CACHE_EXPIRY_TIME = 7 * 24 * 60 * 60 * 1000;
      if (now.getTime() - timestamp.getTime() < CACHE_EXPIRY_TIME) {
        console.log(`使用緩存的 SERP 結果: ${cacheId}`);
        return data.results;
      } else {
        console.log(`緩存已過期: ${cacheId}`);
      }
    }
    return null;
  } catch (error) {
    console.error("獲取緩存 SERP 結果時出錯:", error);
    return null;
  }
}

// 將 SERP 結果緩存到 Firebase
async function cacheSerpResults(keywords: string[], region: string, language: string, results: any) {
  if (!db) return;
  
  try {
    // 確保結果是可序列化的（轉換為純 JSON 並重新解析）
    // 這會移除任何不可序列化的元素，如日期、函數、循環引用等
    const serializableResults = JSON.parse(JSON.stringify(results));
    
    // 為每個關鍵詞結果添加原始查詢關鍵詞字段
    Object.keys(serializableResults).forEach(key => {
      if (serializableResults[key] && typeof serializableResults[key] === 'object') {
        serializableResults[key].originalQuery = key;
      }
    });
    
    const cacheId = generateCacheId(keywords, region, language);
    await db.collection('serpResults').doc(cacheId).set({
      keywords,  // 保存原始關鍵詞列表
      region,
      language,
      results: serializableResults,
      timestamp: Timestamp.now(),
      searchQueries: keywords, // 額外保存搜索查詢，以便直接訪問
    });
    console.log(`已緩存 SERP 結果: ${cacheId}`);
  } catch (error) {
    console.error("緩存 SERP 結果時出錯:", error);
  }
}

// 生成緩存 ID
function generateCacheId(keywords: string[], region: string, language: string): string {
  // 對關鍵詞排序並加入，確保相同關鍵詞集合有相同的 ID
  const keywordsStr = keywords.sort().join(',');
  return `${keywordsStr}_${region}_${language}`;
}

// Perform semantic clustering of keywords
export async function getSemanticClustering(keywords: string[]) {
  try {
    if (keywords.length < 5) {
      throw new Error('At least 5 keywords needed for clustering');
    }
    
    // 計算預估處理時間
    const estimatedTime = Math.ceil(5 + keywords.length * 0.2); // OpenAI 通常需要幾秒鐘
    
    // 限制處理的關鍵詞數量
    const MAX_CLUSTERING_KEYWORDS = 100;
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    
    // Instead of direct OpenAI API call, direct client to use our streaming API
    // The actual clustering logic is now in app/api/semantic-clustering/route.ts
    return {
      clusters: {},
      processingTime: {
        estimated: estimatedTime,
        actual: 0
      },
      // This indicates to the client that it should use the streaming API
      useStreamingApi: true,
      // Pass the limited keywords to be used by the client
      limitedKeywords
    };
  } catch (error) {
    console.error('Error clustering keywords:', error);
    
    // Fallback: create basic clusters by first letter
    const fallbackClusters: Record<string, string[]> = {};
    
    keywords.forEach(keyword => {
      const firstChar = keyword.charAt(0).toUpperCase();
      if (!fallbackClusters[firstChar]) {
        fallbackClusters[firstChar] = [];
      }
      fallbackClusters[firstChar].push(keyword);
    });
    
    return { clusters: fallbackClusters, processingTime: { estimated: 0, actual: 0 } };
  }
}

// Helper function to fetch Google autocomplete suggestions
async function fetchAutocomplete(query: string, region: string = 'TW', language: string = 'zh-TW') {
  try {
    // Add a small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&gl=${region}&hl=${language}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      },
    });
    
    // Google autocomplete returns [query, suggestions] format
    const data = await response.json();
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
      return data[1];
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching autocomplete:', error);
    return [];
  }
}

// 分析網頁 HTML 內容
export async function analyzeHtmlContent(url: string, keyword: string, cacheId: string) {
  try {
    // 使用 GET 請求，將 URL 作為參數
    const response = await fetch(`https://slug-unique-possum.ngrok-free.app/extract-html?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API 請求失敗: ${response.status}`);
    }

    // 獲取 HTML 內容
    const htmlContent = await response.text();
    
    // 使用 jsdom 解析 HTML
    const dom = new JSDOM(htmlContent);
    const doc = dom.window.document;
    
    // 提取標題
    const h1s = Array.from(doc.getElementsByTagName('h1')).map((h1: Element) => h1.textContent || '');
    const h2s = Array.from(doc.getElementsByTagName('h2')).map((h2: Element) => h2.textContent || '');
    const h3s = Array.from(doc.getElementsByTagName('h3')).map((h3: Element) => h3.textContent || '');

    // 檢查 H1 一致性
    const h1Consistency = h1s.length > 0 && h1s.every(h1 => 
      h1.toLowerCase().includes(keyword.toLowerCase())
    );

    // 準備分析結果 - 不包含完整 HTML
    const htmlAnalysis = {
      h1: h1s,
      h2: h2s,
      h3: h3s,
      h1Consistency,
      html: '' // 保持字段但不存儲內容
    };

    // 更新 SERP 結果
    await updateSerpResultWithHtmlAnalysis(cacheId, keyword, url, htmlAnalysis);

    return htmlAnalysis;
  } catch (error) {
    console.error('分析 HTML 內容時出錯:', error);
    throw error;
  }
}

// 批量分析 SERP 結果的 HTML 內容
export async function analyzeSerpResultsHtml(keywords: string[], region: string, language: string) {
  try {
    const cacheId = generateCacheId(keywords, region, language);
    const results = await getCachedSerpResults(keywords, region, language);
    
    if (!results) {
      throw new Error('找不到 SERP 結果');
    }

    const analysisPromises: Promise<any>[] = [];

    // 對每個關鍵詞的前 10 個結果進行分析
    for (const keyword of keywords) {
      if (results[keyword]?.results) {
        const topResults = results[keyword].results.slice(0, 10);
        
        for (const result of topResults) {
          analysisPromises.push(
            analyzeHtmlContent(result.url, keyword, cacheId)
              .catch(error => {
                console.error(`分析 ${result.url} 時出錯:`, error);
                return null;
              })
          );
        }
      }
    }

    // 等待所有分析完成
    await Promise.all(analysisPromises);

    return {
      success: true,
      message: 'HTML 內容分析完成',
    };
  } catch (error) {
    console.error('批量分析 HTML 內容時出錯:', error);
    throw error;
  }
} 