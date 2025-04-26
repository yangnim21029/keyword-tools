import { Timestamp } from 'firebase-admin/firestore'; // Import admin Timestamp
import { z } from 'zod';

// Define a robust Firestore Timestamp schema that outputs a Date object
const FirestoreTimestampSchema = z
  .custom<
    | Timestamp
    | { seconds: number; nanoseconds: number }
    | { _seconds: number; _nanoseconds: number }
  >(
    value => {
      if (value instanceof Timestamp) {
        return true;
      }
      // Handle raw timestamp data (seconds/nanoseconds)
      if (
        typeof value === 'object' &&
        value !== null &&
        'seconds' in value &&
        typeof value.seconds === 'number' &&
        'nanoseconds' in value &&
        typeof value.nanoseconds === 'number'
      ) {
        return true;
      }
      // Handle raw timestamp data (_seconds/_nanoseconds)
      if (
        typeof value === 'object' &&
        value !== null &&
        '_seconds' in value &&
        typeof value._seconds === 'number' &&
        '_nanoseconds' in value &&
        typeof value._nanoseconds === 'number'
      ) {
        return true;
      }
      return false;
    },
    { message: 'Invalid Firestore Timestamp format' }
  )
  .transform(value => {
    // Transform to JS Date object
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    // Convert raw timestamp data to Timestamp instance, then to Date
    const seconds = '_seconds' in value ? value._seconds : value.seconds;
    const nanoseconds =
      '_nanoseconds' in value ? value._nanoseconds : value.nanoseconds;
    return new Timestamp(seconds, nanoseconds).toDate();
  })
  .describe('Firestore Timestamp (validated and transformed to Date)');

/**
 * 關鍵字搜索量項目 Schema
 */
export const KeywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().int().nonnegative().nullish(),
  competition: z.string().optional().nullish(), // Storing the string value (e.g., 'LOW', 'MEDIUM', 'HIGH')
  competitionIndex: z.number().int().min(0).max(100).optional().nullish(), // 0-100
  cpc: z.number().positive().nullish() // Cost Per Click
});

export const AiClusterItemSchema = z.object({
  clusterName: z.string(),
  mainKeyword: z.string(),
  totalVolume: z.number().int().nonnegative().default(0),
  keywords: z.array(KeywordVolumeItemSchema),
  longTailKeywords: z
    .array(z.string())
    .optional()
    .describe('提取的長尾字詞部分'),
  personaDescription: z.string().optional().describe('AI生成的用戶畫像描述')
});

// Consolidated schema for the full Keyword Research document in Firestore
export const KeywordVolumeObjectSchema = z.object({
  id: z.string().describe('記錄的唯一標識符'),
  query: z.string().min(1, '主關鍵字不能為空').describe('主關鍵字'),
  createdAt: FirestoreTimestampSchema,
  updatedAt: FirestoreTimestampSchema,
  totalVolume: z.number().int().nonnegative().default(0),
  keywords: z
    .array(KeywordVolumeItemSchema)
    .optional()
    .describe('Top-level list of keywords and their volume data'),
  clustersWithVolume: z
    .array(AiClusterItemSchema)
    .optional()
    .describe('Clusters with pre-calculated volumes'),
  searchEngine: z.string().optional().describe('使用的搜尋引擎 (例如 google)'),
  region: z.string().optional().describe('地區代碼 (例如 TW)'),
  language: z.string().optional().describe('語言代碼 (例如 zh-TW)'),
  tags: z.array(z.string()).optional().default([])
});

// Schema for the data needed specifically for the list view (subset of KeywordVolumeObjectSchema)
export const KeywordVolumeListItemSchema = KeywordVolumeObjectSchema.pick({
  id: true,
  query: true,
  createdAt: true,
  totalVolume: true,
  region: true,
  language: true
  // Removed: updatedAt, keywords, clustersWithVolume, searchEngine, tags
});

