export interface KeywordFormData {
  query: string;
  region: string;
  language: string;
  useAlphabet?: boolean;
  useSymbols?: boolean;
}

export interface UrlFormData {
  url: string;
  region: string;
  language: string;
}

export interface KeywordSuggestion {
  text: string;
  searchVolume?: number;
  competition?: string;
  competitionIndex?: number;
  cpc?: number;
}

export interface RegionOption {
  name: string;
  code: string;
}

export interface LanguageOption {
  name: string;
  code: string;
}

export interface ClusteringResult {
  clusters: {
    [key: string]: string[];
  };
  processingTime?: {
    estimated: number;
    actual: number;
  };
  useStreamingApi?: boolean;
  limitedKeywords?: string[];
} 