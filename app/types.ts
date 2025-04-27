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

// Type definitions extracted from schema.ts

type Params = Promise<{ [key: string]: string | undefined }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Export only the combined Props type for the page component
export type NextPageProps = {
  params: Params;
  searchParams?: SearchParams;
};
