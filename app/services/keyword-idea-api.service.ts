// --- Google Ads API Functions and constants ---

import { hasSimplifiedChinese } from '@/lib/utils'; // Import the new function
import { KeywordVolumeItem, KeywordVolumeItemSchema } from './firebase/schema';

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
async function fetchKeywordIdeasWithRetry({
  batchKeywords,
  locationId,
  languageId,
  maxRetries = 3
}: FetchRetryParams): Promise<GoogleAdsKeywordIdeaResponse> {
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
        `[fetchKeywordIdeasWithRetry] Attempt ${retries} failed:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : String(error);

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
  throw new Error(
    `[fetchKeywordIdeasWithRetry] Failed after ${maxRetries} attempts.`
  );
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

// --- Exported Main Function ---

interface GetSearchVolumeParams {
  keywords: string[];
  region: string;
  language: string;
  filterZeroVolume?: boolean;
}

/**
 * Gets keyword search volume data.
 */
export async function getSearchVolume({
  keywords,
  region,
  language,
  filterZeroVolume = false
}: GetSearchVolumeParams): Promise<KeywordVolumeItem[]> {
  console.log(
    `[getSearchVolume] Received ${keywords.length} keywords for region: ${region}, language: ${language}...`
  );

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
    const batchSize = 20; // Number of keywords per API request
    const CONCURRENT_BATCH_LIMIT = 5; // How many API requests to run in parallel
    const uniqueBaseKeywords = [...new Set(keywords)];
    const keywordsToQuery = uniqueBaseKeywords;

    // Create an array of functions, each processing one batch
    const batchTasks: (() => Promise<KeywordVolumeItem[]>)[] = [];
    for (let i = 0; i < keywordsToQuery.length; i += batchSize) {
      const batchKeywords = keywordsToQuery.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      // Define the task for this batch
      batchTasks.push(async () => {
        console.log(
          `[getSearchVolume] Starting batch ${batchNum} (${batchKeywords.length} keywords)`
        );
        const batchResults: KeywordVolumeItem[] = [];
        try {
          // Add a small delay *before* each concurrent batch starts, helps manage burst
          await new Promise(resolve => setTimeout(resolve, 100));

          const response = await fetchKeywordIdeasWithRetry({
            batchKeywords,
            locationId,
            languageId
          });
          const keywordIdeas = response.results || [];
          console.log(`[getSearchVolume] Raw API response for batch ${batchNum}:`, JSON.stringify(keywordIdeas, null, 2));

          // --- Inlined processing logic ---
          for (const idea of keywordIdeas) {
            const originalText = idea.text || '';
            console.log(`[getSearchVolume] Processing keyword: "${originalText}"`);
            
            if (!originalText) {
              console.log(`[getSearchVolume] Skipping empty keyword`);
              continue;
            }

            // Normalize text for duplicate checking
            const normalizedText = originalText.toLowerCase().trim();
            console.log(`[getSearchVolume] Normalized keyword: "${normalizedText}"`);

            // Check against map using normalized text
            if (processedKeywords.has(normalizedText)) {
              console.log(`[getSearchVolume] Skipping duplicate keyword: "${normalizedText}"`);
              continue;
            }

            if (apiLanguageCode !== 'zh_CN') {
              if (hasSimplifiedChinese(originalText)) {
                console.log(`[getSearchVolume] Skipping simplified Chinese keyword: "${originalText}"`);
                continue;
              }
            }

            const metrics = idea.keywordIdeaMetrics || {};
            const searchVolumeRaw = metrics.avgMonthlySearches;
            const cpcRaw = metrics.lowTopOfPageBidMicros;
            const competitionRaw = metrics.competition;
            const competitionIndexRaw = metrics.competitionIndex;

            let searchVolumeNum: number | undefined | null = null;
            if (searchVolumeRaw != null) {
              const parsed = parseInt(String(searchVolumeRaw), 10);
              if (!isNaN(parsed)) searchVolumeNum = parsed;
            }

            let cpcNum: number | undefined | null = null;
            if (cpcRaw != null) {
              const parsedCpc = Number(cpcRaw);
              if (!isNaN(parsedCpc))
                cpcNum = Number((parsedCpc / 1000000).toFixed(2));
            }

            let competitionIndexNum: number | undefined | null = null;
            if (typeof competitionIndexRaw === 'string') {
              const parsed = parseInt(competitionIndexRaw, 10);
              if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
                competitionIndexNum = parsed;
              }
            } else if (typeof competitionIndexRaw === 'number') {
              if (competitionIndexRaw >= 0 && competitionIndexRaw <= 100) {
                competitionIndexNum = competitionIndexRaw;
              }
            }

            let competitionString: string | undefined | null = null;
            if (typeof competitionRaw === 'number') {
              switch (competitionRaw) {
                case 2:
                  competitionString = 'LOW';
                  break;
                case 3:
                  competitionString = 'MEDIUM';
                  break;
                case 4:
                  competitionString = 'HIGH';
                  break;
                default:
                  competitionString = 'UNKNOWN';
              }
            }

            const itemToValidate = {
              text: originalText, // Use original text for the result item
              searchVolume: searchVolumeNum,
              competition: competitionString,
              competitionIndex: competitionIndexNum,
              cpc: cpcNum
            };
            const validationResult =
              KeywordVolumeItemSchema.safeParse(itemToValidate);

            if (validationResult.success) {
              // Double-check with normalized text before adding and setting the map entry
              if (!processedKeywords.has(normalizedText)) {
                batchResults.push(validationResult.data);
                processedKeywords.set(normalizedText, true); // Use normalized text as key
              }
            } else {
              console.warn(
                `[getSearchVolume] Zod validation failed for keyword "${originalText}" in batch ${batchNum}:`,
                validationResult.error.flatten()
              );
            }
          }
          console.log(
            `[getSearchVolume] Finished batch ${batchNum}: Processed ${batchResults.length} new items from ${keywordIdeas.length} ideas.`
          );
          return batchResults;
        } catch (batchError) {
          console.error(
            `[getSearchVolume] Error processing batch ${batchNum}:`,
            batchError instanceof Error ? batchError.message : batchError
          );
          // Re-throw to be caught by Promise.allSettled as 'rejected'
          throw batchError;
        }
      });
    } // End loop creating tasks

    // --- Process tasks in concurrent chunks ---
    console.log(
      `[getSearchVolume] Starting processing of ${batchTasks.length} batches with concurrency ${CONCURRENT_BATCH_LIMIT}...`
    );
    for (let i = 0; i < batchTasks.length; i += CONCURRENT_BATCH_LIMIT) {
      const chunk = batchTasks.slice(i, i + CONCURRENT_BATCH_LIMIT);
      console.log(
        `[getSearchVolume] Processing chunk starting at batch ${i + 1}...`
      );

      const results = await Promise.allSettled(chunk.map(task => task()));

      // Aggregate results from the settled promises in the chunk
      results.forEach((result, index) => {
        const originalBatchNum = i + 1 + index;
        if (result.status === 'fulfilled') {
          allResults.push(...result.value);
        } else {
          console.error(
            `[getSearchVolume] Batch ${originalBatchNum} failed permanently:`,
            result.reason instanceof Error
              ? result.reason.message
              : result.reason
          );
        }
      });
      console.log(
        `[getSearchVolume] Finished processing chunk up to batch ${
          i + chunk.length
        }.`
      );
    }
    console.log(
      `[getSearchVolume] Completed all batches. Raw results before final dedupe: ${allResults.length}`
    );
    // --- End Concurrent Processing ---

    // --- Final Deduplication based on normalized text ---
    const finalUniqueResultsMap = new Map<string, KeywordVolumeItem>();
    allResults.forEach(item => {
      const normalized = item.text.toLowerCase().trim();
      // Keep the first occurrence encountered
      // (or you could implement logic to keep the one with highest volume, etc.)
      if (!finalUniqueResultsMap.has(normalized)) {
        finalUniqueResultsMap.set(normalized, item);
      }
    });
    const finalUniqueResults = Array.from(finalUniqueResultsMap.values());
    console.log(
      `[getSearchVolume] Final deduplicated results: ${finalUniqueResults.length}`
    );

    // Final filtering based on filterZeroVolume
    return finalUniqueResults.filter(item => {
      const currentVolume = item.searchVolume ?? 0;
      return filterZeroVolume ? currentVolume > 0 : currentVolume >= 0;
    });
  } catch (error: unknown) {
    console.error('[getSearchVolume] Critical setup error:', error);
    return [];
  }
}
