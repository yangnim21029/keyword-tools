// --- Google Ads API Functions and constants ---

import { KeywordVolumeItem, KeywordVolumeResult } from '@/lib/schema';

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
export function estimateProcessingTime(
  keywords: string[],
  withVolume: boolean = false
): number {
  // Base processing time
  const baseTime = 1.0;

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
  樱: '櫻',
  晒: '曬',
  个: '個',
  东: '東',
  丝: '絲',
  丢: '丟',
  两: '兩',
  严: '嚴',
  丧: '喪',
  丰: '豐',
  临: '臨',
  为: '為',
  丽: '麗',
  举: '舉',
  么: '麼',
  义: '義',
  乌: '烏',
  乐: '樂',
  乔: '喬',
  习: '習',
  乡: '鄉',
  书: '書',
  买: '買',
  乱: '亂',
  争: '爭',
  于: '於',
  亏: '虧',
  云: '雲',
  亚: '亞',
  产: '產',
  亩: '畝',
  亲: '親',
  亿: '億',
  仅: '僅',
  从: '從',
  仑: '侖',
  仓: '倉',
  仪: '儀',
  们: '們',
  价: '價',
  众: '眾',
  优: '優',
  伙: '夥',
  会: '會',
  伟: '偉',
  传: '傳',
  伤: '傷',
  伦: '倫',
  伪: '偽',
  体: '體',
  佣: '傭',
  佬: '佬',
  侠: '俠',
  侧: '側',
  侨: '僑',
  侬: '儂',
  俣: '俁',
  俦: '儔',
  俨: '儼',
  俩: '倆',
  俭: '儉',
  债: '債',
  倾: '傾',
  偬: '傯',
  偻: '僂',
  伥: '倀',
  偾: '僨',
  偿: '償',
  杂: '雜',
  鸡: '雞',
  阳: '陽',
  阴: '陰',
  阵: '陣',
  阶: '階',
  尔: '爾',
  邬: '鄔',
  邙: '鄣',
  图: '圖',
  卢: '盧',
  贝: '貝',
  达: '達',
  逻: '邏',
  辑: '輯'
};

/**
 * 檢測文字的中文類型
 * @param text 要檢查的文字
 * @returns 中文類型: 'simplified'(簡體中文), 'traditional'(繁體中文), 'mixed'(混合), 'none'(非中文)
 */
export function detectChineseType(
  text: string
): 'simplified' | 'traditional' | 'mixed' | 'none' {
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
        for (const traditional of Object.values(simplifiedToTraditional)) {
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
 * 過濾掉簡體中文關鍵字
 * @param keywords 關鍵字數組
 * @returns 過濾後的關鍵字數組
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
  TW: 2158, // Taiwan
  HK: 2344, // Hong Kong
  US: 2840, // United States
  JP: 2392, // Japan
  UK: 2826, // United Kingdom
  CN: 2156, // China
  AU: 2036, // Australia
  CA: 2124, // Canada
  SG: 2702, // Singapore
  MY: 2458, // Malaysia
  DE: 2276, // Germany
  FR: 2250, // France
  KR: 2410, // South Korea
  IN: 2356 // India
};

/**
 * Language Code Mapping for Google Ads API
 */
const LANGUAGE_CODES: Record<string, number> = {
  zh_TW: 1018, // Traditional Chinese
  zh_CN: 1000, // Simplified Chinese
  en: 1000, // English
  ja: 1005, // Japanese
  ko: 1012, // Korean
  ms: 1102, // Malay
  fr: 1002, // French
  de: 1001, // German
  es: 1003 // Spanish
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
      throw new Error(
        `Failed to get access token: ${response.status} ${response.statusText}`
      );
    }
    const tokenData = await response.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error getting access token:', error);
    throw error;
  }
}

// Define a basic interface for the Google Ads API response (replace any)
// TODO: Define a more detailed interface based on actual API response structure
interface GoogleAdsKeywordIdea {
  text?: string;
  keywordIdeaMetrics?: {
    avgMonthlySearches?: string | number | null; // Can be string or number
    competition?: number; // Enum value
    competitionIndex?: number;
    lowTopOfPageBidMicros?: string | number | null; // Can be string or number
  };
}

interface GoogleAdsKeywordIdeaResponse {
  results?: GoogleAdsKeywordIdea[];
  // Add other potential top-level fields if known
}

/**
 * Fetches keyword ideas from Google Ads API.
 */
