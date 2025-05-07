import { Timestamp } from "firebase-admin/firestore"; // Import admin Timestamp
import { z } from "zod";
import { GeoPoint } from "firebase-admin/firestore"; // For server-side

// Define a robust Firestore Timestamp schema that outputs a Date object
// THIS SCHEMA IS FOR VALIDATING FIRESTORE DATA, NOT API RESPONSE
const FirestoreTimestampSchema = z
  .custom<
    | Timestamp
    | { seconds: number; nanoseconds: number }
    | { _seconds: number; _nanoseconds: number }
  >(
    (value) => {
      if (value instanceof Timestamp) {
        return true;
      }
      // Handle raw timestamp data (seconds/nanoseconds)
      if (
        typeof value === "object" &&
        value !== null &&
        "seconds" in value &&
        typeof value.seconds === "number" &&
        "nanoseconds" in value &&
        typeof value.nanoseconds === "number"
      ) {
        return true;
      }
      // Handle raw timestamp data (_seconds/_nanoseconds)
      if (
        typeof value === "object" &&
        value !== null &&
        "_seconds" in value &&
        typeof value._seconds === "number" &&
        "_nanoseconds" in value &&
        typeof value._nanoseconds === "number"
      ) {
        return true;
      }
      return false;
    },
    { message: "Invalid Firestore Timestamp format" }
  )
  .transform((value) => {
    // Transform to JS Date object
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    // Convert raw timestamp data to Timestamp instance, then to Date
    const seconds = "_seconds" in value ? value._seconds : value.seconds;
    const nanoseconds =
      "_nanoseconds" in value ? value._nanoseconds : value.nanoseconds;
    return new Timestamp(seconds, nanoseconds).toDate();
  })
  .describe("Firestore Timestamp (validated and transformed to Date)");

/**
 * 關鍵字搜索量項目 Schema
 */
export const KeywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().int().nonnegative().nullish(),
  competition: z.string().optional().nullish(), // Storing the string value (e.g., 'LOW', 'MEDIUM', 'HIGH')
  competitionIndex: z.number().int().min(0).max(100).optional().nullish(), // 0-100
  cpc: z.number().positive().nullish(), // Cost Per Click
});

export const AiClusterItemSchema = z.object({
  clusterName: z.string(),
  mainKeyword: z.string(),
  totalVolume: z.number().int().nonnegative().default(0),
  keywords: z.array(KeywordVolumeItemSchema),
  longTailKeywords: z
    .array(z.string())
    .optional()
    .describe("提取的長尾字詞部分"),
  personaDescription: z.string().optional().describe("AI生成的用戶畫像描述"),
});

// Consolidated schema for the full Keyword Research document in Firestore
export const KeywordVolumeObjectSchema = z.object({
  id: z.string().describe("記錄的唯一標識符"),
  query: z.string().min(1, "主關鍵字不能為空").describe("主關鍵字"),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
  totalVolume: z.number().int().nonnegative().default(0),
  keywords: z
    .array(KeywordVolumeItemSchema)
    .optional()
    .describe("Top-level list of keywords and their volume data"),
  clustersWithVolume: z
    .array(AiClusterItemSchema)
    .optional()
    .describe("Clusters with pre-calculated volumes"),
  searchEngine: z.string().optional().describe("使用的搜尋引擎 (例如 google)"),
  region: z.string().optional().describe("地區代碼 (例如 TW)"),
  language: z.string().optional().describe("語言代碼 (例如 zh-TW)"),
  tags: z.array(z.string()).optional().default([]),
});

// Schema for the data needed specifically for the list view (subset of KeywordVolumeObjectSchema)
export const KeywordVolumeListItemSchema = KeywordVolumeObjectSchema.pick({
  id: true,
  query: true,
  createdAt: true,
  totalVolume: true,
  region: true,
  language: true,
  // Removed: updatedAt, keywords, clustersWithVolume, searchEngine, tags
});

/**
 * 關鍵字建議結果 Schema
 */
export const keywordSuggestionResultSchema = z.object({
  suggestions: z.array(z.string()),
  error: z.string().optional(),
  sourceInfo: z.string().optional(),
});

