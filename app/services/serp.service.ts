import { z } from 'zod';
// Import the detailed schemas from db-serp if possible, or redefine necessary parts here
// Assuming schemas like organicResultSchema, searchQuerySchema, etc. are available or defined
// For simplicity here, we might redefine or import them.
// Let's assume FirebaseSerpAnalysisDoc is importable or we define a similar structure.

// --- Re-defining necessary Zod schemas based on db-serp.ts structure ---
// (Ideally, export these from db-serp.ts and import here)

const searchQuerySchema = z
  .object({
    term: z.string().optional().nullable(),
    url: z.string().url().optional().nullable(),
    device: z.string().optional().nullable(),
    page: z.number().int().optional().nullable(),
    type: z.string().optional().nullable(),
    domain: z.string().optional().nullable(),
    countryCode: z.string().optional().nullable(),
    languageCode: z.string().optional().nullable(),
    locationUule: z.string().optional().nullable(),
    resultsPerPage: z.string().optional().nullable()
  })
  .optional()
  .nullable();

const relatedQuerySchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable()
});

const aiOverviewSourceSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable()
});

const aiOverviewSchema = z
  .object({
    type: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    sources: z.array(aiOverviewSourceSchema).optional().nullable()
  })
  .optional()
  .nullable();

const paidResultSchema = z.record(z.any()).optional().nullable();
const paidProductSchema = z.record(z.any()).optional().nullable();
const peopleAlsoAskSchema = z.record(z.any()).optional().nullable();

const siteLinkSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable()
});

const productInfoSchema = z.record(z.any()).optional().nullable();

const organicResultSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url(),
  description: z.string().optional().nullable(),
  displayedUrl: z.string().optional().nullable(),
  emphasizedKeywords: z.array(z.string()).optional().nullable(),
  siteLinks: z.array(siteLinkSchema).optional().nullable(),
  productInfo: productInfoSchema,
  type: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  views: z.string().optional().nullable(),
  lastUpdated: z.string().optional().nullable(),
  commentsAmount: z.string().optional().nullable(),
  followersAmount: z.string().optional().nullable(),
  likes: z.string().optional().nullable(),
  channelName: z.string().optional().nullable()
});

// --- Updated Zod schema for the full Apify API response structure ---
// Apify returns an array, usually with one item for a single query run
const fullApiResponseItemSchema = z.object({
  searchQuery: searchQuerySchema,
  resultsTotal: z.number().int().optional().nullable(),
  relatedQueries: z.array(relatedQuerySchema).optional().nullable(),
  aiOverview: aiOverviewSchema,
  paidResults: z.array(paidResultSchema).optional().nullable(),
  paidProducts: z.array(paidProductSchema).optional().nullable(),
  peopleAlsoAsk: z.array(peopleAlsoAskSchema).optional().nullable(),
  organicResults: z.array(organicResultSchema).optional().nullable()
  // Include other potential top-level fields if known
});

const apiResponseSchema = z.array(fullApiResponseItemSchema).min(1);

// Define the return type based on the expected structure (similar to FirebaseSerpAnalysisDoc but without timestamp etc.)
// Using Partial because not all fields are guaranteed in every response.
type FullSerpApiResponse = Partial<z.infer<typeof fullApiResponseItemSchema>>;

// --- Apify payload schema (no change needed) ---
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

// Define input type for fetchSerpByKeyword
interface FetchSerpByKeywordParams {
  query: string | string[];
  region?: string | null;
  language?: string | null;
}

/**
 * Fetches the full SERP data structure from Google via Apify API
 * @param params Object containing query, region, and language
 * @returns An object containing the full SERP data structure or throws an error
 */
export async function fetchSerpByKeyword(
  params: FetchSerpByKeywordParams // Use object input
): Promise<FullSerpApiResponse> {
  const { query, region, language } = params; // Destructure params

  const apiUrl =
    'https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=apify_api_n4QsZ7oEbTf359GZDTdb05i1U449og3Qzre3';

  // Use provided region/language or defaults
  const countryCode = (region || 'tw').toLowerCase(); // Keep region lowercase as Apify likely expects this
  const searchLanguage = language || 'zh-TW'; // REMOVE .toLowerCase() - Use original case

  console.log(
    `[fetchSerpByKeyword] Calling Apify with: query=${JSON.stringify(
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
      '[fetchSerpByKeyword] No valid queries provided after processing input.'
    );
    throw new Error('未提供有效的搜索查詢。');
  }

  const payload = {
    countryCode: countryCode,
    forceExactMatch: false,
    includeIcons: false,
    includeUnfilteredResults: false,
    maxPagesPerQuery: 1,
    mobileResults: false,
    queries: queriesString,
    resultsPerPage: 100,
    saveHtml: false,
    saveHtmlToKeyValueStore: true,
    searchLanguage: searchLanguage // Use the potentially mixed-case language code
  };

  // --- Validate the payload before sending ---
  const validatedPayload = apifyPayloadSchema.safeParse(payload);
  if (!validatedPayload.success) {
    console.error(
      '[fetchSerpByKeyword] Payload validation failed:',
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
        '[fetchSerpByKeyword] API request failed. Status:',
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
        '[fetchSerpByKeyword] API response validation failed:',
        validationResult.error.flatten(),
        'Raw Data:',
        rawData // Log raw data on validation failure
      );
      const errorMessages = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(`無法驗證 API 回應格式: ${errorMessages}`);
    }

    const validatedData = validationResult.data[0];
    return validatedData;
  } catch (error) {
    console.error(`[fetchSerpByKeyword] Error fetching keyword data:`, error);
    throw new Error(
      `獲取關鍵字數據時發生錯誤: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
