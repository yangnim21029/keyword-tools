import {
  historyFilterSchema,
  historyListItemSchema,
  historyStatsSchema,
  searchHistoryItemSchema,
} from '@/lib/schemas/searchHistory.schema';
import { z } from 'zod';

/**
 * Complete search history item, derived from schema.
 * Note: Corresponds to the commented-out `SearchHistoryItem` in old `app/types.ts`.
 */
export type SearchHistoryItem = z.infer<typeof searchHistoryItemSchema>;

/**
 * Simplified list item for search history (omitting large data fields), derived from schema.
 */
export type HistoryListItem = z.infer<typeof historyListItemSchema>;

/**
 * Filters for querying search history, derived from schema.
 */
export type HistoryFilter = z.infer<typeof historyFilterSchema>;

/**
 * Statistics about search history, derived from schema.
 */
export type HistoryStats = z.infer<typeof historyStatsSchema>;

// --- Potentially missing/different types from old app/types.ts ---
// export interface SearchHistoryListResult {
//   data: SearchHistoryItem[]; // Covered by HistoryListItem[] or SearchHistoryItem[]
//   sourceInfo?: string;
//   error?: string;
// }
// export interface SearchHistoryDetailResult {
//   data: SearchHistoryItem | null; // Covered by SearchHistoryItem | null
//   sourceInfo?: string;
//   error?: string;
// }
// ^^^ These seem to be API response wrappers rather than core data types.
// They can be defined where the API functions are declared or used, 
// potentially using generic types like ApiResponse<T>. 