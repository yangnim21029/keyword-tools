import { z } from 'zod';
import { firestoreTimestampSchema } from './common.schema';

/**
 * 通用的常量和工具函數
 */
const DEFAULT_MAX_RESULTS = 100;

/**
 * SERP API 輸入參數驗證 Schema
 */
export const serpApiInputSchema = z.object({
  keywords: z.array(z.string().min(1, "關鍵詞不能為空")).min(1, "至少需要一個關鍵詞"),
  region: z.string().min(1, "地區不能為空"),
  language: z.string().min(1, "語言不能為空"),
  maxResults: z.number().int().positive().optional().default(DEFAULT_MAX_RESULTS),
});

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

// 從 Schema 推導出 TypeScript 類型
export type SerpApiInput = z.infer<typeof serpApiInputSchema>;
export type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>;
export type HtmlAnalysisResult = z.infer<typeof htmlAnalysisResultSchema>;
export type EnhancedOrganicResult = z.infer<typeof enhancedOrganicResultSchema>;
export type ApifyResultItem = z.infer<typeof apifyResultItemSchema>;
export type SerpAnalysis = z.infer<typeof serpAnalysisSchema>;
export type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;
export type FirebaseSerpResultsMap = z.infer<typeof firebaseSerpResultsMapSchema>;
export type FirebaseSerpDocument = z.infer<typeof firebaseSerpDocumentSchema>; 