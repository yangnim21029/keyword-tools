import {
  keywordClustersSchema,
  keywordFormSchema,
  keywordSuggestionResultSchema,
  keywordVolumeItemSchema,
  keywordVolumeResultSchema,
} from '@/lib/schemas/keyword.schema';
import { z } from 'zod';

/**
 * Keyword Form Data derived from schema.
 */
export type KeywordFormData = z.infer<typeof keywordFormSchema>;

/**
 * Individual keyword volume item derived from schema.
 */
export type KeywordVolumeItem = z.infer<typeof keywordVolumeItemSchema>;

/**
 * Keyword suggestion result derived from schema.
 * Note: This corresponds to `SuggestionsResult` in the old `app/types.ts`.
 */
export type KeywordSuggestionResult = z.infer<typeof keywordSuggestionResultSchema>;

/**
 * Search volume result containing multiple keyword items, derived from schema.
 * Note: This corresponds to `SearchVolumeResult` in the old `app/types.ts`.
 */
export type KeywordVolumeResult = z.infer<typeof keywordVolumeResultSchema>;

/**
 * Keyword clusters structure derived from schema.
 * Note: This corresponds to `ClusteringResult.clusters` part in the old `app/types.ts`.
 */
export type KeywordClusters = z.infer<typeof keywordClustersSchema>;

// --- Keep related old types if not directly inferred --- 
// (Example: If KeywordSuggestion interface was used and is different)
// export interface KeywordSuggestion { text: string; volume: number; }
// ^^^ It seems KeywordSuggestion from app/types.ts is not directly represented 
// by a schema here. Let's keep it commented out for now and see if it's still needed later. 