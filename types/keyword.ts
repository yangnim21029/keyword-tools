export interface RelatedKeyword {
  keyword: string;
  searchVolume: number;
  competition: string;
  trend: string;
}

export interface Competitor {
  domain: string;
  rank: number;
  authority: number;
  backlinks: number;
}

export interface Suggestion {
  title: string;
  description: string;
}

export interface KeywordResearchDetail {
  keyword: string;
  createdAt: string;
  searchVolume: number;
  competition: string;
  trend: string;
  globalSearchVolume: number;
  relatedKeywords: RelatedKeyword[];
  competitors: Competitor[];
  suggestions: Suggestion[];
} 