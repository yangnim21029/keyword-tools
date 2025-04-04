import { LANGUAGES, REGIONS } from '@/app/config/constants';
import { z } from 'zod';

/**
 * 通用常量和基礎 Schema
 */
const MIN_KEYWORD_LENGTH = 1;

/**
 * 關鍵詞表單數據 Schema
 */
export const keywordFormSchema = z.object({
  query: z.string().min(MIN_KEYWORD_LENGTH, "關鍵詞是必填的"),
  region: z.string()
    .refine(value => Object.keys(REGIONS).includes(value) || Object.values(REGIONS).includes(value), {
      message: "請選擇有效的區域"
    }),
  language: z.string()
    .refine(value => Object.keys(LANGUAGES).includes(value) || Object.values(LANGUAGES).includes(value), {
      message: "請選擇有效的語言"
    }),
  useAlphabet: z.boolean().optional().default(false),
  useSymbols: z.boolean().optional().default(false),
});

/**
 * 關鍵詞搜索量項目 Schema
 */
export const keywordVolumeItemSchema = z.object({
  text: z.string(),
  searchVolume: z.number().int().nonnegative().optional(),
  competition: z.string().optional(), // '低', '中', '高' 等字符串值
  competitionIndex: z.number().int().min(0).max(100).optional(), // 0-100
  cpc: z.number().positive().nullable().optional(), // Cost Per Click
});

/**
 * 關鍵詞建議結果 Schema
 */
export const keywordSuggestionResultSchema = z.object({
  suggestions: z.array(z.string()),
  error: z.string().optional(),
  estimatedProcessingTime: z.number().optional(),
  sourceInfo: z.string().optional(),
});

/**
 * 搜索量結果 Schema
 */
export const keywordVolumeResultSchema = z.object({
  results: z.array(keywordVolumeItemSchema),
  error: z.string().optional(),
  processingTime: z.object({
    estimated: z.number(),
    actual: z.number(),
  }).optional(),
  sourceInfo: z.string().optional(),
  researchId: z.string().nullable().optional(),
});

/**
 * 關鍵詞聚類 Schema
 */
export const keywordClustersSchema = z.record(z.string(), z.array(z.string()));

// 從 Schema 推導出 TypeScript 類型
export type KeywordFormData = z.infer<typeof keywordFormSchema>;
export type KeywordVolumeItem = z.infer<typeof keywordVolumeItemSchema>;
export type KeywordSuggestionResult = z.infer<typeof keywordSuggestionResultSchema>;
export type KeywordVolumeResult = z.infer<typeof keywordVolumeResultSchema>;
export type KeywordClusters = z.infer<typeof keywordClustersSchema>; 