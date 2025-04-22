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
