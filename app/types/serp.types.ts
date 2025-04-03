import {
  apifyOrganicResultSchema,
  apifyResultItemSchema,
  enhancedOrganicResultSchema,
  firebaseSerpDocumentSchema,
  firebaseSerpResultsMapSchema,
  htmlAnalysisResultSchema,
  processedSerpResultSchema,
  serpAnalysisSchema,
  serpApiInputSchema,
} from '@/lib/schemas/serp.schema';
import { z } from 'zod';

/**
 * SERP API Input parameters derived from schema.
 */
export type SerpApiInput = z.infer<typeof serpApiInputSchema>;

/**
 * Organic result structure from Apify SERP API, derived from schema.
 * Note: Corresponds to `SerpResult` in old `app/types.ts` (structure might differ slightly).
 */
export type ApifyOrganicResult = z.infer<typeof apifyOrganicResultSchema>;

/**
 * Result of HTML analysis for a SERP item, derived from schema.
 */
export type HtmlAnalysisResult = z.infer<typeof htmlAnalysisResultSchema>;

/**
 * Organic result enhanced with HTML analysis, derived from schema.
 */
export type EnhancedOrganicResult = z.infer<typeof enhancedOrganicResultSchema>;

/**
 * Single item structure returned by Apify API (containing organic results, etc.), derived from schema.
 */
export type ApifyResultItem = z.infer<typeof apifyResultItemSchema>;

/**
 * SERP analysis metrics (domain counts, lengths), derived from schema.
 * Note: Corresponds to `SerpAnalysis` in old `app/types.ts`.
 */
export type SerpAnalysis = z.infer<typeof serpAnalysisSchema>;

/**
 * Processed result for a single keyword's SERP, derived from schema.
 * Note: Corresponds to `SerpKeywordResult` in old `app/types.ts`.
 */
export type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;

/**
 * Structure for storing multiple SERP results keyed by keyword in Firebase, derived from schema.
 * Note: Corresponds to the `results` part of `SerpAnalysisResult` in old `app/types.ts`.
 */
export type FirebaseSerpResultsMap = z.infer<typeof firebaseSerpResultsMapSchema>;

/**
 * Document structure for storing SERP results in Firebase, derived from schema.
 */
export type FirebaseSerpDocument = z.infer<typeof firebaseSerpDocumentSchema>;

// --- Potentially missing/different types from old app/types.ts ---
// export interface SerpAnalysisResult {
//   results: Record<string, SerpKeywordResult>; // Now FirebaseSerpResultsMap
//   sourceInfo?: string;
//   error?: string;
// }
// ^^^ SerpAnalysisResult seems covered by FirebaseSerpDocument/Map + optional fields 