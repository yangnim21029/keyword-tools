import { z } from 'zod';

// Define a basic Firestore Timestamp schema (adjust if needed based on actual structure)
const firestoreTimestampSchema = z
  .union([
    z.date(), // Allow standard Date objects
    z.object({
      // Allow Firestore Timestamp-like objects
      seconds: z.number(),
      nanoseconds: z.number()
    })
  ])
  .describe('Firestore Timestamp');

/**
 * 關鍵字搜索量項目 Schema
 */
export const keywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().int().nonnegative().nullish(),
  competition: z.string().optional().nullish(), // '低', '中', '高' 等字符串值
  competitionIndex: z.number().int().min(0).max(100).optional().nullish(), // 0-100
  cpc: z.number().positive().nullish() // Cost Per Click
});

/**
 * 詳細用戶畫像 Schema
 */
export const UserPersonaSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()),
  characteristics: z.array(z.string()),
  interests: z.array(z.string()),
  painPoints: z.array(z.string()),
  goals: z.array(z.string())
});

// DEPRECATED? Original Schema for raw AI cluster output
export const ClusterSchema = z
  .record(z.string(), z.array(z.string()))
  .describe('(Legacy) Raw AI output: Cluster name mapped to keyword text array');

// NEW: Schema for a single cluster item with volume data included
export const ClusterItemSchema = z.object({
  clusterName: z.string(),
  keywords: z.array(keywordVolumeItemSchema), // Keywords include volume info
  totalVolume: z.number().int().nonnegative().default(0), // Calculated total volume
  personaDescription: z.string().optional().describe('AI生成的用戶畫像描述 (如果存在)')
});

// Base schema for keyword research data
export const KeywordResearchBaseSchema = z.object({
  query: z.string().min(1, '主關鍵字不能為空').describe('主關鍵字'),
  createdAt: firestoreTimestampSchema,
  updatedAt: firestoreTimestampSchema,
  keywords: z
    .array(keywordVolumeItemSchema)
    .optional()
    .describe('Top-level list of keywords and their volume data'),
  // Legacy field for raw AI cluster output
  clusters: ClusterSchema.optional().describe('(Legacy) Raw AI Cluster Output'), 
  // NEW field storing clusters pre-calculated with volumes
  clustersWithVolume: z.array(ClusterItemSchema).optional().describe('Clusters with pre-calculated volumes'),
  personas: z.array(UserPersonaSchema).optional().describe('詳細用戶畫像列表'),
  searchEngine: z.string().optional().describe('使用的搜尋引擎 (例如 google)'),
  region: z.string().optional().describe('地區代碼 (例如 TW)'),
  language: z.string().optional().describe('語言代碼 (例如 zh-TW)'),
  device: z.enum(['desktop', 'mobile']).optional().describe('設備類型'),
  isFavorite: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([])
});

// Schema including the ID
export const KeywordResearchSchema = KeywordResearchBaseSchema.extend({
  id: z.string().describe('記錄的唯一標識符')
});

// Schema for creating new research entries (No clusters fields)
export const CreateKeywordResearchSchema = KeywordResearchBaseSchema.pick({
  query: true,
  searchEngine: true,
  region: true,
  language: true,
  device: true,
  isFavorite: true,
  tags: true
}).partial({
  searchEngine: true,
  region: true,
  language: true,
  device: true,
  isFavorite: true,
  tags: true
}); 

// Schema for general updates (might include legacy clusters or new clustersWithVolume)
export const UpdateKeywordResearchSchema = KeywordResearchBaseSchema.pick({
  query: true,
  keywords: true,
  clusters: true, // Keep for potential updates
  clustersWithVolume: true, // Allow updating the new field
  personas: true,
  searchEngine: true,
  region: true,
  language: true,
  device: true,
  isFavorite: true,
  tags: true
})
  .partial()
  .extend({
    updatedAt: firestoreTimestampSchema.default(() => new Date())
  });

// Specific update schema for legacy clusters (might deprecate)
export const UpdateClustersSchema = z.object({
  clusters: ClusterSchema,
  updatedAt: firestoreTimestampSchema.default(() => new Date())
});

// NEW: Specific update schema for clusters with volume
export const UpdateClustersWithVolumeSchema = z.object({
    clustersWithVolume: z.array(ClusterItemSchema), 
    updatedAt: firestoreTimestampSchema.default(() => new Date())
});

// Schema for a keyword research item (full data)
export const keywordResearchItemSchema = KeywordResearchSchema;

/**
 * Schema for filtering keyword research queries
 */
