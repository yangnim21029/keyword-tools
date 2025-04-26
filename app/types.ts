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

// Types for KeywordResultPage component (page.tsx)
// These are only used to build Props, so no need to export individually
type Params = Promise<{ researchId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Export only the combined Props type for the page component
export type NextPageProps = {
  params: Params;
  searchParams?: SearchParams;
};
