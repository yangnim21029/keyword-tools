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

// SERP 分析相關的類型定義
export interface SerpResult {
  title: string;
  url: string;
  displayUrl: string;
  position: number;
  description: string;
  siteLinks: any[];
}

export interface SerpAnalysis {
  totalResults: number;
  domains: Record<string, number>;
  topDomains: string[];
  avgTitleLength: number;
  avgDescriptionLength: number;
}

export interface SerpKeywordResult {
  results: SerpResult[];
  analysis: SerpAnalysis;
  timestamp: string;
}

export interface SerpAnalysisResult {
  results: Record<string, SerpKeywordResult>;
  fromCache: boolean;
} 