export const keywordResearchFilterSchema = z
  .object({
    region: z.string().optional(), // Keep only region
    // language: z.string().optional(), // Remove language
    // query: z.string().optional(), // Remove query
    // isFavorite: z.boolean().optional(), // Remove isFavorite
    // tags: z.array(z.string()).optional(), // Remove tags
    // createdAtFrom: z.union([z.date(), z.instanceof(Timestamp)]).optional(), // Remove createdAtFrom
    // createdAtTo: z.union([z.date(), z.instanceof(Timestamp)]).optional(), // Remove createdAtTo
  })
  .partial();

/**
 * Schema for keyword research statistics
 */
export const keywordResearchStatsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  favoriteCount: z.number().int().nonnegative()
});

// --- User Persona Section ---
export const UserPersonaResponseSchema = z.object({
  personas: z.array(UserPersonaSchema),
  metadata: z.object({
    totalKeywords: z.number(),
    totalPersonas: z.number(),
    processingTime: z.number()
  })
});

// Schema possibly for logging which persona description was generated or selected for a research
export const KeywordResearchUserPersonaSchema = z.object({
  id: z.string(),
  persona: z.string().min(10, '用戶畫像描述過短'),
  createdAt: firestoreTimestampSchema.default(() => new Date())
});

// --- Keyword Form/Suggestion/Volume Section ---
import { LANGUAGES, REGIONS } from '@/app/global-config';

/**
 * 通用常量和基礎 Schema
 */
const MIN_KEYWORD_LENGTH = 1;

/**
 * 關鍵字表單數據 Schema
 */
export const keywordFormSchema = z.object({
  query: z.string().min(MIN_KEYWORD_LENGTH, '關鍵字是必填的'),
  region: z
    .string()
    .refine(
      value =>
        Object.keys(REGIONS).includes(value) ||
        Object.values(REGIONS).includes(value),
      {
        message: '請選擇有效的區域'
      }
    ),
  language: z
    .string()
    .refine(
      value =>
        Object.keys(LANGUAGES).includes(value) ||
        Object.values(LANGUAGES).includes(value),
      {
        message: '請選擇有效的語言'
      }
    ),
  useAlphabet: z.boolean().optional().default(false),
  useSymbols: z.boolean().optional().default(false)
});

/**
 * 關鍵字建議結果 Schema
 */
export const keywordSuggestionResultSchema = z.object({
  suggestions: z.array(z.string()),
  error: z.string().optional(),
  estimatedProcessingTime: z.number().optional(),
  sourceInfo: z.string().optional()
});

/**
 * 搜索量結果 Schema
 */
export const keywordVolumeResultSchema = z.object({
  results: z.array(keywordVolumeItemSchema),
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

/**
 * 關鍵字聚類 Schema (Same as ClusterSchema defined earlier? If so, consider reusing)
 * If this represents a different structure (e.g., from a specific API), keep it.
 * Otherwise, consider alias: export const KeywordClustersSchema = ClusterSchema;
 */
export const keywordClustersSchema = z.record(z.string(), z.array(z.string()));

// --- SERP Schemas ---

/**
 * Schema for a single organic result from Apify (example structure)
 */
export const apifyOrganicResultSchema = z.object({
  position: z.number().optional(),
  title: z.string().optional(),
  url: z.string().url().optional(),
  displayedUrl: z.string().optional(),
  description: z.string().optional()
  // Add other fields returned by Apify if necessary
});

/**
 * Schema for an enhanced organic result (potentially after processing)
 */
export const enhancedOrganicResultSchema = apifyOrganicResultSchema.extend({
  // Add any enhanced fields, e.g., category, sentiment, etc.
  category: z.string().optional(),
  // Example: Adding HTML analysis summary directly
  htmlAnalysisSummary: z.string().optional()
});

/**
 * Schema for overall SERP analysis (example structure)
 */
export const serpAnalysisSchema = z.object({
  totalResults: z.number().optional(),
  searchTerms: z.string().optional(),
  // Example analysis fields
  domainDiversity: z.number().optional(),
  averageWordCount: z.number().optional(),
  intent: z.string().optional()
});

/**
 * Schema for the complete processed SERP result to be stored
 */
export const processedSerpResultSchema = z.object({
  researchId: z.string(), // Link back to the keyword research
  query: z.string(),
  region: z.string().optional(),
  language: z.string().optional(),
  serpResults: z.array(enhancedOrganicResultSchema), // Array of enhanced results
  analysis: serpAnalysisSchema.nullable().optional(), // Overall analysis
  retrievedAt: firestoreTimestampSchema, // When the raw SERP was fetched
  processedAt: firestoreTimestampSchema // When processing/analysis was done
});

// --- UI/Component Specific Schemas/Types ---

/**
 * Schema for data used in volume distribution charts/visualizations
 */
export const volumeDistributionDataItemSchema = z.object({
  range: z.string(), // e.g., "1-10", "11-100", "101-1K", etc.
  count: z.number().int().nonnegative() // Number of keywords in this volume range
});

export const volumeDistributionDataSchema = z.array(
  volumeDistributionDataItemSchema
);

// --- Raw SERP Data Schemas ---

// Schema for a single organic result (adapt based on fetchSerpByKeyword output)
export const SerpOrganicResultSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url(),
  title: z.string(),
  description: z.string().optional().nullable(),
  displayedUrl: z.string().optional().nullable(),
  // Add other potentially relevant fields if needed
  // e.g., date, type, sitelinks, emphasizedKeywords etc.
});
export type SerpOrganicResult = z.infer<typeof SerpOrganicResultSchema>;