// Use the defined interface instead of any
export async function fetchKeywordIdeas(
  keywords: string[],
  locationId: number,
  languageId: number
): Promise<GoogleAdsKeywordIdeaResponse> {
  try {
    const accessToken = await getAccessToken();
    const apiUrl = `https://googleads.googleapis.com/${API_VERSION}/customers/${CUSTOMER_ID}:generateKeywordIdeas`;
    const requestBody = {
      language: `languageConstants/${languageId}`,
      geoTargetConstants: [`geoTargetConstants/${locationId}`],
      includeAdultKeywords: false,
      keywordPlanNetwork: 'GOOGLE_SEARCH',
      keywordSeed: {
        keywords: keywords
      }
    };
    console.log(`Sending request to Google Ads API: ${apiUrl}`);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
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
      throw new Error(
        `API request failed (${apiUrl}): ${response.status} ${response.statusText}\nDetailed error: ${detailedError}`
      );
    }
    const data = await response.json();
    console.log(
      `Successfully received response, keywords count: ${
        data.results ? data.results.length : 0
      }`
    );
    // Cast the response to the defined interface
    return data as GoogleAdsKeywordIdeaResponse;
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
    0: '未知',
    1: '低',
    2: '中',
    3: '高',
    4: '超高'
  };
  return competitionLevels[competitionEnum] || String(competitionEnum);
}

// Regex to check if the string consists *only* of CJK characters (and potentially spaces, handled later)
const onlyCjkRegex = /^[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]+$/;

// Add location name to code mapping
const LOCATION_NAME_TO_CODE: Record<string, string> = {
  台灣: 'TW',
  臺灣: 'TW',
  香港: 'HK',
  中國: 'CN',
  美國: 'US',
  日本: 'JP',
  英國: 'UK',
  澳洲: 'AU',
  加拿大: 'CA',
  新加坡: 'SG',
  馬來西亞: 'MY',
  德國: 'DE',
  法國: 'FR',
  韓國: 'KR',
  印度: 'IN'
};

/**
 * Gets keyword search volume data.
 */
