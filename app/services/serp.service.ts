import { z } from "zod";
// Import the main schema from schema.ts
import { FirebaseSerpResultObjectSchema } from "./firebase/schema";

// --- Zod schema for the API response structure ---
// Apify returns an array, usually with one item for a single query run
const apiResponseSchema = z.array(FirebaseSerpResultObjectSchema).min(1);

// --- Define the return type for the fetch function ---
// Use Partial because not all fields are guaranteed in every API response,
// although FirebaseSerpResultObjectSchema now reflects API optionality better.
// Using Partial adds an extra layer of safety.
type FullSerpApiResponse = Partial<
  z.infer<typeof FirebaseSerpResultObjectSchema>
>;

// --- Apify payload schema (Remains the same) ---
const apifyPayloadSchema = z.object({
  countryCode: z
    .string()
    .min(2)
    .max(2)
    .toLowerCase()
    .describe("Apify country code (e.g., hk, tw)"),
  forceExactMatch: z.boolean().optional().default(false),
  includeIcons: z.boolean().optional().default(false),
  includeUnfilteredResults: z.boolean().optional().default(false),
  maxPagesPerQuery: z.number().int().positive().optional().default(1),
  mobileResults: z.boolean().optional().default(false),
  queries: z
    .string()
    .min(1)
    .describe("Search queries as a single string (can contain newlines)"),
  resultsPerPage: z.number().int().positive().max(100).optional().default(100),
  saveHtml: z.boolean().optional().default(false),
  saveHtmlToKeyValueStore: z.boolean().optional().default(true),
  searchLanguage: z
    .string()
    .optional()
    .describe("Apify search language (e.g., zh-TW)"),
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
  params: FetchSerpByKeywordParams, // Use object input
): Promise<FullSerpApiResponse> {
  const { query, region, language } = params; // Destructure params

  const apiUrl =
    "https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=apify_api_n4QsZ7oEbTf359GZDTdb05i1U449og3Qzre3";

  // Use provided region/language or defaults
  const countryCode = (region || "tw").toLowerCase(); // Keep region lowercase as Apify likely expects this
  const searchLanguage = language || "zh-TW"; // REMOVE .toLowerCase() - Use original case

  console.log(
    `[fetchSerpByKeyword] Calling Apify with: query=${JSON.stringify(
      query,
    )}, region=${countryCode}, language=${searchLanguage}`,
  );

  // Prepare the queries as a single string
  let queriesString: string;
  if (typeof query === "string") {
    queriesString = query.trim();
  } else {
    // Join array elements with newline, trim each, filter empty, then join
    queriesString = query
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .join("\n");
  }

  // Check if queries string is empty after processing
  if (queriesString.length === 0) {
    console.error(
      "[fetchSerpByKeyword] No valid queries provided after processing input.",
    );
    throw new Error("未提供有效的搜索查詢。");
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
    searchLanguage: searchLanguage, // Use the potentially mixed-case language code
  };

  // --- Validate the payload before sending ---
  const validatedPayload = apifyPayloadSchema.safeParse(payload);
  if (!validatedPayload.success) {
    console.error(
      "[fetchSerpByKeyword] Payload validation failed:",
      validatedPayload.error.flatten(),
      "Original Payload:",
      payload,
    );
    const errorMessages = validatedPayload.error.errors
      .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
      .join(", ");
    throw new Error(`內部 Payload 格式無效: ${errorMessages}`);
  }
  // --- End payload validation ---

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(validatedPayload.data), // Send the validated payload data
    });

    if (!response.ok) {
      // Log the payload on error for debugging
      console.error(
        "[fetchSerpByKeyword] API request failed. Status:",
        response.status,
        "Payload:",
        payload,
      );
      throw new Error(`API responded with status: ${response.status}`);
    }

    const rawData = await response.json();
    // --- Validate the raw API response using the imported schema ---
    const validationResult = apiResponseSchema.safeParse(rawData);

    if (!validationResult.success) {
      console.error(
        "[fetchSerpByKeyword] API response validation failed:",
        validationResult.error.flatten(),
        "Raw Data:",
        rawData, // Log raw data on validation failure
      );
      const errorMessages = validationResult.error.errors
        .map((e: z.ZodIssue) => `${e.path.join(".")}: ${e.message}`)
        .join(", ");
      throw new Error(`無法驗證 API 回應格式: ${errorMessages}`);
    }

    // Return the first item from the validated array
    const validatedData = validationResult.data[0];
    return validatedData;
  } catch (error) {
    console.error(`[fetchSerpByKeyword] Error fetching keyword data:`, error);
    throw new Error(
      `獲取關鍵字數據時發生錯誤: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