// Schema for related queries
export const SerpRelatedQuerySchema = z.object({
    query: z.string(),
    url: z.string().url().optional().nullable(),
});
export type SerpRelatedQuery = z.infer<typeof SerpRelatedQuerySchema>;

// Schema for People Also Ask
export const SerpPeopleAlsoAskSchema = z.object({
    question: z.string(),
    answer: z.string().optional().nullable(),
    url: z.string().url().optional().nullable(),
    title: z.string().optional().nullable(),
});
export type SerpPeopleAlsoAsk = z.infer<typeof SerpPeopleAlsoAskSchema>;

// --- Schemas for Analysis JSON Structures (Now part of SerpDataDoc) ---

const pageReferenceSchema = z.object({
  position: z.number().int().positive(),
  url: z.string().url()
});

// Schema for Content Type JSON structure
export const ContentTypeAnalysisJsonSchema = z.object({
  analysisTitle: z.string().optional().nullable(), // Made optional/nullable for flexibility
  reportDescription: z.string().optional().nullable(),
  usageHint: z.string().optional().nullable(),
  contentTypes: z.array(
    z.object({
      type: z.string(),
      count: z.number().int().nonnegative(),
      pages: z.array(pageReferenceSchema)
    })
  ).optional().nullable(), // Made optional/nullable
});
export type ContentTypeAnalysisJson = z.infer<typeof ContentTypeAnalysisJsonSchema>;

// Schema for User Intent JSON structure
export const UserIntentAnalysisJsonSchema = z.object({
  analysisTitle: z.string().optional().nullable(),
  reportDescription: z.string().optional().nullable(),
  usageHint: z.string().optional().nullable(),
  intents: z.array(
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
      pages: z.array(pageReferenceSchema)
    })
  ).optional().nullable(),
  relatedKeywords: z
    .array(
      z.object({
        keyword: z.string(),
        searchVolume: z.number().nullable()
      })
    )
    .optional().nullable(),
});
export type UserIntentAnalysisJson = z.infer<typeof UserIntentAnalysisJsonSchema>;

// Schema for Title Analysis JSON structure
export const TitleAnalysisJsonSchema = z.object({
  title: z.string().optional().nullable(),
  analysis: z.string().optional().nullable(),
  recommendations: z.array(z.string()).optional().nullable(),
});
export type TitleAnalysisJson = z.infer<typeof TitleAnalysisJsonSchema>;

// --- NEW: Schema for Better Have Analysis JSON Structure ---
export const BetterHaveItemSchema = z.object({
    point: z.string().describe('The specific topic, question, or concept recommended'),
    justification: z.string().describe('Explanation why this point is important based on SERP data'),
    source: z.enum(['PAA', 'Organic Results', 'Related Queries', 'AI Overview', 'Multiple']).optional().describe('Primary source driving the recommendation') // Optional: attempt to categorize source
});
export type BetterHaveItem = z.infer<typeof BetterHaveItemSchema>;

export const BetterHaveJsonSchema = z.object({
    analysisTitle: z.string().optional().nullable().default("Better Have In Article Analysis"),
    recommendations: z.array(BetterHaveItemSchema).optional().nullable().describe('List of recommended points to include'),
});
export type BetterHaveAnalysisJson = z.infer<typeof BetterHaveJsonSchema>;

