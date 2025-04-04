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
export type ClusterSource = "research" | "new" | null;

// Interface for the sorting state
export interface SortState {
  field: SortField;
  direction: SortDirection;
}

// // Removed redundant KeywordHistoryDetail type
// export type KeywordHistoryDetail = {
//   id?: string;
//   mainKeyword?: string;
//   suggestions?: string[];
//   searchResults?: import("@/lib/schemas/keyword.schema").KeywordVolumeItem[];
//   clusters?: import("@/lib/schemas/keyword.schema").KeywordClusters;
//   resultCount?: number;
//   clustersCount?: number;
//   region?: string;
//   language?: string;
//   timestamp?: string | Date;
// } 