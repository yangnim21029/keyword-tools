// --- Google Ads API Functions and constants ---

// Remove import of API_VERSION from constants
// import { API_VERSION } from '@/app/config/constants';

// Remove imports of utility functions
// import { estimateProcessingTime, isSimplifiedChinese } from '@/lib/utils-common';

import { KeywordVolumeResult, SearchVolumeResult } from '@/app/types';

// Add API_VERSION constant directly in this file
/**
 * Google Ads API version
 */
const API_VERSION = 'v19';

// Add utility functions directly in this file
/**
 * Estimates processing time (in seconds)
 * @param keywords Array of keywords
 * @param withVolume Whether search volume data is needed
 * @returns Estimated processing time in seconds
 */
export function estimateProcessingTime(keywords: string[], withVolume: boolean = false): number {
  // Base processing time
  let baseTime = 1.0;
  
  // Keyword count factor
  const keywordFactor = keywords.length * 0.1;
  
  // If search volume is needed, processing time is longer
  const volumeFactor = withVolume ? keywords.length * 0.5 : 0;
  
  // API request batch factor (20 keywords per batch, at least 2 seconds per batch)
  const batchFactor = withVolume ? Math.ceil(keywords.length / 20) * 2 : 0;
  
  // Total estimated time (seconds)
  return Math.ceil(baseTime + keywordFactor + volumeFactor + batchFactor);
}

// 整合 chineseDetector.ts 功能 - 簡體/繁體中文檢測

// 簡體中文和繁體中文對照表 (常用字)
const simplifiedToTraditional: Record<string, string> = {
  '个': '個', '东': '東', '丝': '絲', '丢': '丟', '两': '兩', '严': '嚴', '丧': '喪',
  '丰': '豐', '临': '臨', '为': '為', '丽': '麗', '举': '舉', '么': '麼',
  '义': '義', '乌': '烏', '乐': '樂', '乔': '喬', '习': '習', '乡': '鄉', '书': '書',
  '买': '買', '乱': '亂', '争': '爭', '于': '於', '亏': '虧', '云': '雲', '亚': '亞',
  '产': '產', '亩': '畝', '亲': '親', '亵': '褻', '亿': '億', '仅': '僅', '从': '從',
  '仑': '侖', '仓': '倉', '仪': '儀', '们': '們', '价': '價', '众': '眾', '优': '優',
  '伙': '夥', '会': '會', '伟': '偉', '传': '傳', '伤': '傷', '伦': '倫', '伪': '偽',
  '体': '體', '佣': '傭', '佬': '佬', '侠': '俠', '侧': '側', '侨': '僑', '侬': '儂',
  '俣': '俁', '俦': '儔', '俨': '儼', '俩': '倆', '俭': '儉', '债': '債', '倾': '傾',
  '偬': '傯', '偻': '僂', '伥': '倀', '偾': '僨', '偿': '償', '杂': '雜', '鸡': '雞',
  '阳': '陽', '阴': '陰', '阵': '陣', '阶': '階','尔': '爾', '邬': '鄔', '邙': '鄣','图': '圖','卢': '盧', '贝': '貝','达': '達', '逻': '邏', '辑': '輯'
};

/**
 * 檢測文字是否為簡體中文
 * @param text 要檢查的文字
 * @returns 是否為簡體中文
 */
function isSimplifiedChinese(text: string): boolean {
  const type = detectChineseType(text);
  return type === 'simplified';
}

/**
 * 檢測文字的中文類型
 * @param text 要檢查的文字
 * @returns 中文類型: 'simplified'(簡體中文), 'traditional'(繁體中文), 'mixed'(混合), 'none'(非中文)
 */