// Schema for the COMBINED SERP document stored in Firestore
// Renamed from FirebaseSerpRawDocSchema
export const FirebaseSerpDataDocSchema = z.object({
  query: z.string().describe('The original search query keyword'),
  region: z.string().describe('Search region code (e.g., hk, tw)'),
  language: z.string().describe('Search language code (e.g., zh-TW, en)'),
  createdAt: firestoreTimestampSchema.describe('Timestamp when the document was created'),
  updatedAt: firestoreTimestampSchema.describe('Timestamp when the document was last updated'),

  // Fields directly from the SERP fetch service (e.g., Apify)
  searchQuery: z.string().optional().nullable().describe('The query structure used by the service'),
  resultsTotal: z.number().int().nonnegative().optional().nullable().describe('Total number of results reported'),
  relatedQueries: z.array(SerpRelatedQuerySchema).optional().nullable().describe('Related search queries'),
  aiOverview: z.string().optional().nullable().describe('AI-generated overview if present'), // Assuming string, adjust if object
  paidResults: z.array(z.any()).optional().nullable().describe('Paid search results (structure varies)'), // Use z.any() or define specific schema if needed
  paidProducts: z.array(z.any()).optional().nullable().describe('Paid product results (structure varies)'), // Use z.any() or define specific schema if needed
  peopleAlsoAsk: z.array(SerpPeopleAlsoAskSchema).optional().nullable().describe('People Also Ask questions'),
  organicResults: z.array(SerpOrganicResultSchema).optional().nullable().describe('Organic search results'),

  // Scraped outlines field
  urlOutline: z.string().nullable().optional().describe('Scraped H2/H3 headings from top organic URLs'),

  // --- Analysis Fields (Now included here) ---
  contentTypeAnalysisText: z.string().nullable().optional().describe('Raw text output of content type analysis'),
  userIntentAnalysisText: z.string().nullable().optional().describe('Raw text output of user intent analysis'),
  contentTypeAnalysis: ContentTypeAnalysisJsonSchema.nullable().optional().describe('Structured JSON output of content type analysis'),
  userIntentAnalysis: UserIntentAnalysisJsonSchema.nullable().optional().describe('Structured JSON output of user intent analysis'),
  titleAnalysis: TitleAnalysisJsonSchema.nullable().optional().describe('Structured JSON output of title analysis'),
  betterHaveAnalysisText: z.string().nullable().optional().describe('Raw Markdown text analysis identifying key topics/questions'), // Renamed from betterHaveInArticle
  betterHaveAnalysisJson: BetterHaveJsonSchema.nullable().optional().describe('Structured JSON output of Better Have analysis'), // New JSON field
});

// Export the inferred type for server-side use
// Renamed from FirebaseSerpRawDoc
export type FirebaseSerpDataDoc = z.infer<typeof FirebaseSerpDataDocSchema>;

// --- Schemas for Processed Data (Client-Ready) ---

/**
 * Schema for the processed keyword research data structure, ready for client components.
 * Mirrors the old KeywordResearchClientSchema.
 */
export const ProcessedKeywordResearchSchema = z.object({
  id: z.string(),
  query: z.string(),
  createdAt: z.date(), // Expect Date object
  updatedAt: z.date(), // Expect Date object
  keywords: z.array(keywordVolumeItemSchema), // Use the imported schema
  clustersWithVolume: z.array(ClusterItemSchema).nullable(), // Use the imported schema, allow null
  // Optional fields expected by client components
  personas: z.array(UserPersonaSchema).nullable().default(null),
  // Change nullish to optional for string/enum fields to match downstream expectation (string | undefined)
  searchEngine: z.string().optional(), 
  region: z.string().optional(),
  language: z.string().optional(),
  device: z.enum(['desktop', 'mobile']).optional(),
  isFavorite: z.boolean().default(false), // Use default
  tags: z.array(z.string()).default([]), // Use default
  // Add clusteringStatus if it was part of the client schema and needed
  // clusteringStatus: z.string().optional() 
});

export type ProcessedKeywordResearchData = z.infer<typeof ProcessedKeywordResearchSchema>;


/**
 * Schema for the processed COMBINED SERP data structure, ready for client components.
 * Converts Firestore Timestamps to Date objects.
 * Mirrors the old SerpDataClientSchema.
 */
export const ProcessedSerpDataSchema = z.object({
  id: z.string(), // Document ID will be added when fetching
  query: z.string(),
  region: z.string(),
  language: z.string(),
  createdAt: z.date(), // Expect Date object
  updatedAt: z.date(), // Expect Date object

  // Fields from the SERP fetch service (make nullable if they can be missing)
  searchQuery: z.string().optional().nullable(),
  resultsTotal: z.number().int().nonnegative().optional().nullable(),
  relatedQueries: z.array(SerpRelatedQuerySchema).optional().nullable(),
  aiOverview: z.string().optional().nullable(),
  paidResults: z.array(z.any()).optional().nullable(),
  paidProducts: z.array(z.any()).optional().nullable(),
  peopleAlsoAsk: z.array(SerpPeopleAlsoAskSchema).optional().nullable(),
  organicResults: z.array(SerpOrganicResultSchema).optional().nullable(),

  // Scraped outlines field
  urlOutline: z.string().nullable().optional(),

  // --- Analysis Fields (Now included here) ---
  contentTypeAnalysisText: z.string().nullable().optional(),
  userIntentAnalysisText: z.string().nullable().optional(),
  contentTypeAnalysis: ContentTypeAnalysisJsonSchema.nullable().optional(), 
  userIntentAnalysis: UserIntentAnalysisJsonSchema.nullable().optional(),
  titleAnalysis: TitleAnalysisJsonSchema.nullable().optional(),
});

export type ProcessedSerpData = z.infer<typeof ProcessedSerpDataSchema>;