/**
 * 關鍵字建議結果 Schema
 */
export const keywordSuggestionResultSchema = z.object({
  suggestions: z.array(z.string()),
  error: z.string().optional(),
  sourceInfo: z.string().optional()
});

// Export the inferred type
export type KeywordSuggestionResult = z.infer<
  typeof keywordSuggestionResultSchema
>;

/**
 * 搜索量結果 Schema
 */
export const keywordVolumeResultSchema = z.object({
  results: z.array(KeywordVolumeItemSchema),
  error: z.string().optional(),
  processingTime: z
    .object({
      estimated: z.number(),
      actual: z.number()
    })
    .optional(),
  sourceInfo: z.string().optional(),
  researchId: z.string().nullable().optional()
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
  description: z.string().optional()
  // Add other fields returned by Apify if necessary
});

export const SerpResultSchema = z.object({
  query: z.string(),
  region: z.string().optional(),
  language: z.string().optional(),
  serpResults: z.array(OrganicResultSchema),
  retrievedAt: FirestoreTimestampSchema,
  processedAt: FirestoreTimestampSchema
});

// Schema for related queries
export const SerpRelatedQuerySchema = z.object({
  query: z.string(),
  url: z.string().url().optional().nullable()
});

// Schema for People Also Ask
export const SerpPeopleAlsoAskSchema = z.object({
  question: z.string(),
  answer: z.string().optional().nullable(),
  url: z.string().url().optional().nullable(),
  title: z.string().optional().nullable()
});

// --- Schemas for Analysis JSON Structures (Now part of SerpDataDoc) ---

const PageReferenceSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url()
});

// Schema for Content Type JSON structure
export const AiContentTypeAnalysisJsonSchema = z.object({
  analysisTitle: z.string().optional().nullable(), // Made optional/nullable for flexibility
  reportDescription: z.string().optional().nullable(),
  usageHint: z.string().optional().nullable(),
  contentTypes: z
    .array(
      z.object({
        type: z.string(),
        count: z.number().int().nonnegative(),
        pages: z.array(PageReferenceSchema)
      })
    )
    .optional()
    .nullable() // Made optional/nullable
});

// Schema for User Intent JSON structure
export const AiUserIntentAnalysisJsonSchema = z.object({
  analysisTitle: z.string().optional().nullable(),
  reportDescription: z.string().optional().nullable(),
  usageHint: z.string().optional().nullable(),
  intents: z
    .array(
      z.object({
        category: z.enum([
          'Navigational',
          'Informational',
          'Commercial',
          'Transactional',
          'Unknown' // Added Unknown for robustness
        ]),
        specificIntent: z.string(),
        count: z.number().int().nonnegative(),
        pages: z.array(PageReferenceSchema)
      })
    )
    .optional()
    .nullable(),
  relatedKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        searchVolume: z.number().nullable()
      })
    )
    .optional()
    .nullable()
});

// Schema for Title Analysis JSON structure
export const AiTitleAnalysisJsonSchema = z.object({
  title: z.string().optional().nullable(),
  analysis: z.string().optional().nullable(),
  recommendations: z.array(z.string()).optional().nullable()
});

// --- NEW: Schema for Better Have Analysis JSON Structure ---
export const AiSerpBetterHaveItemSchema = z.object({
  point: z
    .string()
    .describe('The specific topic, question, or concept recommended'),
  justification: z
    .string()
    .describe('Explanation why this point is important based on SERP data'),
  source: z
    .enum([
      'PAA',
      'Organic Results',
      'Related Queries',
      'AI Overview',
      'Multiple'
    ])
    .optional()
    .nullable()
    .describe('Primary source driving the recommendation')
});

export const AiSerpBetterHaveJsonSchema = z.object({
  analysisTitle: z
    .string()
    .optional()
    .nullable()
    .default('Better Have In Article Analysis'),
  recommendations: z
    .array(AiSerpBetterHaveItemSchema)
    .optional()
    .nullable()
    .describe('List of recommended points to include')
});