export async function getSearchVolume(
  keywords: string[], // Input keywords from keyword-research action
  region: string,
  url: string | undefined,
  language: string
): Promise<KeywordVolumeResult> {
  const startTime = Date.now();
  const estimatedTime = estimateProcessingTime(keywords, true);
  const sourceInfo = 'Google Ads API';
  const isUrl = url !== undefined;

  // --- Add Log: Show received keywords ---
  console.log(
    `[getSearchVolume] Received ${keywords.length} keywords to process:`,
    keywords
  );
  // --- End Log ---

  // Map language
  const apiLanguageCode = language.replace('-', '_');
  const languageId = LANGUAGE_CODES[apiLanguageCode];
  if (!languageId) throw new Error(`Invalid language code: ${language}`);

  // Map region
  let regionCode = region.toUpperCase();
  if (LOCATION_NAME_TO_CODE[region]) regionCode = LOCATION_NAME_TO_CODE[region];
  const locationId = LOCATION_CODES[regionCode];
  if (!locationId) throw new Error(`Invalid region code: ${region}.`);

  console.log(
    `[getSearchVolume] Fetching volume: Region=${region}(${locationId}), Language=${language}(${languageId})`
  );
  if (isUrl)
    console.log(`[getSearchVolume] URL provided (informational): ${url}`);

  // Check credentials
  if (
    !DEVELOPER_TOKEN ||
    !CLIENT_ID ||
    !CLIENT_SECRET ||
    !REFRESH_TOKEN ||
    !CUSTOMER_ID
  ) {
    throw new Error('Missing Google Ads API credentials.');
  }

  const allResults: KeywordVolumeItem[] = [];
  const processedKeywords = new Map<string, boolean>();

  try {
    const batchSize = 20;
    const originalKeywordsCount = keywords.length; // Store original count

    // Use the original input keywords for deduplication and variation generation
    const uniqueBaseKeywords = [...new Set(keywords)];

    // --- Internal Space Variation Generation ---
    // This happens INSIDE getSearchVolume, based on the uniqueBaseKeywords derived from input
    const spacedVariations: string[] = [];
    for (const keyword of uniqueBaseKeywords) {
      if (
        onlyCjkRegex.test(keyword) &&
        keyword.length > 1 &&
        keyword.length <= 10 &&
        !keyword.includes(' ')
      ) {
        const spacedKeyword = keyword.split('').join(' ');
        spacedVariations.push(spacedKeyword);
      }
    }
    // --- End Internal Variation Generation ---

    // Combine original unique keywords AND internally generated spaced variations for API query
    const keywordsToQuery = [
      ...new Set([...spacedVariations, ...uniqueBaseKeywords])
    ];

    // --- Add Log: Show keywords actually being sent to API ---
    console.log(
      `[getSearchVolume] Total keywords/variations prepared for API query: ${keywordsToQuery.length}`
    );
    console.log('[getSearchVolume] List sent to API batches:', keywordsToQuery);
    // --- End Log ---

    // --- API Call Loop (Retry logic remains the same) ---
    for (let i = 0; i < keywordsToQuery.length; i += batchSize) {
      await new Promise(resolve => setTimeout(resolve, 250)); // Delay
      const batchKeywords = keywordsToQuery.slice(i, i + batchSize);
      console.log(
        `[getSearchVolume] Processing batch ${
          Math.floor(i / batchSize) + 1
        }/${Math.ceil(keywordsToQuery.length / batchSize)}, ${
          batchKeywords.length
        } keywords.`
      );

      const MAX_RETRIES = 3;
      let retries = 0;
      let response: any;
      let success = false;

      while (retries < MAX_RETRIES && !success) {
        try {
          response = await fetchKeywordIdeas(
            batchKeywords,
            locationId,
            languageId
          );
          success = true;
          // console.log(`[getSearchVolume] Batch ${Math.floor(i / batchSize) + 1}: API call successful.`); // Less verbose
        } catch (error: unknown) {
          retries++;
          console.error(
            `[getSearchVolume] Batch ${
              Math.floor(i / batchSize) + 1
            } attempt ${retries} failed:`,
            error
          );
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (errorMessage.includes('429') && retries < MAX_RETRIES) {
            let retryDelayMs = 5000;
            const retryMatch = errorMessage.match(/Retry in (\d+) seconds?/i);
            if (retryMatch && retryMatch[1])
              retryDelayMs = parseInt(retryMatch[1], 10) * 1000 + 500;
            console.log(
              `[getSearchVolume] Retrying batch ${
                Math.floor(i / batchSize) + 1
              } after ${retryDelayMs}ms...`
            );
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          }
          console.error(
            `[getSearchVolume] Non-retryable error or max retries reached for batch ${
              Math.floor(i / batchSize) + 1
            }.`
          );
          throw error; // Propagate error for the batch
        }
      } // End retry while loop

      if (!success) {
        console.error(
          `[getSearchVolume] Batch ${
            Math.floor(i / batchSize) + 1
          } failed after ${MAX_RETRIES} attempts. Skipping batch results.`
        );
        continue; // Skip processing results for this failed batch
      }

      // Process Batch Results (logic remains the same)
      const keywordIdeas = response.results || [];
      for (const idea of keywordIdeas) {
        try {
          const text = idea.text || '';
          if (!text || processedKeywords.has(text)) continue;

          // Filter simplified Chinese results *if* the requested language is not zh_CN
          if (apiLanguageCode !== 'zh_CN') {
            const type = detectChineseType(text);
            if (type === 'simplified') {
              console.log(`[getSearchVolume] Filtering simplified Chinese keyword from API result: "${text}"`);
              continue; // Skip this simplified keyword idea
            }
          }

          const metrics = idea.keywordIdeaMetrics || {};
          let searchVolumeValue: number | undefined = undefined;
          if (metrics.avgMonthlySearches != null) {
            const parsed = parseInt(String(metrics.avgMonthlySearches), 10);
            if (!isNaN(parsed)) searchVolumeValue = parsed;
          }
          let cpcValue: number | null = null;
          if (metrics.lowTopOfPageBidMicros != null) {
            const parsedCpc = Number(metrics.lowTopOfPageBidMicros);
            if (!isNaN(parsedCpc))
              cpcValue = Number((parsedCpc / 1000000).toFixed(2));
          }
          let competitionIndexValue: number | undefined = undefined;
          if (metrics.competitionIndex != null) {
            const parsedCompIndex = Number(metrics.competitionIndex);
            if (!isNaN(parsedCompIndex))
              competitionIndexValue = Number(parsedCompIndex.toFixed(2));
          }
          const result: KeywordVolumeItem = {
            text: text,
            searchVolume: searchVolumeValue,
            competition: getCompetitionLevel(metrics.competition || 0),
            competitionIndex: competitionIndexValue,
            cpc: cpcValue
          };
          allResults.push(result);
          processedKeywords.set(text, true);
        } catch (itemError) {
          console.error(
            `[getSearchVolume] Error processing keyword idea "${
              idea.text || 'N/A'
            }":`,
            itemError
          );
        }
      } // End processing items in batch
    } // End batch loop

    const endTime = Date.now();
    const actualTime: number = Math.round((endTime - startTime) / 1000);

    console.log(
      `[getSearchVolume] Successfully processed. Found volume data for ${allResults.length} unique keywords/variations returned by API.`
    );
    // console.log("[getSearchVolume] Final results:", allResults); // Optional: uncomment for detailed debug

    return {
      results: allResults, // Return only the results from API
      processingTime: { estimated: estimatedTime, actual: actualTime },
      sourceInfo: sourceInfo,
      researchId: null
    };
  } catch (error: unknown) {
    console.error('[getSearchVolume] Error fetching search volume:', error);
    const endTime = Date.now();
    const actualTime: number = Math.round((endTime - startTime) / 1000);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected error occurred.';
    return {
      // Return error structure
      results: [],
      processingTime: { estimated: estimatedTime, actual: actualTime },
      error: errorMessage,
      sourceInfo: 'Error',
      researchId: null
    };
  }
}
