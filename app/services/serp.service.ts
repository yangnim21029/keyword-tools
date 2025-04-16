import { z } from 'zod';

// Zod schemas for API response validation
const searchResultSchema = z.object({
  title: z.string().min(1, '標題不能為空'),
  url: z.string().url('URL 格式無效')
});

const organicResultsSchema = z.object({
  organicResults: z.array(searchResultSchema).optional() // Mark as optional to handle cases where it might be missing initially
});

// The API returns an array containing one object with organicResults
const apiResponseSchema = z
  .array(organicResultsSchema)
  .min(1, 'API 回應陣列不能為空');

// Type alias inferred from the schema
type ApiResponse = z.infer<typeof apiResponseSchema>;

// Type alias for a single search result, inferred from the schema
export type SearchResult = z.infer<typeof searchResultSchema>;

// --- NEW: Zod schema for the Apify payload ---
const apifyPayloadSchema = z.object({
  countryCode: z
    .string()
    .min(2)
    .max(2)
    .toLowerCase()
    .describe('Apify country code (e.g., hk, tw)'),
  forceExactMatch: z.boolean().optional().default(false),
  includeIcons: z.boolean().optional().default(false),
  includeUnfilteredResults: z.boolean().optional().default(false),
  maxPagesPerQuery: z.number().int().positive().optional().default(1),
  mobileResults: z.boolean().optional().default(false),
  queries: z
    .string()
    .min(1)
    .describe('Search queries as a single string (can contain newlines)'),
  resultsPerPage: z.number().int().positive().max(100).optional().default(100),
  saveHtml: z.boolean().optional().default(false),
  saveHtmlToKeyValueStore: z.boolean().optional().default(true),
  searchLanguage: z
    .string()
    .optional()
    .describe('Apify search language (e.g., zh-TW)')
});
// --- End Apify payload schema ---

/**
 * Fetches keyword search results from Google via Apify API
 * @param query The search query string or array of queries
 * @param region Optional Apify country code (e.g., 'tw', 'us')
 * @param language Optional Apify search language code (e.g., 'zh-TW', 'en')
 * @returns An array of validated search results or throws an error
 */
export async function fetchKeywordData(
  query: string | string[],
  region?: string | null, // Add optional region
  language?: string | null // Add optional language
): Promise<SearchResult[]> {
  const apiUrl =
    'https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=apify_api_n4QsZ7oEbTf359GZDTdb05i1U449og3Qzre3';

  // Use provided region/language or defaults
  const countryCode = (region || 'tw').toLowerCase(); // Ensure lowercase
  const searchLanguage = language || 'zh-TW';

  console.log(
    `[fetchKeywordData] Calling Apify with: query=${JSON.stringify(
      query
    )}, region=${countryCode}, language=${searchLanguage}`
  );

  // Prepare the queries as a single string
  let queriesString: string;
  if (typeof query === 'string') {
    queriesString = query.trim();
  } else {
    // Join array elements with newline, trim each, filter empty, then join
    queriesString = query
      .map(q => q.trim())
      .filter(q => q.length > 0)
      .join('\n');
  }

  // Check if queries string is empty after processing
  if (queriesString.length === 0) {
    console.error(
      '[fetchKeywordData] No valid queries provided after processing input.'
    );
    throw new Error('未提供有效的搜索查詢。');
  }

  const payload = {
    countryCode: countryCode, // Already lowercase
    forceExactMatch: false,
    includeIcons: false,
    includeUnfilteredResults: false,
    maxPagesPerQuery: 1,
    mobileResults: false,
    queries: queriesString, // Use the processed single string
    resultsPerPage: 100,
    saveHtml: false,
    saveHtmlToKeyValueStore: true,
    searchLanguage: searchLanguage
  };

  // --- Validate the payload before sending ---
  const validatedPayload = apifyPayloadSchema.safeParse(payload);
  if (!validatedPayload.success) {
    console.error(
      '[fetchKeywordData] Payload validation failed:',
      validatedPayload.error.flatten(),
      'Original Payload:',
      payload
    );
    const errorMessages = validatedPayload.error.errors
      .map(e => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    throw new Error(`內部 Payload 格式無效: ${errorMessages}`);
  }
  // --- End payload validation ---

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(validatedPayload.data) // Send the validated payload data
    });

    if (!response.ok) {
      // Log the payload on error for debugging
      console.error(
        '[fetchKeywordData] API request failed. Status:',
        response.status,
        'Payload:',
        payload
      );
      throw new Error(`API responded with status: ${response.status}`);
    }

    const rawData = await response.json();
    const validationResult = apiResponseSchema.safeParse(rawData);

    if (!validationResult.success) {
      console.error(
        '[fetchKeywordData] API response validation failed:',
        validationResult.error.flatten(),
        'Raw Data:',
        rawData // Log raw data on validation failure
      );
      const errorMessages = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`無法驗證 API 回應格式: ${errorMessages}`);
    }

    const validatedData = validationResult.data;
    const organicResults = validatedData[0]?.organicResults;
    return organicResults || [];
  } catch (error) {
    console.error(`[fetchKeywordData] Error fetching keyword data:`, error);
    throw new Error(
      `獲取關鍵字數據時發生錯誤: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