// Schema for the COMBINED SERP document stored in Firestore
// Renamed from FirebaseSerpRawDocSchema
export const FirebaseSerpResultObjectSchema = z.object({
  query: z.string().describe('The original search query keyword'),
  region: z.string().describe('Search region code (e.g., hk, tw)'),
  language: z.string().describe('Search language code (e.g., zh-TW, en)'),
  createdAt: FirestoreTimestampSchema.describe(
    'Timestamp when the document was created'
  ),
  updatedAt: FirestoreTimestampSchema.describe(
    'Timestamp when the document was last updated'
  ),

  // Fields directly from the SERP fetch service (e.g., Apify)
  searchQuery: z
    .string()
    .optional()
    .nullable()
    .describe('The query structure used by the service'),
  resultsTotal: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .nullable()
    .describe('Total number of results reported'),
  relatedQueries: z
    .array(SerpRelatedQuerySchema)
    .optional()
    .nullable()
    .describe('Related search queries'),
  aiOverview: z
    .string()
    .optional()
    .nullable()
    .describe('AI-generated overview if present'), // Assuming string, adjust if object
  paidResults: z
    .array(z.any())
    .optional()
    .nullable()
    .describe('Paid search results (structure varies)'), // Use z.any() or define specific schema if needed
  paidProducts: z
    .array(z.any())
    .optional()
    .nullable()
    .describe('Paid product results (structure varies)'), // Use z.any() or define specific schema if needed
  peopleAlsoAsk: z
    .array(SerpPeopleAlsoAskSchema)
    .optional()
    .nullable()
    .describe('People Also Ask questions'),
  organicResults: z
    .array(OrganicResultSchema)
    .optional()
    .nullable()
    .describe('Organic search results'),
  // Scraped outlines field
  urlOutline: z
    .string()
    .nullable()
    .optional()
    .describe('Scraped H2/H3 headings from top organic URLs'),

  // --- Analysis Fields (Now included here) ---
  contentTypeAnalysisText: z
    .string()
    .nullable()
    .optional()
    .describe('Raw text output of content type analysis'),
  userIntentAnalysisText: z
    .string()
    .nullable()
    .optional()
    .describe('Raw text output of user intent analysis'),
  contentTypeAnalysis: AiContentTypeAnalysisJsonSchema.nullable()
    .optional()
    .describe('Structured JSON output of content type analysis'),
  userIntentAnalysis: AiUserIntentAnalysisJsonSchema.nullable()
    .optional()
    .describe('Structured JSON output of user intent analysis'),
  titleAnalysis: AiTitleAnalysisJsonSchema.nullable()
    .optional()
    .describe('Structured JSON output of title analysis'),
  betterHaveAnalysis: AiSerpBetterHaveJsonSchema.nullable()
    .optional()
    .describe('Structured JSON output of Better Have analysis') // New JSON field
});

export type KeywordVolumeItem = z.infer<typeof KeywordVolumeItemSchema>;
export type AiClusterItem = z.infer<typeof AiClusterItemSchema>;
export type AiContentTypeAnalysisJson = z.infer<
  typeof AiContentTypeAnalysisJsonSchema
>;
export type AiUserIntentAnalysisJson = z.infer<
  typeof AiUserIntentAnalysisJsonSchema
>;
export type AiTitleAnalysisJson = z.infer<typeof AiTitleAnalysisJsonSchema>;
export type AiSerpBetterHaveAnalysisJson = z.infer<
  typeof AiSerpBetterHaveJsonSchema
>;
export type FirebaseSerpResultObject = z.infer<
  typeof FirebaseSerpResultObjectSchema
>;
export type KeywordVolumeObject = z.infer<typeof KeywordVolumeObjectSchema>;
export type KeywordVolumeListItem = z.infer<typeof KeywordVolumeListItemSchema>;
