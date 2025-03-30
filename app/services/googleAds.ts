import { API_VERSION, LANGUAGE_CODES, LOCATION_CODES } from '@/app/config/constants';
import { KeywordVolumeResult, SearchVolumeResult } from '@/app/types';
import { estimateProcessingTime, isSimplifiedChinese } from '@/lib/utils-common';

// Google Ads API 憑證從環境變量獲取
const DEVELOPER_TOKEN = process.env.DEVELOPER_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';
const LOGIN_CUSTOMER_ID = process.env.LOGIN_CUSTOMER_ID || '';
const CUSTOMER_ID = process.env.CUSTOMER_ID || '';

/**
 * 獲取 OAuth2 訪問令牌
 */
export async function getAccessToken(): Promise<string> {
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
 * 使用 fetch API 發送 Google Ads API 請求，獲取關鍵詞數據
 */
export async function fetchKeywordIdeas(keywords: string[], locationId: number, languageId: number): Promise<any> {
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

/**
 * 獲取競爭程度描述
 */
export function getCompetitionLevel(competitionEnum: number): string {
  const competitionLevels: Record<number, string> = {
    0: "未知",
    1: "低",
    2: "中",
    3: "高",
    4: "超高"
  };
  return competitionLevels[competitionEnum] || String(competitionEnum);
}

/**
 * 使用 Google Autocomplete API 獲取關鍵詞建議
 */
export async function fetchAutocomplete(query: string, region: string = 'TW', language: string = 'zh-TW') {
  try {
    // Add a small delay to avoid rate limiting - reduced from 300ms to 50ms
    await new Promise(resolve => setTimeout(resolve, 50));
    
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

/**
 * 使用 Google Autocomplete API 獲取關鍵詞建議，添加50ms延遲
 * 這個函數專門用於前端點擊關鍵詞卡片時獲取補充關鍵詞
 */
export async function fetchSuggestionWithDelay(query: string, region: string = 'TW', language: string = 'zh-TW') {
  try {
    // 增加延遲到200ms，避免過快請求導致API限制
    await new Promise(resolve => setTimeout(resolve, 200));
    
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
    console.error('Error fetching autocomplete with delay:', error);
    return [];
  }
}

/**
 * 獲取關鍵詞搜索量數據
 */
export async function getSearchVolume(
  keywords: string[], 
  region: string, 
  mainKeyword: string = '', 
  language: string = 'zh-TW', 
  clusters: Record<string, string[]> | null = null
): Promise<SearchVolumeResult> {
  const sourceInfo = '數據來源: Google Ads API';
  const startTime = Date.now();
  let estimatedTime = 0;
  
  try {
    // 設置批處理大小
    const batchSize = 20;
    
    // 計算預估處理時間 (移到這裡以便在錯誤時也能返回)
    estimatedTime = estimateProcessingTime(keywords, true);
    
    // 首先過濾簡體中文關鍵詞
    const { filterSimplifiedChinese } = await import('@/utils/chineseDetector');
    const filteredKeywords = filterSimplifiedChinese(keywords);
    
    // 去重處理
    const uniqueKeywords = [...new Set(filteredKeywords)];
    
    if (uniqueKeywords.length < keywords.length) {
      console.log(`已移除 ${keywords.length - uniqueKeywords.length} 個重複或簡體中文關鍵詞`);
    }
    
    console.log(`直接從API獲取 ${region} 地區的關鍵詞搜索量數據`);
    
    // 轉換語言格式
    const apiLanguage = region === 'TW' || region === 'HK' ? 'zh_TW' : 
                     region === 'CN' ? 'zh_CN' : 
                     region === 'MY' ? 'ms' :
                     region === 'KR' ? 'ko' : 'en';
    console.log(`獲取 ${region} 地區的關鍵詞搜尋量數據 (語言: ${apiLanguage})`);
    if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
      throw new Error('缺少 Google Ads API 憑證，請檢查環境變量設置');
    }

    const allResults: KeywordVolumeResult[] = [];
    const processedKeywords = new Map<string, boolean>();
    
    // 分批處理關鍵詞
    for (let i = 0; i < uniqueKeywords.length; i += batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const batchKeywords = uniqueKeywords.slice(i, i + batchSize);
      const locationId = LOCATION_CODES[region.toUpperCase()] || 2158;
      const languageId = LANGUAGE_CODES[apiLanguage] || 1018;
      console.log(`處理批次 ${Math.floor(i/batchSize) + 1}，共 ${batchKeywords.length} 個關鍵詞`);
      const response = await fetchKeywordIdeas(batchKeywords, locationId, languageId);
      const keywordIdeas = response.results || [];
      
      for (const idea of keywordIdeas) {
        try {
          const text = idea.text || '';
          if (processedKeywords.has(text)) continue;
          if (isSimplifiedChinese(text)) continue;
          const metrics = idea.keywordIdeaMetrics || {};
          
          // 明確解析 searchVolume 為數字
          const rawSearchVolume = metrics.avgMonthlySearches;
          let searchVolumeValue = 0; // 默認為 0
          if (rawSearchVolume != null) {
              const parsed = parseInt(String(rawSearchVolume), 10);
              if (!isNaN(parsed)) {
                  searchVolumeValue = parsed;
              }
          }
          
          const result: KeywordVolumeResult = {
            text: text,
            searchVolume: searchVolumeValue, // 使用解析後的值
            competition: getCompetitionLevel(metrics.competition || 0),
            competitionIndex: typeof metrics.competitionIndex === 'number' ? Number(metrics.competitionIndex.toFixed(2)) : 0,
            cpc: metrics.lowTopOfPageBidMicros
              ? Number((metrics.lowTopOfPageBidMicros / 1000000).toFixed(2))
              : null,
          };
          allResults.push(result);
          processedKeywords.set(text, true);
        } catch (itemError) {
          console.error(`處理關鍵詞 "${idea.text}" 時出錯:`, itemError);
        }
      }
    }
    
    // 計算實際處理時間
    const endTime = Date.now();
    const actualTime = Math.round((endTime - startTime) / 1000);
    
    console.log(`成功獲取 ${allResults.length} 個關鍵詞的搜索量數據`);

    return {
      results: allResults,
      processingTime: {
        estimated: estimatedTime,
        actual: actualTime
      },
      fromCache: false,
      sourceInfo: sourceInfo
    };

  } catch (error) {
    console.error('獲取搜索量數據時出錯:', error);
    const endTime = Date.now();
    const actualTime = Math.round((endTime - startTime) / 1000);
    
    // 返回錯誤結果
    return {
      results: [],
      processingTime: {
        estimated: estimatedTime,
        actual: actualTime
      },
      fromCache: false,
      sourceInfo: sourceInfo,
      error: error instanceof Error ? error.message : '獲取搜索量數據失敗'
    };
  }
} 