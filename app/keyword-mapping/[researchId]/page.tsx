import {
  fetchKeywordResearchDetail,
  fetchKeywordResearchSummaryAction
} from '@/app/actions';
// Import types from the centralized types file
import type { Props } from '@/app/services/firebase/types'; 
// Import the client data type for the loader component
import type { KeywordResearchClientData } from '@/app/services/firebase/schema-client';
// import { convertTimestampToDate } from '@/lib/utils'; // No longer needed here
import { notFound } from 'next/navigation';
import React from 'react';
import KeywordResearchDetail from '../components/keyword-research-detail';


// Function to generate static paths at build time
export async function generateStaticParams() {
  const { data: researches, error } = await fetchKeywordResearchSummaryAction(
    undefined,
    undefined,
    1000
  );

  if (error || !researches) {
    console.error('Failed to fetch researches for static params:', error);
    return [];
  }

  return researches.map(research => ({
    researchId: research.id
  }));
}

export default async function KeywordResultPage({ params }: Props) {
  const { researchId } = await params;

  // Fetch the *already processed* data from the server action
  const researchDetailData = await fetchKeywordResearchDetail(researchId);

  // Handle not found case
  if (!researchDetailData) {
    notFound();
  }

  // Define a simple loading fallback component
  const DetailLoadingFallback = () => {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">正在加載研究詳情...</p>
      </div>
    );
  };

  return (
    <>
      {/* Use the query directly from the processed data */}
      <h1 className="text-2xl font-semibold mb-4 sm:mb-6 text-left">
        {researchDetailData.query} 
      </h1>

      <React.Suspense fallback={<DetailLoadingFallback />}>
        {/* Pass the processed data directly to the loader */}
        <KeywordResearchDetailLoader
          researchDetail={researchDetailData} // Pass data using the prop name expected by the loader
        />
      </React.Suspense>
    </>
  );
}

// Loader component now expects KeywordResearchClientData
async function KeywordResearchDetailLoader({ 
  researchDetail // Keep this name as it matches the data fetched above
}: { 
  researchDetail: KeywordResearchClientData; // <-- Use specific type
}) {
  // No further conversion needed here
  return (
    // Pass data as a single prop named 'keywordResearchObject' to the client component
    <KeywordResearchDetail
      keywordResearchObject={researchDetail} // <-- Pass as single prop with correct name
    />
  );
}
