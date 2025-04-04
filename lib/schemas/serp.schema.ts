import { z } from 'zod';
import { firestoreTimestampSchema } from './common.schema';

/**
 * 通用的常量和工具函數
 */

/**
 * Apify API 有機搜尋結果 Schema
 */
export const apifyOrganicResultSchema = z.object({
  title: z.string().optional().default(''),
  url: z.string().url("無效的 URL").or(z.literal('')).optional().default(''),
  displayedUrl: z.string().optional().default(''),
  position: z.number().int().nonnegative().optional().default(0),
  description: z.string().optional().default(''),
  siteLinks: z.array(z.any()).optional().default([]),
  emphasizedKeywords: z.array(z.string()).optional().default([]),
}).passthrough();

/**
 * HTML 分析結果 Schema
 */
export const htmlAnalysisResultSchema = z.object({
  headings: z.array(z.object({
    level: z.enum(['h1', 'h2', 'h3']),
    text: z.string()
  })).optional().default([]),
  h1Consistency: z.boolean(),
  contentRef: z.string().optional().nullable().default(null),
});

/**
 * 擴展的有機搜尋結果（包含 HTML 分析）- Redefined without .extend()
 */
export const enhancedOrganicResultSchema = z.object({
  // Copied fields from apifyOrganicResultSchema
  title: z.string().optional().default(''),
  url: z.string().url("無效的 URL").or(z.literal('')).optional().default(''),
  displayedUrl: z.string().optional().default(''),
  position: z.number().int().nonnegative().optional().default(0),
  description: z.string().optional().default(''),
  siteLinks: z.array(z.any()).optional().default([]),
  emphasizedKeywords: z.array(z.string()).optional().default([]),
  // The optional/nullable field
  htmlAnalysis: htmlAnalysisResultSchema.nullable().optional()
}).passthrough(); // Keep passthrough from original base schema

/**
 * Apify API 回傳單個項目 Schema
 */
export const apifyResultItemSchema = z.object({
  searchQuery: z.object({ term: z.string() })
    .or(z.string()) // 兼容舊格式
    .optional(),
  organicResults: z.array(apifyOrganicResultSchema).optional().default([]),
  resultsTotal: z.number().int().nonnegative().nullable().optional().default(0), // 允許 number, null, 或 undefined，默認為 0
  relatedQueries: z.array(z.any()).optional().default([]),
  peopleAlsoAsk: z.array(z.any()).optional().default([]),
}).passthrough();

/**
 * SERP 分析結果 Schema
 */
export const serpAnalysisSchema = z.object({
  totalResults: z.number().int().nonnegative(),
  domains: z.record(z.string(), z.number()),
  topDomains: z.array(z.string()),
  avgTitleLength: z.number().int().nonnegative(),
  avgDescriptionLength: z.number().int().nonnegative(),
});

/**
 * 處理後的單個關鍵詞 SERP 結果 Schema
 */
export const processedSerpResultSchema = z.object({
  results: z.array(enhancedOrganicResultSchema),
  analysis: serpAnalysisSchema,
  timestamp: z.string(),
  originalQuery: z.string(),
  queryDetails: z.record(z.string(), z.any()).optional(),
  totalResults: z.number().int().nonnegative().optional(),
  relatedQueries: z.array(z.any()).optional(),
  peopleAlsoAsk: z.array(z.any()).optional(),
  rawData: z.any().optional(), // 實際使用時可定義更嚴格的類型
});

/**
 * Firebase 保存的 SERP 結果映射 Schema
 */
export const firebaseSerpResultsMapSchema = z.record(
  z.string(), // 關鍵詞作為鍵
  processedSerpResultSchema
);

/**
 * Firebase 保存的 SERP 文檔結構 Schema
 */
export const firebaseSerpDocumentSchema = z.object({
  keywords: z.array(z.string()),
  region: z.string(),
  language: z.string(),
  results: firebaseSerpResultsMapSchema,
  timestamp: firestoreTimestampSchema, // 使用從 common.schema.ts 引入的 firestoreTimestampSchema
  searchQueries: z.array(z.string()),
});

/**
 * 單個 SERP 結果項目的 Schema
 * 包含 README.md 中提到的字段：title, description (metadescription), url, position, type, device
 */
export const SerpResultItemSchema = z.object({
  title: z.string().optional().describe('頁面標題'),
  description: z.string().optional().describe('頁面元描述'),
  url: z.string().url('無效的 URL').or(z.literal('')).optional().describe('頁面 URL'),
  position: z.number().int().nonnegative().optional().describe('在 SERP 中的排名'),
  type: z.enum(['organic', 'ads', 'featured_snippet', 'people_also_ask', 'local_pack', 'video', 'image', 'other']).default('organic').describe('結果類型'),
  device: z.enum(['desktop', 'mobile']).optional().describe('目標設備'),
  // 可以選擇性地保留或添加其他從 Apify 或其他來源獲取的有用字段
  displayedUrl: z.string().optional().describe('顯示的 URL'),
  // siteLinks: z.array(z.any()).optional(), // 示例：可能保留的字段
  // emphasizedKeywords: z.array(z.string()).optional(), // 示例：可能保留的字段
}).passthrough(); // 允許未定義的額外字段

