"use server"

import { unstable_cache } from 'next/cache';
import React from 'react';
import { LANGUAGES, REGIONS } from '@/app/global-config'; // Import constants for display names
import KeywordResearchList from './components/keyword-research-list';
import KeywordSearchForm from './components/keyword-search-form';
import { getKeywordResearchSummaryList } from '../services/firebase';

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

const getKeywordResearchSummaryListCached = unstable_cache(async ({limit, region}: {limit: number, region: string | undefined}) => getKeywordResearchSummaryList(limit, region), ['keyword-research-summary-list'], { revalidate: 3600 });


export default async function KeywordToolPage({ searchParams }: KeywordToolPageProps) {
  // Await searchParams as it's a Promise in Next.js 15
  const resolvedSearchParams = await searchParams;

  // Extract only region filter
  const regionFilter = typeof resolvedSearchParams?.region === 'string' ? resolvedSearchParams.region : undefined;
  // Fetch history data on the server using the new action
  // The returned data is now KeywordResearchSummaryItem[] or null
  const data = await getKeywordResearchSummaryListCached({limit: 50, region: regionFilter});


  // --- Determine dynamic list title ---
  let listTitle = '研究記錄'; // Default title
  const regionName = regionFilter ? Object.keys(REGIONS).find(key => REGIONS[key] === regionFilter) : null;

  if (regionName) {
    listTitle = `${regionName} (${regionFilter}) 的研究記錄`;
  }

  return (
    <div className="flex flex-col items-center justify-start pt-10 px-4 space-y-8 min-h-screen">
        <KeywordSearchForm />

      <div className="w-full max-w-md">
        <h2 className="text-lg font-semibold mb-3 text-center">{listTitle}</h2>
        <div className="p-1">
          {/* Pass the limited data */}
          <KeywordResearchList
            initialResearches={data.length > 0 ? data : []} // Pass potentially filtered data
            hideRefreshButton={true}
          />
        </div>
      </div>
    </div>
  );
}
