export interface KeywordFormData {
  query: string;
  region: string;
  language: string;
}

export interface UrlFormData {
  url: string;
  region: string;
  language: string;
}

export interface KeywordSuggestion {
  text: string;
  volume: number;
}

export interface ClusteringResult {
  clusters: Record<string, string[]>;
  processingTime?: {
    estimated: number;
    actual: number;
  };
}

// 新增类型定义
export interface SuggestionsResult {
  suggestions: string[];
  estimatedProcessingTime: number;
  fromCache?: boolean;
  error?: string;
}

export interface SearchVolumeResult {
  results: KeywordVolumeResult[];
  processingTime: {
    estimated: number;
    actual: number;
  };
  fromCache?: boolean;
  historyId?: string | null;
}

export interface KeywordVolumeResult {
  text: string;
  searchVolume: number;
  competition: string;
  competitionIndex: number;
  cpc: number | null;
} 