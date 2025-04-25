// --- Google Ads API Functions and constants ---

import { KeywordVolumeItem, KeywordVolumeResult } from '@/app/services/firebase/types';
import { hasSimplifiedChinese } from '@/lib/utils'; // Import the new function

// Add API_VERSION constant directly in this file
/**
 * Google Ads API version
 */
const API_VERSION = 'v19';

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

// --- Private Helper Functions ---

/**
 * Gets OAuth2 access token.
 * (Made private - only used internally)
 */
async function getAccessToken(): Promise<string> {
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

interface FetchRetryParams {
  batchKeywords: string[];
  locationId: number;
  languageId: number;
  maxRetries?: number; // Make optional with default below
}

// Helper function to fetch keyword ideas with retry logic
async function fetchKeywordIdeasWithRetry(
  { batchKeywords, locationId, languageId, maxRetries = 3 }: FetchRetryParams
): Promise<GoogleAdsKeywordIdeaResponse> {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetchKeywordIdeas(
        batchKeywords,
        locationId,
        languageId
      );
      return response;
    } catch (error: unknown) {
      retries++;
      console.error(
        `[fetchKeywordIdeasWithRetry] Attempt ${retries} failed:`, error
      );
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('429') && retries < maxRetries) {
        let retryDelayMs = 5000; // Default delay
        const retryMatch = errorMessage.match(/Retry in (\d+) seconds?/i);
        if (retryMatch && retryMatch[1]) {
          retryDelayMs = parseInt(retryMatch[1], 10) * 1000 + 500; // Add buffer
        }
        console.log(
          `[fetchKeywordIdeasWithRetry] Retrying after ${retryDelayMs}ms...`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        continue;
      }

      console.error(
        `[fetchKeywordIdeasWithRetry] Non-retryable error or max retries reached.`
      );
      throw error;
    }
  }
  throw new Error(`[fetchKeywordIdeasWithRetry] Failed after ${maxRetries} attempts.`);
}

/**
 * Fetches keyword ideas from Google Ads API (Original function, now called by retry helper)
 * (Made private - only used internally)
 */
async function fetchKeywordIdeas(
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
 * (Made private - only used internally)
 */
function getCompetitionLevel(competitionEnum: number): string {
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

// Helper function to generate spaced variations for CJK keywords
// (Made private - only used internally)
function generateSpacedVariations(uniqueBaseKeywords: string[]): string[] {
  const spacedVariations: string[] = [];
  for (const keyword of uniqueBaseKeywords) {
    // Use the existing onlyCjkRegex defined in the module scope
    if (
      onlyCjkRegex.test(keyword) &&
      keyword.length > 1 &&
      keyword.length <= 10 &&
      !keyword.includes(' ')
    ) {
      spacedVariations.push(keyword.split('').join(' '));
    }
  }
  return spacedVariations;
}

// --- Exported Main Function ---

interface GetSearchVolumeParams {
  keywords: string[];
  region: string;
  language: string;
}

/**
 * Gets keyword search volume data.
 */
export async function getSearchVolume(
  { keywords, region, language }: GetSearchVolumeParams
): Promise<KeywordVolumeResult> {
  const sourceInfo = 'Google Ads API';

  console.log(`[getSearchVolume] Received ${keywords.length} keywords for region: ${region}, language: ${language}...`);

  // --- Parameter Validation and Setup ---
  const apiLanguageCode = language.replace('-', '_');
  const languageId = LANGUAGE_CODES[apiLanguageCode];
  if (!languageId) throw new Error(`Invalid language code: ${language}`);

  const regionCode = region.toUpperCase();
  const locationId = LOCATION_CODES[regionCode];
  if (!locationId) throw new Error(`Invalid region code: ${region}.`);

  if (!DEVELOPER_TOKEN || !CLIENT_ID /* ... other checks */) {
    throw new Error('Missing Google Ads API credentials.');
  }

  console.log(
    `[getSearchVolume] Config: Region=${region}(${locationId}), Language=${language}(${languageId})`
  );
  // --- End Setup ---

  const allResults: KeywordVolumeItem[] = [];
  const processedKeywords = new Map<string, boolean>();

  try {
    const batchSize = 20;
    const uniqueBaseKeywords = [...new Set(keywords)];

    const spacedVariations = generateSpacedVariations(uniqueBaseKeywords);

    const keywordsToQuery = [
      ...new Set([...spacedVariations, ...uniqueBaseKeywords])
    ];

    // --- API Batch Processing Loop ---
    for (let i = 0; i < keywordsToQuery.length; i += batchSize) {
      await new Promise(resolve => setTimeout(resolve, 250)); // API delay
      const batchKeywords = keywordsToQuery.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      try {
        const response = await fetchKeywordIdeasWithRetry({
          batchKeywords,
          locationId,
          languageId,
        });
        
        const batchResults = processKeywordIdeaBatch(
          response.results || [],
          apiLanguageCode,
          processedKeywords
        );
        
        allResults.push(...batchResults);
        console.log(`[getSearchVolume] Batch ${batchNum}: Processed ${batchResults.length} new items.`); 

      } catch (batchError) {
        console.error(
          `[getSearchVolume] Skipping batch ${batchNum} due to error: ${batchError}`
        );
      }
    } // --- End Batch Loop ---

    return {
      results: allResults,
      sourceInfo: sourceInfo,
      researchId: null
    };

  } catch (error: unknown) {
    console.error('[getSearchVolume] Critical setup error:', error);
    const errorMessage =
      error instanceof Error ? error.message : 'An unexpected setup error occurred.';
    return {
      results: [],
      error: errorMessage,
      sourceInfo: 'Error',
      researchId: null
    };
  }
}

// Helper function to process a batch of keyword ideas from the API response
// (Made private - only used internally)
function processKeywordIdeaBatch(
  keywordIdeas: GoogleAdsKeywordIdea[],
  apiLanguageCode: string,
  processedKeywords: Map<string, boolean>
): KeywordVolumeItem[] {
  const batchResults: KeywordVolumeItem[] = [];
  for (const idea of keywordIdeas) {
    try {
      const text = idea.text || '';
      // Skip if text is empty or already processed in a previous batch (unlikely but safe)
      if (!text || processedKeywords.has(text)) continue;

      // Filter simplified Chinese results *if* the requested language is not zh_CN
      if (apiLanguageCode !== 'zh_CN') {
        if (hasSimplifiedChinese(text)) {
          console.log(
            `[processKeywordIdeaBatch] Filtering simplified Chinese keyword: "${text}"`
          );
          continue; // Skip this simplified keyword idea
        }
      }

      // Parse metrics
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
      
      // Create result item
      const result: KeywordVolumeItem = {
        text: text,
        searchVolume: searchVolumeValue,
        competition: getCompetitionLevel(metrics.competition || 0),
        competitionIndex: competitionIndexValue,
        cpc: cpcValue
      };
      batchResults.push(result);
      processedKeywords.set(text, true); // Mark as processed in the shared map

    } catch (itemError) {
      console.error(
        `[processKeywordIdeaBatch] Error processing keyword idea "${
          idea.text || 'N/A'
        }":`,
        itemError
      );
      // Continue processing other items in the batch even if one fails
    }
  } // End processing items in batch
  return batchResults;
}
