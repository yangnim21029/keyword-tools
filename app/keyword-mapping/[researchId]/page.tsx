import {
  fetchKeywordResearchDetail,
  fetchKeywordResearchSummaryAction
} from '@/app/actions';
import type { KeywordResearchItem, UserPersona, KeywordVolumeItem } from '@/lib/schema'; // Keep types
import { convertTimestampToDate } from '@/lib/utils'; // Correct import now
import { notFound } from 'next/navigation';
import React from 'react';
import KeywordResearchDetail from '../components/keyword-research-detail';

// Define the structure of a single cluster item as expected by the component
type ClusterItem = {
  clusterName: string;
  keywords: KeywordVolumeItem[];
  totalVolume?: number;
};

// Define the type for the research detail *after* processing/transformation in the action
// This type reflects the structure actually passed to the client/loader component
type ProcessedKeywordResearchDetail = Omit<KeywordResearchItem, 'clusters' | 'personas'> & {
  clusters: ClusterItem[] | null; // Use the correct cluster type
  personas?: UserPersona[]; // Match the structure after providing defaults
  clusteringStatus?: string;
};

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
  const serializableResearchDetail: ProcessedKeywordResearchDetail = {
    ...fetchedData,
    // Use the new utility function and provide a fallback (e.g., current date or epoch)
    createdAt: convertTimestampToDate(fetchedData.createdAt) || new Date(0),
    updatedAt: convertTimestampToDate(fetchedData.updatedAt) || new Date(),
    // Process personas: Ensure each mapped object conforms to the full UserPersona type
    personas: Array.isArray(fetchedData.personas)
      ? fetchedData.personas.map((p: Partial<UserPersona>): UserPersona => ({ // Ensure return type is UserPersona
          // Provide defaults for all required fields in UserPersonaSchema
          name: p.name || '未命名畫像', // Default name
          description: p.description || '無描述', // Default description
          keywords: p.keywords || [], // Default empty array
          characteristics: p.characteristics || [], // Default empty array
          interests: p.interests || [], // Default empty array
          painPoints: p.painPoints || [], // Default empty array
          goals: p.goals || [] // Default empty array
        }))
      : [], // Default to empty array if not an array or null/undefined
    // Keep other properties as is (keywords, etc.)
    keywords: fetchedData.keywords || [], // Ensure keywords is always an array
    // Ensure clusters from fetchedData matches ProcessedKeywordResearchDetail
    // No explicit assignment needed if ...fetchedData includes the correct `clusters: ClusterItem[] | null`
    clusters: fetchedData.clusters // Keep the correctly typed clusters from the action
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
  researchDetail: ProcessedKeywordResearchDetail;
}) {
  // No further conversion needed here as it's done in the parent
  return (
    <KeywordResearchDetail
      initialResearchDetail={researchDetail} // Pass data directly
      researchId={researchDetail.id}
    />
  );
}