export function detectChineseType(text: string): 'simplified' | 'traditional' | 'mixed' | 'none' {
  let hasSimplified = false;
  let hasTraditional = false;
  let hasChineseChars = false;

  // 檢查每個字符
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    // 判斷是否為中文字符
    if (/[\u4e00-\u9fa5]/.test(char)) {
      hasChineseChars = true;
      
      // 檢查是否為簡體字
      if (char in simplifiedToTraditional) {
        hasSimplified = true;
      } else {
        // 檢查字符是否為繁體字
        for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
          if (char === traditional) {
            hasTraditional = true;
            break;
          }
        }
      }
    }
  }

  // 根據檢測結果返回類型
  if (!hasChineseChars) {
    return 'none';
  } else if (hasSimplified && hasTraditional) {
    return 'mixed';
  } else if (hasSimplified) {
    return 'simplified';
  } else {
    return 'traditional';
  }
}

/**
 * 過濾掉簡體中文關鍵詞
 * @param keywords 關鍵詞數組
 * @returns 過濾後的關鍵詞數組
 */
export function filterSimplifiedChinese(keywords: string[]): string[] {
  return keywords.filter(keyword => {
    const type = detectChineseType(keyword);
    return type !== 'simplified';
  });
}

// Add location and language code mappings
/**
 * Location Code Mapping for Google Ads API
 */
const LOCATION_CODES: Record<string, number> = {
  "TW": 2158,   // Taiwan
  "HK": 2344,   // Hong Kong
  "US": 2840,   // United States
  "JP": 2392,   // Japan
  "UK": 2826,   // United Kingdom
  "CN": 2156,   // China
  "AU": 2036,   // Australia
  "CA": 2124,   // Canada
  "SG": 2702,   // Singapore
  "MY": 2458,   // Malaysia
  "DE": 2276,   // Germany
  "FR": 2250,   // France
  "KR": 2410,   // South Korea
  "IN": 2356    // India
};

/**
 * Language Code Mapping for Google Ads API
 */
const LANGUAGE_CODES: Record<string, number> = {
  "zh_TW": 1018,  // Traditional Chinese
  "zh_CN": 1000,  // Simplified Chinese
  "en": 1000,     // English
  "ja": 1005,     // Japanese
  "ko": 1012,     // Korean
  "ms": 1102,     // Malay
  "fr": 1002,     // French
  "de": 1001,     // German
  "es": 1003,     // Spanish
};

// Google Ads API Credentials (Ensure these are properly configured in your environment)
const DEVELOPER_TOKEN = process.env.DEVELOPER_TOKEN || '';
const CLIENT_ID = process.env.CLIENT_ID || '';
const CLIENT_SECRET = process.env.CLIENT_SECRET || '';
const REFRESH_TOKEN = process.env.REFRESH_TOKEN || '';
const LOGIN_CUSTOMER_ID = process.env.LOGIN_CUSTOMER_ID || '';
const CUSTOMER_ID = process.env.CUSTOMER_ID || '';

/**
 * Gets OAuth2 access token.
 */
export async function getAccessToken(): Promise<string> {
  try {
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const data = new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token'
    });
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: data.toString()
    });
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
    }
    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

/**
 * Fetches keyword ideas from Google Ads API.
 */
export async function fetchKeywordIdeas(keywords: string[], locationId: number, languageId: number): Promise<any> {
  try {
    const accessToken = await getAccessToken();
    const apiUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}:generateKeywordIdeas`;
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
    console.log(`Sending request to Google Ads API: ${apiUrl}`);
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
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Full error response: ${errorText}`);
      let detailedError;
      try {
        const errorJson = JSON.parse(errorText);
        detailedError = JSON.stringify(errorJson.error || errorJson, null, 2);
      } catch {
        detailedError = errorText;
      }
      throw new Error(`API request failed (${apiUrl}): ${response.status} ${response.statusText}\nDetailed error: ${detailedError}`);
    }
    const data = await response.json();
    console.log(`Successfully received response, keywords count: ${data.results ? data.results.length : 0}`);
    return data;
  } catch (error) {
    console.error('Error sending API request:', error);
    throw error;
  }
}

/**
 * Gets competition level description.
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
 * Gets keyword search volume data.
 */
