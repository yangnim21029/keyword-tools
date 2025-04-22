import {
  fetchKeywordResearchDetail,
  fetchKeywordResearchSummaryAction
} from '@/app/actions';
import { MEDIASITE_DATA } from '@/app/global-config'; // Import site data
// Import types from the centralized types file
import type { Props } from '@/app/services/firebase/types'; 
// Import the client data type for the loader component
import type { KeywordResearchClientData } from '@/app/services/firebase/schema-client';
import { formatVolume } from '@/lib/utils'; // Import volume formatter
// Import icons needed for metadata
import { Sigma, Globe, Languages, Clock, Tag } from 'lucide-react'; 
import { Badge } from "@/components/ui/badge"; // Import Badge for tags
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

  // --- Calculate Total Volume --- 
  const totalVolume = (researchDetailData.keywords || []).reduce(
    (sum, kw) => sum + (kw.searchVolume ?? 0),
    0
  );

  // --- Find Matching Media Sites (Case-insensitive Region) --- 
  const matchingSites = researchDetailData.region
    ? MEDIASITE_DATA.filter(
        site => site.region?.toLowerCase() === researchDetailData.region?.toLowerCase()
      )
    : [];

  // --- Helper to format date/time (moved from detail component) ---
  const formatDateTime = (date: any): string => {
    if (!date) return 'N/A';
    try {
      // Handle Firestore Timestamp object or Date object
      const dateObj = date instanceof Date ? date : date.toDate(); 
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return dateObj.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
    } catch (error) {
      return 'Invalid Date Format';
    }
  };

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
      {/* --- Page Header --- */}
      <div className="flex flex-row items-center gap-4 mb-4 sm:mb-6">
        <h1 className="text-2xl font-semibold text-left">
          {researchDetailData.query}
        </h1>
        <div className="flex items-center gap-4 flex-shrink-0">
          {/* Total Volume Display */} 
          <div className="flex items-center text-lg font-medium text-foreground/90 bg-muted/60 px-3 py-1 rounded-md">
            <Sigma size={16} className="mr-1.5 flex-shrink-0 text-muted-foreground" />
            {formatVolume(totalVolume)}
          </div>
          {/* Applicable Media Site Icons */} 
          {matchingSites.length > 0 && (
            <div className="flex items-center gap-1.5 p-1 rounded-md bg-muted/60">
              {matchingSites.map(site => (
                <img
                  key={site.name}
                  src={`https://www.google.com/s2/favicons?sz=16&domain_url=${site.url}`}
                  alt={`${site.name} icon`}
                  title={site.title} // Show full title on hover
                  width={16}
                  height={16}
                  className="rounded-sm"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- Metadata Row --- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground mb-6 border-b pb-4">
        <div className="flex items-center">
          <Globe className="mr-1.5 h-4 w-4 flex-shrink-0" />
          地區: {researchDetailData.region || '未指定'}
        </div>
        <div className="flex items-center">
          <Languages className="mr-1.5 h-4 w-4 flex-shrink-0" />
          語言: {researchDetailData.language || '未指定'}
        </div>
        <div className="flex items-center">
          <Clock className="mr-1.5 h-4 w-4 flex-shrink-0" />
          最後更新: {formatDateTime(researchDetailData.updatedAt)}
        </div>
        {researchDetailData.tags && researchDetailData.tags.length > 0 && (
          <div className="flex items-center gap-1">
            <Tag className="mr-1 h-4 w-4 flex-shrink-0" />
            {researchDetailData.tags.map((tag: string) => ( 
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

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
