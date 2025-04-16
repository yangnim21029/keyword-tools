import {
  fetchKeywordResearchDetail,
  fetchKeywordResearchSummaryAction
} from '@/app/actions';
import type { KeywordResearchItem, UserPersona } from '@/lib/schema'; // Keep types
import { convertTimestampToDate } from '@/lib/utils'; // Correct import now
import { notFound } from 'next/navigation';
import React from 'react';
import KeywordResearchDetail from '../components/keyword-research-detail';

// Define the params type as a Promise
type Params = Promise<{ researchId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Define the props type for the page component
type Props = {
  params: Params;
  searchParams?: SearchParams;
};

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

  const researchDetailData = await fetchKeywordResearchDetail(researchId);

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

  // Convert Timestamps to Dates for client-side serialization
  // Use a temporary variable to satisfy TypeScript's non-null assertion
  const fetchedData = researchDetailData;
  const serializableResearchDetail: KeywordResearchItem = {
    ...fetchedData,
    // Use the new utility function and provide a fallback (e.g., current date or epoch)
    createdAt: convertTimestampToDate(fetchedData.createdAt) || new Date(0),
    updatedAt: convertTimestampToDate(fetchedData.updatedAt) || new Date(),
    // Remove relatedKeywords processing as it doesn't exist on the schema
    // relatedKeywords: fetchedData.relatedKeywords?.map(rk => ({ ... })), // REMOVED
    // Remove timestamp conversion from personas as they don't have timestamps in the schema
    personas: Array.isArray(fetchedData.personas) // Explicitly check if it's an array
      ? fetchedData.personas.map((p: UserPersona) => ({
          ...p // Keep the persona data as is
        }))
      : [], // Default to empty array if not an array or null/undefined
    // Keep other properties as is (keywords, clusters, etc.)
    keywords: fetchedData.keywords || [], // Ensure keywords is always an array
    clusters: fetchedData.clusters || undefined // Keep clusters as is or undefined
  };

  return (
    <>
      <h1 className="text-2xl font-semibold mb-4 sm:mb-6 text-left">
        {serializableResearchDetail.query}
      </h1>

      <React.Suspense fallback={<DetailLoadingFallback />}>
        {/* Pass the processed data to the loader/client component */}
        <KeywordResearchDetailLoader
          researchDetail={serializableResearchDetail} // Pass the correctly typed and processed data
        />
      </React.Suspense>
    </>
  );
}

// Loader component now directly receives the processed serializable data
async function KeywordResearchDetailLoader({
  researchDetail
}: {
  researchDetail: KeywordResearchItem;
}) {
  // No further conversion needed here as it's done in the parent
  return (
    <KeywordResearchDetail
      initialResearchDetail={researchDetail} // Pass data directly
      researchId={researchDetail.id}
    />
  );
}