/**
 * HTML 分析結果 Schema (從舊 schema 移過來，可能需要調整)
 */
export const HtmlAnalysisResultSchema = z.object({
  headings: z.array(z.object({
    level: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']), // 擴展 level
    text: z.string()
  })).optional().describe('提取的標題標籤 (H1-H6)'),
  h1Consistency: z.boolean().optional().describe('H1 標籤與標題的一致性'),
  wordCount: z.number().int().nonnegative().optional().describe('內容字數'),
  // 可以添加更多 HTML 分析字段，例如 internal/external links count, image alt text usage 等
  // contentRef: z.string().optional().nullable().default(null), // 如果需要保存原始 HTML 的引用
}).passthrough();

/**
 * SERP 分析指標 Schema
 * 包含 README.md 中提到的分析內容
 */
export const SerpAnalysisMetricsSchema = z.object({
  domains: z.record(z.string(), z.number()).describe('域名出現次數統計'),
  topDomains: z.array(z.string()).optional().describe('排名靠前的域名列表'),
  avgTitleLength: z.number().nonnegative().optional().describe('平均標題長度'),
  avgDescriptionLength: z.number().nonnegative().optional().describe('平均描述長度'),
  resultTypeDistribution: z.record(z.string(), z.number()).optional().describe('結果類型分布統計'),
  htmlAnalysisSummary: HtmlAnalysisResultSchema.optional().describe('排名頁面的匯總 HTML 分析 (或每個結果單獨分析?)'),
  // 可以添加更多分析指標
  totalResults: z.number().int().nonnegative().optional().describe('估計的總結果數'),
});

/**
 * 核心 SERP 文檔 Schema (對應 README.md 中的 SerpAnalysis)
 */
export const SerpSchema = z.object({
  id: z.string().describe('分析記錄的唯一標識符'),
  type: z.literal('serp').describe('文檔類型標識符'),
  query: z.string().min(1).describe('執行分析的主查詢關鍵詞'),
  location: z.string().optional().describe('分析的地理位置 (例如 TW)'),
  language: z.string().optional().describe('分析的語言 (例如 zh-TW)'),
  device: z.enum(['desktop', 'mobile']).optional().describe('分析的目標設備'),
  serpResults: z.array(SerpResultItemSchema).optional().describe('從搜索引擎獲取的結果列表'),
  analysis: SerpAnalysisMetricsSchema.optional().describe('對 SERP 結果的分析指標'),
  createdAt: firestoreTimestampSchema.default(() => new Date()),
  updatedAt: firestoreTimestampSchema.default(() => new Date()),
  // 可以添加其他元數據字段，如 searchEngine, rawDataRef 等
  searchEngine: z.string().optional().default('google').describe('使用的搜索引擎'),
});

// Schema for creating new SERP analysis entries
export const CreateSerpSchema = SerpSchema.omit({ id: true, createdAt: true, updatedAt: true }).extend({
  // Allow providing initial results or analysis if available at creation time
  serpResults: z.array(SerpResultItemSchema).optional(),
  analysis: SerpAnalysisMetricsSchema.optional(),
  // Set default timestamps during creation
  createdAt: firestoreTimestampSchema.default(() => new Date()),
  updatedAt: firestoreTimestampSchema.default(() => new Date()),
});

// Schema for updating existing SERP analysis entries
export const UpdateSerpSchema = SerpSchema.pick({
  serpResults: true,
  analysis: true,
  // Allow updating other fields if necessary
  query: true,
  location: true,
  language: true,
  device: true,
  searchEngine: true,
})
  .partial() // All fields are optional for update
  .extend({
    updatedAt: firestoreTimestampSchema.default(() => new Date()), // Always update the timestamp
  });

// --- 推導出的 TypeScript 類型 ---
export type SerpResultItem = z.infer<typeof SerpResultItemSchema>;
export type HtmlAnalysisResult = z.infer<typeof HtmlAnalysisResultSchema>;
export type SerpAnalysisMetrics = z.infer<typeof SerpAnalysisMetricsSchema>;
export type Serp = z.infer<typeof SerpSchema>;
export type CreateSerpInput = z.infer<typeof CreateSerpSchema>;
export type UpdateSerpInput = z.infer<typeof UpdateSerpSchema>;

// --- 用於 API 輸入/輸出的 Schema (如果需要) ---
// 例如，用於觸發 SERP 分析的 API 輸入
export const TriggerSerpAnalysisInputSchema = z.object({
  query: z.string().min(1, "查詢不能為空"),
  location: z.string().min(1, "地區不能為空"),
  language: z.string().min(1, "語言不能為空"),
  device: z.enum(['desktop', 'mobile']).optional().default('desktop'),
  searchEngine: z.string().optional().default('google'),
  maxResults: z.number().int().positive().optional().default(20).describe('期望獲取的最大結果數'),
});
export type TriggerSerpAnalysisInput = z.infer<typeof TriggerSerpAnalysisInputSchema>; 