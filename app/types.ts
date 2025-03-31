import type { SearchHistoryItem } from '@/lib/schemas'; // Update path

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
  error?: string;
  sourceInfo?: string;
}

export interface SearchVolumeResult {
  results: KeywordVolumeResult[];
  processingTime: {
    estimated: number;
    actual: number;
  };
  historyId?: string | null;
  sourceInfo?: string;
  error?: string;
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
  sourceInfo?: string;
  error?: string;
}

// --- 搜索歷史相關類型 ---

// 移除假設的 SearchHistoryItem 接口
/*
export interface SearchHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: any; // 建議使用 Date 或 Firestore Timestamp 類型
  // ... 可能還有 suggestions, searchResults, clusters 等字段
}
*/

// fetchSearchHistory 的返回類型
export interface SearchHistoryListResult {
  data: SearchHistoryItem[]; // 使用從 schema 導入的類型
  sourceInfo?: string;
  error?: string;
}

// fetchSearchHistoryDetail 的返回類型
export interface SearchHistoryDetailResult {
  data: SearchHistoryItem | null; // 使用從 schema 導入的類型
  sourceInfo?: string;
  error?: string;
} 