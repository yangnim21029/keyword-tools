import { fetchKeywordResearchSummaryAction } from '@/app/actions';
import React from 'react';
import { LANGUAGES, REGIONS } from '@/app/global-config'; // Import constants for display names
import KeywordResearchList from './components/keyword-research-list';
import KeywordSearchForm from './components/keyword-search-form';

// Define the types for the page component props
type KeywordToolPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// Define a simple loading fallback component
const LoadingFallback = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Loading Keyword Tool...</p>
    </div>
  );
};

export default async function KeywordToolPage({ searchParams }: KeywordToolPageProps) {
  // Await searchParams as it's a Promise in Next.js 15
  const resolvedSearchParams = await searchParams;

  // Extract language and region filters from searchParams
  const languageFilter = typeof resolvedSearchParams?.language === 'string' ? resolvedSearchParams.language : undefined;
  const regionFilter = typeof resolvedSearchParams?.region === 'string' ? resolvedSearchParams.region : undefined;

  // Construct the filter object
  const filters = {
    language: languageFilter,
    region: regionFilter,
  };

  // Fetch history data on the server using the new action
  // The returned data is now KeywordResearchSummaryItem[] or null
  const { data: initialResearches, error } = await fetchKeywordResearchSummaryAction(
    undefined, // userId
    filters, // Pass the filters object
    50 // Keep the limit
  );

  // Optional: Handle error state, e.g., display an error message
  if (error) {
    console.error(
      "Failed to fetch initial keyword research data:",
      error
    );
    // You might want to render an error component or message here
  }

  // Slice the results to get the top 50 (assuming they are sorted newest first)
  const limitedResearches = initialResearches ? initialResearches.slice(0, 50) : [];

  // NOTE: The slicing is now redundant if the action respects the limit and filters,
  // but we keep it for safety unless the action/DB guarantees the limit.
  // We should ideally rely on the action's limit.

  // --- Determine dynamic list title --- 
  let listTitle = '研究記錄'; // Default title
  const regionName = regionFilter ? Object.keys(REGIONS).find(key => REGIONS[key] === regionFilter) : null;
  const languageName = languageFilter ? LANGUAGES[languageFilter as keyof typeof LANGUAGES] : null;

  if (regionName && languageName) {
    listTitle = `${regionName} (${regionFilter}) - ${languageName} (${languageFilter}) 的研究記錄`;
  } else if (regionName) {
    listTitle = `${regionName} (${regionFilter}) 的研究記錄`;
  } else if (languageName) {
    listTitle = `${languageName} (${languageFilter}) 的研究記錄`;
  }

  return (
    <div className="flex flex-col items-center justify-start pt-10 px-4 space-y-8 min-h-screen">
      <React.Suspense fallback={<LoadingFallback />}>
        <KeywordSearchForm />
      </React.Suspense>

      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3 text-center">{listTitle}</h2>
        <div className="p-1">
          {/* Pass the limited data */}
          <KeywordResearchList
            initialResearches={initialResearches || []} // Pass potentially filtered data
            hideRefreshButton={true}
          />
        </div>
      </div>
    </div>
  );
}
