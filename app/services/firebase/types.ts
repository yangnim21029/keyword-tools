// Type definitions extracted from schema.ts
import * as z from 'zod';
import * as schema from './schema'; // Import schemas for z.infer

export type KeywordVolumeItem = z.infer<typeof schema.keywordVolumeItemSchema>;
export type UserPersona = z.infer<typeof schema.UserPersonaSchema>;
export type Cluster = z.infer<typeof schema.ClusterSchema>;
export type ClusterItem = z.infer<typeof schema.ClusterItemSchema>;
export type KeywordResearchBase = z.infer<typeof schema.KeywordResearchBaseSchema>;
export type KeywordResearchItem = z.infer<typeof schema.keywordResearchItemSchema>;
export type KeywordResearchFilter = z.infer<typeof schema.keywordResearchFilterSchema>;
export type KeywordResearchStats = z.infer<typeof schema.keywordResearchStatsSchema>;
export type CreateKeywordResearchInput = z.infer<
  typeof schema.CreateKeywordResearchSchema
>;
export type UpdateKeywordResearchInput = z.infer<
  typeof schema.UpdateKeywordResearchSchema
>;
export type UpdateClustersInput = z.infer<typeof schema.UpdateClustersSchema>;
export type UpdateClustersWithVolumeInput = z.infer<typeof schema.UpdateClustersWithVolumeSchema>;

export type UserPersonaResponse = z.infer<typeof schema.UserPersonaResponseSchema>;
export type KeywordResearchUserPersona = z.infer<
  typeof schema.KeywordResearchUserPersonaSchema
>;
export type KeywordFormData = z.infer<typeof schema.keywordFormSchema>;
export type KeywordSuggestionResult = z.infer<
  typeof schema.keywordSuggestionResultSchema
>;
export type KeywordVolumeResult = z.infer<typeof schema.keywordVolumeResultSchema>;
export type KeywordClusters = z.infer<typeof schema.keywordClustersSchema>;
export type ApifyOrganicResult = z.infer<typeof schema.apifyOrganicResultSchema>;
export type EnhancedOrganicResult = z.infer<typeof schema.enhancedOrganicResultSchema>;
export type SerpAnalysis = z.infer<typeof schema.serpAnalysisSchema>;
export type ProcessedSerpResult = z.infer<typeof schema.processedSerpResultSchema>;
export type VolumeDistributionDataItem = z.infer<
  typeof schema.volumeDistributionDataItemSchema
>;
export type VolumeDistributionData = z.infer<
  typeof schema.volumeDistributionDataSchema
>;

// Types for KeywordResultPage component (page.tsx)
// These are only used to build Props, so no need to export individually
type Params = Promise<{ researchId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Export only the combined Props type for the page component
export type Props = {
  params: Params;
  searchParams?: SearchParams;
};