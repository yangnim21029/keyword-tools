"use server"

import { unstable_cache } from 'next/cache';
import React from 'react';
import { LANGUAGES, REGIONS } from '@/app/global-config'; // Import constants for display names
import KeywordResearchList from './components/keyword-research-list';
import KeywordSearchForm from './components/keyword-search-form';
import { getKeywordResearchSummaryList, getTotalKeywordResearchCount } from '../services/firebase';

// Define the types for the page component props
type KeywordToolPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};


const getKeywordResearchSummaryListCached = unstable_cache(async ({limit, region}: {limit: number, region: string | undefined}) => getKeywordResearchSummaryList(limit, region), ['keyword-research-summary-list'], { revalidate: 3600 });


export default async function KeywordToolPage({ searchParams }: KeywordToolPageProps) {
  // Await searchParams as it's a Promise in Next.js 15
  const resolvedSearchParams = await searchParams;

  // Extract only region filter
  const regionFilter = typeof resolvedSearchParams?.region === 'string' ? resolvedSearchParams.region : undefined;
  // Fetch history data on the server using the new action
  const data = await getKeywordResearchSummaryListCached({limit: 50, region: regionFilter});

  // --- Fetch Total Count ---
  const totalCount = await getTotalKeywordResearchCount();

  // --- Determine dynamic list title for potential future use or debugging ---
  // Code related to listTitle is removed

  return (
    // Main container to center content, remove grid
    <div className="container mx-auto px-4 py-10 min-h-screen">
      {/* Flex container for side-by-side layout on md+ */}
      <div className="flex flex-col md:flex-row md:gap-x-12 lg:gap-x-16 items-center">

        {/* Left Side: Form Area - Remove sticky positioning */}
        <div className="flex flex-col items-center w-full md:flex-1">
          {/* Page Headings - Centered */}
          <div className="text-center mb-6 w-full max-w-xl">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-gray-200">
              你正在查詢？
            </h1>
            <p className="text-md text-muted-foreground mt-2">
              已有 <strong className="text-primary">{totalCount.toLocaleString()}</strong> 次關鍵字研究完成！
              更多的人正在為他們的文章，找到合適的關鍵字！
            </p>
          </div>
          {/* Form Component Wrapper - Centered */}
          <div className="w-full max-w-xl">
              <KeywordSearchForm />
          </div>
        </div>

        {/* Right Side: List Area (fixed or max width) */}
        <div className="w-full md:w-[350px] lg:w-[400px] mt-10 md:mt-0 flex-shrink-0"> {/* Adjust width as needed */}
          <h2 className="text-xl font-semibold mb-4 text-left">研究記錄</h2>
          <KeywordResearchList
            initialResearches={data.length > 0 ? data : []}
            hideRefreshButton={true}
          />
        </div>

      </div>
    </div>
  );
}
