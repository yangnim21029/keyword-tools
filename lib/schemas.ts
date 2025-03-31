import { z } from "zod";

// 基本類型定義
export const KeywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().nullable(),
  competition: z.number().nullable(),
  cpc: z.number().nullable(),
});

export type KeywordVolumeItem = z.infer<typeof KeywordVolumeItemSchema>;

// 關鍵詞研究記錄類型
export const KeywordResearchItemSchema = z.object({
  id: z.string(),
  mainKeyword: z.string(),
  region: z.string(),
  language: z.string(),
  timestamp: z.coerce.date(),
  type: z.enum(['keyword', 'url', 'serp']),
  suggestionCount: z.number(),
  resultsCount: z.number(),
  suggestionsPreview: z.array(z.string()),
  clustersCount: z.number(),
  suggestions: z.array(z.string()).optional(),
  clusters: z.record(z.string(), z.array(z.string())).optional(),
  searchResults: z.array(z.any()).optional(),
});

export type KeywordResearchItem = z.infer<typeof KeywordResearchItemSchema>;

// SERP 相關 schema
export const apifyResultItemSchema = z.object({
  title: z.string(),
  url: z.string(),
  displayedUrl: z.string().optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  type: z.string().optional(),
});

export const apifyOrganicResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  displayedUrl: z.string().optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  type: z.string().optional(),
  sitelinks: z.array(apifyResultItemSchema).optional(),
});

export type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>;

export const htmlAnalysisResultSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  h1: z.array(z.string()).optional(),
  h2: z.array(z.string()).optional(),
  h3: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional(),
  wordCount: z.number().optional(),
  paragraphs: z.array(z.string()).optional(),
  links: z.array(z.string()).optional(),
});

export const processedSerpResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  displayedUrl: z.string().optional(),
  description: z.string().optional(),
  position: z.number().optional(),
  type: z.string().optional(),
  sitelinks: z.array(apifyResultItemSchema).optional(),
  htmlAnalysis: htmlAnalysisResultSchema.optional(),
});

export type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;

export const serpApiInputSchema = z.object({
  keyword: z.string(),
  region: z.string(),
  language: z.string(),
});

// Firebase SERP 結果相關 schema
export const firebaseSerpResultsMapSchema = z.record(z.object({
  results: z.array(processedSerpResultSchema),
  timestamp: z.any(), // Firestore Timestamp
  expiresAt: z.any(), // Firestore Timestamp
})); 