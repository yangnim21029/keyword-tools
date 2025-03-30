import { z } from 'zod';
import { firestoreTimestampSchema } from './common.schema';
import { keywordClustersSchema } from './keyword.schema';

/**
 * 搜索歷史項目完整 Schema
 */
export const searchHistoryItemSchema = z.object({
  id: z.string().min(1, "ID 不能為空"),
  mainKeyword: z.string().min(1, "主關鍵詞不能為空"),
  region: z.string().min(1, "區域不能為空"),
  language: z.string().min(1, "語言不能為空"),
  // 使用通用的 Firestore Timestamp 處理
  timestamp: firestoreTimestampSchema,
  
  // 可選數據
  suggestions: z.array(z.string()).optional(),
  searchResults: z.array(z.any()).optional(),
  clusters: keywordClustersSchema.nullable().optional(),
  
  // 計數字段 (使用 nonnegative 確保不會出現負數)
  suggestionCount: z.number().int().nonnegative("建議數量不能為負數"),
  resultsCount: z.number().int().nonnegative("結果數量不能為負數"),
  clustersCount: z.number().int().nonnegative("分群數量不能為負數").optional(),
});

/**
 * 歷史記錄列表項目 (移除大量數據，僅保留基本信息)
 */
export const historyListItemSchema = searchHistoryItemSchema.omit({
  suggestions: true,
  searchResults: true,
  clusters: true,
});

/**
 * 搜索歷史過濾條件 Schema (用於查詢)
 */
export const historyFilterSchema = z.object({
  keyword: z.string().optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
}).partial();

/**
 * 搜索歷史統計 Schema
 */
export const historyStatsSchema = z.object({
  totalCount: z.number().int().nonnegative(),
  regionCounts: z.record(z.string(), z.number().int()),
  languageCounts: z.record(z.string(), z.number().int()),
  keywordCounts: z.record(z.string(), z.number().int()),
  dateDistribution: z.record(z.string(), z.number().int()),
});

// 從 Schema 推導出 TypeScript 類型
export type SearchHistoryItem = z.infer<typeof searchHistoryItemSchema>;
export type HistoryListItem = z.infer<typeof historyListItemSchema>;
export type HistoryFilter = z.infer<typeof historyFilterSchema>;
export type HistoryStats = z.infer<typeof historyStatsSchema>; 