export async function getSearchVolume(
  keywords: string[],
  region: string,
  mainKeyword: string = '',
  language: string = 'zh-TW',
  clusters: Record<string, string[]> | null = null
): Promise<SearchVolumeResult> {
  const startTime = Date.now();
  const estimatedTime = estimateProcessingTime(keywords, true);
  let sourceInfo = "Google Ads API";

  try {
    const batchSize = 20;
    const filteredKeywords = filterSimplifiedChinese(keywords);
    const uniqueKeywords = [...new Set(filteredKeywords)];
    if (uniqueKeywords.length < keywords.length) {
      console.log(`Removed ${keywords.length - uniqueKeywords.length} duplicate or simplified Chinese keywords`);
    }
    console.log(`Fetching search volume data for ${region} directly from API`);
    const apiLanguage = region === 'TW' || region === 'HK' ? 'zh_TW' :
                     region === 'CN' ? 'zh_CN' :
                     region === 'MY' ? 'ms' :
                     region === 'KR' ? 'ko' : 'en';
    console.log(`Fetching search volume data for ${region} (Language: ${apiLanguage})`);
    if (!DEVELOPER_TOKEN || !CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID) {
      throw new Error('Missing Google Ads API credentials, check environment variables');
    }
    const allResults: KeywordVolumeResult[] = [];
    const processedKeywords = new Map<string, boolean>();
    for (let i = 0; i < uniqueKeywords.length; i += batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100));
      const batchKeywords = uniqueKeywords.slice(i, i + batchSize);
      const locationId = LOCATION_CODES[region.toUpperCase()] || 2158;
      const languageId = LANGUAGE_CODES[apiLanguage] || 1018;
      console.log(`Processing batch ${Math.floor(i/batchSize) + 1}, ${batchKeywords.length} keywords`);
      const response = await fetchKeywordIdeas(batchKeywords, locationId, languageId);
      const keywordIdeas = response.results || [];
      for (const idea of keywordIdeas) {
        try {
          const text = idea.text || '';
          if (processedKeywords.has(text)) continue;
          if (isSimplifiedChinese(text)) continue;
          const metrics = idea.keywordIdeaMetrics || {};
          const rawSearchVolume = metrics.avgMonthlySearches;
          let searchVolumeValue = 0;
          if (rawSearchVolume != null) {
              const parsed = parseInt(String(rawSearchVolume), 10);
              if (!isNaN(parsed)) {
                  searchVolumeValue = parsed;
              }
          }
          const result: KeywordVolumeResult = {
            text: text,
            searchVolume: searchVolumeValue,
            competition: getCompetitionLevel(metrics.competition || 0),
            competitionIndex: typeof metrics.competitionIndex === 'number' ? Number(metrics.competitionIndex.toFixed(2)) : 0,
            cpc: metrics.lowTopOfPageBidMicros
              ? Number((metrics.lowTopOfPageBidMicros / 1000000).toFixed(2))
              : null,
          };
          allResults.push(result);
          processedKeywords.set(text, true);
        } catch (itemError) {
          console.error(`Error processing keyword \"${idea.text}\":`, itemError);
        }
      }
    }
    const endTime = Date.now();
    const actualTime = Math.round((endTime - startTime) / 1000);
    console.log(`Successfully fetched search volume data for ${allResults.length} keywords`);
    return {
      results: allResults,
      processingTime: {
        estimated: estimatedTime,
        actual: actualTime
      },
      sourceInfo: sourceInfo,
      historyId: null
    };
  } catch (error: any) {
    console.error('Error fetching search volume:', error);
    const endTime = Date.now();
    const actualTime = Math.round((endTime - startTime) / 1000);
    const errorMessage = error.message || '無法獲取關鍵詞搜索量數據';
    return {
      results: [],
      processingTime: {
        estimated: 0,
        actual: actualTime,
      },
      error: errorMessage,
      sourceInfo: "Error",
      historyId: null
    };
  }
} 