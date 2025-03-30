// types/keywordTool.d.ts

// Represents the current stage in the keyword search workflow
export type KeywordSearchStep = "input" | "suggestions" | "volumes" | "clusters";

// Fields available for sorting the volume data table
export type SortField = "text" | "searchVolume" | "competition" | "competitionIndex" | "cpc";

// Sort direction
export type SortDirection = "asc" | "desc";

// Represents the active tab in the results display area
export type ResultTab = "suggestions" | "volume"; // Removed "clusters" as it's shown within "volume" tab

// Source of the cluster data
export type ClusterSource = 'history' | 'new' | null;

// Interface for the sorting state
export interface SortState {
  field: SortField;
  direction: SortDirection;
}

// You might want to define a type for the History Detail object
// based on what `loadKeywordData` actually receives and uses.
// For now, keeping it simple:
export type KeywordHistoryDetail = {
  id?: string; // Optional because new searches won't have it initially
  mainKeyword?: string;
  suggestions?: string[];
  searchResults?: import('@/lib/schemas/keywordTool').KeywordVolumeItem[];
  clusters?: import('@/lib/schemas/keywordTool').KeywordClusters;
  // Add counts for display in history list
  resultCount?: number; // Ensure this is present
  clustersCount?: number; // Ensure this is present
  // Add other relevant fields from history if needed
  region?: string;
  language?: string;
  timestamp?: string | Date;
}; 