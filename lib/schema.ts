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
  searchVolume: z.number().int().nonnegative().optional(),
  competition: z.string().optional(), // '低', '中', '高' 等字符串值
  competitionIndex: z.number().int().min(0).max(100).optional(), // 0-100
  cpc: z.number().positive().nullable().optional() // Cost Per Click
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

// 語義分群結果 Schema
export const ClusterSchema = z
  .record(z.string(), z.array(z.string()))
  .describe('語義分群結果: 主題名稱映射到關鍵字數組');

// Base schema for keyword research data
export const KeywordResearchBaseSchema = z.object({
  query: z.string().min(1, '主關鍵字不能為空').describe('主關鍵字'),
  createdAt: firestoreTimestampSchema,
  updatedAt: firestoreTimestampSchema,
  keywords: z
    .array(keywordVolumeItemSchema)
    .optional()
    .describe('關鍵字列表及其搜索量數據'),
  clusters: ClusterSchema.optional().describe('語義分群結果'),
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

// Schema for creating new research entries
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
}); // Note: id, createdAt, updatedAt, keywords, clusters, personas are excluded

// Schema for updating existing research entries (general update)
export const UpdateKeywordResearchSchema = KeywordResearchBaseSchema.pick({
  query: true,
  keywords: true,
  clusters: true,
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

// Specific update schemas
export const UpdateClustersSchema = z.object({
  clusters: ClusterSchema,
  updatedAt: firestoreTimestampSchema.default(() => new Date())
});

// Schema for a keyword research item (full data)
export const keywordResearchItemSchema = KeywordResearchSchema;

/**
 * Schema for filtering keyword research queries
 */
export const keywordResearchFilterSchema = z
  .object({
    query: z.string().optional(),
    region: z.string().optional(),
    language: z.string().optional(),
    isFavorite: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
    createdAtFrom: firestoreTimestampSchema.optional(),
    createdAtTo: firestoreTimestampSchema.optional()
  })
  .partial();

/**
 * Schema for keyword research statistics
 */
export const keywordResearchStatsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  favoriteCount: z.number().int().nonnegative()
});

// Exported types inferred from schemas
export type KeywordResearchBase = z.infer<typeof KeywordResearchBaseSchema>;
export type KeywordResearchItem = z.infer<typeof keywordResearchItemSchema>;
export type KeywordResearchFilter = z.infer<typeof keywordResearchFilterSchema>;
export type KeywordResearchStats = z.infer<typeof keywordResearchStatsSchema>;
export type CreateKeywordResearchInput = z.infer<
  typeof CreateKeywordResearchSchema
>;
export type UpdateKeywordResearchInput = z.infer<
  typeof UpdateKeywordResearchSchema
>;
export type UpdateClustersInput = z.infer<typeof UpdateClustersSchema>;
export type Cluster = z.infer<typeof ClusterSchema>;
export type Persona = z.infer<typeof UserPersonaSchema>;

// --- User Persona Section (Already defined above, consolidating) ---
// Note: The UserPersonaSchema definition is moved to the top for clarity.
//       The types below are derived from that single definition.

export const UserPersonaResponseSchema = z.object({
  personas: z.array(UserPersonaSchema),
  metadata: z.object({
    totalKeywords: z.number(),
    totalPersonas: z.number(),
    processingTime: z.number()
  })
});

export type UserPersona = z.infer<typeof UserPersonaSchema>;
export type UserPersonaResponse = z.infer<typeof UserPersonaResponseSchema>;

// Schema possibly for logging which persona description was generated or selected for a research
export const KeywordResearchUserPersonaSchema = z.object({
  id: z.string(),
  persona: z.string().min(10, '用戶畫像描述過短'),
  createdAt: firestoreTimestampSchema.default(() => new Date())
});

// Type for the persona log entry
export type KeywordResearchUserPersona = z.infer<
  typeof KeywordResearchUserPersonaSchema
>;

// --- Keyword Form/Suggestion/Volume Section ---
import { LANGUAGES, REGIONS } from '@/app/config/constants';

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

// 從 Schema 推導出 TypeScript 類型
export type KeywordFormData = z.infer<typeof keywordFormSchema>;
export type KeywordVolumeItem = z.infer<typeof keywordVolumeItemSchema>;
export type KeywordSuggestionResult = z.infer<
  typeof keywordSuggestionResultSchema
>;
export type KeywordVolumeResult = z.infer<typeof keywordVolumeResultSchema>;
export type KeywordClusters = z.infer<typeof keywordClustersSchema>;

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
export type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>;

/**
 * Schema for an enhanced organic result (potentially after processing)
 */
export const enhancedOrganicResultSchema = apifyOrganicResultSchema.extend({
  // Add any enhanced fields, e.g., category, sentiment, etc.
  category: z.string().optional(),
  // Example: Adding HTML analysis summary directly
  htmlAnalysisSummary: z.string().optional()
});
export type EnhancedOrganicResult = z.infer<typeof enhancedOrganicResultSchema>;

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
export type SerpAnalysis = z.infer<typeof serpAnalysisSchema>;

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
export type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;

// --- UI/Component Specific Schemas/Types ---

/**
 * Schema for data used in volume distribution charts/visualizations
 */
export const volumeDistributionDataItemSchema = z.object({
  range: z.string(), // e.g., "1-10", "11-100", "101-1K", etc.
  count: z.number().int().nonnegative() // Number of keywords in this volume range
});
export type VolumeDistributionDataItem = z.infer<
  typeof volumeDistributionDataItemSchema
>;

export const volumeDistributionDataSchema = z.array(
  volumeDistributionDataItemSchema
);
export type VolumeDistributionData = z.infer<
  typeof volumeDistributionDataSchema
>;