/**
 * 搜索量結果 Schema
 */
export const keywordVolumeResultSchema = z.object({
  results: z.array(KeywordVolumeItemSchema),
  error: z.string().optional(),
  processingTime: z
    .object({
      estimated: z.number(),
      actual: z.number(),
    })
    .optional(),
  sourceInfo: z.string().optional(),
  researchId: z.string().nullable().optional(),
});

// --- SERP Schemas ---

/**
 * Schema for a single organic result from Apify (example structure)
 */
export const OrganicResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  displayedUrl: z.string().optional(),
  description: z.string().optional(),
  // Add other fields returned by Apify if necessary
});

export const SerpResultSchema = z.object({
  query: z.string(),
  region: z.string().optional(),
  language: z.string().optional(),
  serpResults: z.array(OrganicResultSchema),
  retrievedAt: FirestoreTimestampSchema,
  processedAt: FirestoreTimestampSchema,
});

// Schema for related queries
export const SerpRelatedQuerySchema = z.object({
  query: z.string(),
  url: z.string().url().optional().nullable(),
});

// Schema for People Also Ask
export const SerpPeopleAlsoAskSchema = z.object({
  question: z.string(),
  answer: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  title: z.string().optional().nullable(),
});

// --- Schemas for Analysis JSON Structures (Now part of SerpDataDoc) ---

const PageReferenceSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url(),
});

// Schema for Content Type JSON structure - REMOVING
// export const AiContentTypeAnalysisJsonSchema = ... (Removed)

// Schema for User Intent JSON structure - REMOVING
// export const AiUserIntentAnalysisJsonSchema = ... (Removed)

// Schema for Title Analysis JSON structure - REMOVING
// export const AiTitleAnalysisJsonSchema = z.object({
//   title: z.string().optional().nullable(),
//   analysis: z.string().optional().nullable(),
//   recommendationText: z.string().optional().nullable()
// });

// --- NEW: Schema for Better Have Analysis JSON Structure --- - REMOVING ITEM
// export const AiSerpBetterHaveItemSchema = ... (Removed)

// export const AiSerpBetterHaveJsonSchema = ... (Removed)

// --- Schemas based on API Response (serp.service.ts definitions) ---

const ApiSearchQuerySchema = z
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
    resultsPerPage: z.string().optional().nullable(), // API returns string here
  })
  .optional()
  .nullable();

const ApiRelatedQuerySchema = z.object({
  // API uses 'title', not 'query'
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
});

const ApiAiOverviewSourceSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
});

const ApiAiOverviewSchema = z
  .object({
    type: z.string().optional().nullable(),
    content: z.string().optional().nullable(),
    sources: z.array(ApiAiOverviewSourceSchema).optional().nullable(),
  })
  .optional()
  .nullable();

const ApiPaidResultSchema = z.record(z.any()).optional().nullable();
const ApiPaidProductSchema = z.record(z.any()).optional().nullable();
const ApiPeopleAlsoAskSchema = z.record(z.any()).optional().nullable(); // Keep as any for flexibility

const ApiSiteLinkSchema = z.object({
  title: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
});

const ApiProductInfoSchema = z.record(z.any()).optional().nullable();

const ApiOrganicResultSchema = z.object({
  position: z.number().int().positive().optional().nullable(), // Optional from API sometimes
  title: z.string().optional().nullable(), // Optional from API sometimes
  url: z.string().url().optional().nullable(), // Optional from API sometimes
  description: z.string().optional().nullable(),
  displayedUrl: z.string().optional().nullable(),
  emphasizedKeywords: z.array(z.string()).optional().nullable(),
  siteLinks: z.array(ApiSiteLinkSchema).optional().nullable(),
  productInfo: ApiProductInfoSchema,
  type: z.string().optional().nullable(),
  date: z.string().optional().nullable(), // API returns string date
  views: z.string().optional().nullable(), // API returns string
  lastUpdated: z.string().optional().nullable(), // API returns string
  commentsAmount: z.string().optional().nullable(), // API returns string
  followersAmount: z.string().optional().nullable(), // API returns string
  likes: z.string().optional().nullable(), // API returns string
  channelName: z.string().optional().nullable(),
});

