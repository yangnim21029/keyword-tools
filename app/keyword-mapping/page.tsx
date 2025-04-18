import { fetchKeywordResearchSummaryAction } from '@/app/actions';
import React from 'react';
import KeywordResearchList from './components/keyword-research-list';
import KeywordSearchForm from './components/keyword-search-form';

// Define a simple loading fallback component
const LoadingFallback = () => {
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">Loading Keyword Tool...</p>
    </div>
  );
};

export default async function KeywordToolPage() {
  // Fetch history data on the server using the new action
  // The returned data is now KeywordResearchSummaryItem[] or null
  const { data: initialResearches, error } =
    await fetchKeywordResearchSummaryAction();

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

  return (
    <div className="flex flex-col items-center justify-start pt-10 px-4 space-y-8 min-h-screen">
      <React.Suspense fallback={<LoadingFallback />}>
        <KeywordSearchForm maxKeywords={16} minSearchVolume={100} />
      </React.Suspense>

      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3 text-center">最近的搜索</h2>
        <div className="bg-card border rounded-lg p-2">
          {/* Pass the limited data */}
          <KeywordResearchList
            initialResearches={limitedResearches} // Use the sliced array
            hideRefreshButton={true}
          />
        </div>
      </div>
    </div>
  );
}
