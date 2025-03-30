// 定義 SearchHistory 類型接口
export interface SearchHistory {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: Date;
  suggestionCount: number;
  resultsCount: number;
  suggestionsPreview?: string[];
  clustersCount?: number;
  clusters?: Record<string, string[]>;
}

// 定義聚類結果接口
export interface ClusteringResult {
  clusters: Record<string, string[]>;
  metadata?: {
    timestamp: Date;
    algorithm?: string;
    parameters?: Record<string, any>;
  };
} 