export const FirebaseSerpResultObjectSchema = z.object({
  originalKeyword: z.string().optional(),
  normalizedKeyword: z.string().optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  searchQuery: ApiSearchQuerySchema,
  resultsTotal: z.number().int().optional().nullable(),
  relatedQueries: z.array(ApiRelatedQuerySchema).optional().nullable(),
  aiOverview: ApiAiOverviewSchema,
  paidResults: z.array(ApiPaidResultSchema).optional().nullable(),
  paidProducts: z.array(ApiPaidProductSchema).optional().nullable(),
  peopleAlsoAsk: z.array(ApiPeopleAlsoAskSchema).optional().nullable(),
  organicResults: z.array(ApiOrganicResultSchema).optional().nullable(),
  id: z.string().optional().describe("Firestore document ID (added on read)"),
  createdAt: FirestoreTimestampSchema.optional().nullable(), // Added on write
  updatedAt: FirestoreTimestampSchema.optional().nullable(), // Added on write/update
  urlOutline: z
    .string()
    .nullable()
    .optional()
    .describe("Scraped H2/H3 headings (added later potentially)"),

  contentTypeAnalysisText: z.string().nullable().optional(),
  userIntentAnalysisText: z.string().nullable().optional(),
  // titleAnalysis: AiTitleAnalysisJsonSchema.nullable().optional(), // REMOVING FIEL
  titleAnalysisText: z.string().nullable().optional(), // ADDING FIELD
  betterHaveAnalysisText: z.string().nullable().optional(),
  contentTypeRecommendationText: z.string().nullable().optional(),
  userIntentRecommendationText: z.string().nullable().optional(),
  titleRecommendationText: z.string().nullable().optional(), // ADDING FIELD
  betterHaveRecommendationText: z.string().nullable().optional(),
});

export type KeywordVolumeItem = z.infer<typeof KeywordVolumeItemSchema>;
export type AiClusterItem = z.infer<typeof AiClusterItemSchema>;
// Removed AiContentTypeAnalysisJson type
// Removed AiUserIntentAnalysisJson type
// export type AiTitleAnalysisJson = z.infer<typeof AiTitleAnalysisJsonSchema>;
// Removed AiSerpBetterHaveAnalysisJson type
export type FirebaseSerpResultObject = z.infer<
  typeof FirebaseSerpResultObjectSchema
>;
export type KeywordVolumeObject = z.infer<typeof KeywordVolumeObjectSchema>;
export type KeywordVolumeListItem = z.infer<typeof KeywordVolumeListItemSchema>;

export type KeywordSuggestionResult = z.infer<
  typeof keywordSuggestionResultSchema
>;

// Schema for Advice/Feedback Items
export const AdviceItemSchema = z.object({
  id: z.string(), // Document ID, usually added after fetching
  adviceText: z.string().min(1, "Feedback message cannot be empty."),
  pageUrl: z.string().url("Invalid URL format for page.").optional(),
  userAgent: z.string().optional(),
  createdAt: z.date(), // Handled as Date in client/server logic, converted to Timestamp for Firestore
  // userId: z.string().optional(), // Uncomment if user authentication is integrated
});

export type AdviceItem = z.infer<typeof AdviceItemSchema>;

// Schema for data as it's stored in Firestore (without ID, with Timestamp for createdAt)
export const FirestoreAdviceItemDataSchema = AdviceItemSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  adviceText: z.string().min(1, "Feedback message cannot be empty."), // ensure adviceText is here
  pageUrl: z.string().url("Invalid URL format for page.").optional(),
  userAgent: z.string().optional(),
  createdAt: z.custom<Timestamp>(
    (val) => val instanceof Timestamp,
    "Expected Firestore Timestamp for createdAt"
  ),
  // userId: z.string().optional(),
});

export type FirestoreAdviceItemData = z.infer<
  typeof FirestoreAdviceItemDataSchema
>;
