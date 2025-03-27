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
  getSearchHistoryDetail
} from '@/app/services/firebase';

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

// Perform semantic clustering of keywords
export async function getSemanticClustering(keywords: string[]) {
  try {
    if (keywords.length < 5) {
      throw new Error('At least 5 keywords needed for clustering');
    }
    
    // 計算預估處理時間
    const estimatedTime = Math.ceil(5 + keywords.length * 0.2); // OpenAI 通常需要幾秒鐘
    const startTime = Date.now();
    
    // 限制處理的關鍵詞數量
    const MAX_CLUSTERING_KEYWORDS = 100;
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    
    // 使用與 chat.py 相同的提示語和模型設定
    const prompt = `請根據以下關鍵詞進行語意分群。目標是將相關的關鍵詞歸類到主題中。

語意辨識的方法，是根據能否至放到同一篇文章，作為 listicle 為依據，不是以 SEO 為主，例如：不以基本知識這種概括詞分群
    
請按以下 JSON 格式返回結果：
{
  "clusters": {
    "主題名稱1": ["關鍵詞1", "關鍵詞2", ...],
    "主題名稱2": ["關鍵詞3", "關鍵詞4", ...],
    ...
  }
}

注意事項：
1. 主題名稱應簡潔明了
2. 盡量讓每個主題包含關聯性強的關鍵詞
3. 如果有關鍵詞難以歸類，可以放入"其他"類別
4. 不要遺漏任何關鍵詞
5. 確保返回的是有效的 JSON 格式

關鍵詞列表：
${limitedKeywords.join(', ')}`;
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",  // 使用與 chat.py 相同的模型
      messages: [
        { role: "system", "content": prompt }
      ],
      temperature: 0.7,  // 保持一定的創造性
      response_format: { type: "json_object" },
    });
    
    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }
    
    const clusters = JSON.parse(content) as ClusteringResult;
    
    // 計算實際處理時間（秒）
    const actualTime = Math.ceil((Date.now() - startTime) / 1000);
    
    return {
      ...clusters,
      processingTime: {
        estimated: estimatedTime,
        actual: actualTime
      }
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