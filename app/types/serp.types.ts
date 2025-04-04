import {
  type CreateSerpInput,
  type HtmlAnalysisResult,
  type Serp,
  type SerpAnalysisMetrics,
  type SerpResultItem,
  type TriggerSerpAnalysisInput,
  type UpdateSerpInput,
} from '@/lib/schemas/serp.schema';

// Re-export the core types inferred from the new schemas
export type {
  CreateSerpInput, HtmlAnalysisResult, Serp, SerpAnalysisMetrics, SerpResultItem, TriggerSerpAnalysisInput, UpdateSerpInput
};

/**
 * Data structure for displaying SERP analysis in the UI (Optional).
 * This can be adapted based on UI requirements, potentially using the Serp type directly
 * or creating a simplified version.
 */
export interface SerpDisplayData extends Partial<Serp> { // Example: Extend partial Serp type
  // Add any UI-specific fields if needed
  isLoading?: boolean;
  error?: string;
}

// --- Potentially useful utility types (Example) ---

/**
 * Type representing a single domain and its count from the analysis.
 */
export type DomainCount = { domain: string; count: number };

/**
 * Type representing a single result type and its count.
 */
export type ResultTypeCount = { type: string; count: number }; 