import { fetchKeywordResearchList } from '@/app/actions';
import React from 'react';
import KeywordResearchList from '../../history/components/KeywordResearchList';
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
  // Fetch history data on the server
  const { data: initialResearches } = await fetchKeywordResearchList();

  return (
    <div className="flex flex-col items-center justify-start pt-10 px-4 space-y-8 min-h-screen">
      <React.Suspense fallback={<LoadingFallback />}>
        <KeywordSearchForm maxKeywords={16} minSearchVolume={100} />
      </React.Suspense>

      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3 text-center">最近的搜索</h2>
        <div className="bg-card border rounded-lg p-2">
          <KeywordResearchList
            initialResearches={initialResearches}
            hideRefreshButton={true}
          />
        </div>
      </div>
    </div>
  );
}
