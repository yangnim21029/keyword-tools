import { SerpDisplayClient } from '@/app/serp/serp-display-client'; // Reuse the client component
import {
  getSerpAnalysisById, // Use the new function
  type SerpAnalysisData
} from '@/app/services/firebase'; // Import Firebase service
import { notFound } from 'next/navigation';
import { Suspense } from 'react';

// Define props for the dynamic route page, including searchParams
type SerpResultPageProps = {
  params: Promise<{
    serpId?: string; // This serpId is now the SANITIZED ID
  }>;
  // searchParams is also a Promise in Next.js 15+
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

// --- Reusable Loading and Error Components (from previous page) ---
function LoadingSpinner() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
      <p className="ml-4 text-lg">正在載入分析結果...</p>
    </div>
  );
}

function ErrorDisplay({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center text-center text-red-600">
      <div>
        <h2 className="text-xl font-semibold mb-2">發生錯誤</h2>
        <p>{message}</p>
      </div>
    </div>
  );
}
// --- End Reusable Components ---

// Server Component to fetch and display the specific analysis
async function SerpResultContent({
  serpId // This is now the Firestore auto-ID
}: {
  serpId: string;
}) {
  let analysisData: SerpAnalysisData | null = null;
  let error: string | null = null;

  console.log(`[SERP Result Page] Processing document ID: ${serpId}`);

  try {
    // Fetch directly by Firestore document ID
    analysisData = await getSerpAnalysisById(serpId);

    // If data is not found for a valid ID navigation, something is wrong
    if (!analysisData) {
      console.error(
        `[SERP Result Page] Data not found for valid ID: ${serpId}. This should not happen.`
      );
      // Render error or use notFound()
      return <ErrorDisplay message={`無法找到 ID 為 ${serpId} 的分析數據。`} />;
    }

    console.log(`[SERP Result Page] Found data in Firestore for ID ${serpId}.`);
  } catch (err) {
    console.error(
      `[SERP Result Page] Error processing analysis data for ID ${serpId}:`,
      err
    );
    error = err instanceof Error ? err.message : '處理分析數據時發生未知錯誤';
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  // This check should theoretically be redundant now if the above check handles null
  if (!analysisData) {
    console.error(
      `[SERP Result Page] Analysis data is unexpectedly null for ID ${serpId}.`
    );
    return <ErrorDisplay message={`無法加載 ID ${serpId} 的分析數據。`} />;
  }

  // --- Prepare data for Client Component ---
  // Ensure the object matches the ClientSerpAnalysisData type
  // The 'id' field is already part of SerpAnalysisData from the converter
  const serializableAnalysisData = {
    ...analysisData, // Spread the data which includes the id
    timestamp: analysisData.timestamp.toDate(), // Convert Timestamp

    // Ensure all fields required by ClientSerpAnalysisData exist, providing defaults
    // Map top-level fields (provide defaults if needed based on ClientSerpAnalysisData)
    searchQuery: analysisData.searchQuery ?? null,
    resultsTotal: analysisData.resultsTotal ?? null,
    relatedQueries: analysisData.relatedQueries ?? [],
    aiOverview: analysisData.aiOverview ?? null,
    paidResults: analysisData.paidResults ?? [],
    paidProducts: analysisData.paidProducts ?? [],
    peopleAlsoAsk: analysisData.peopleAlsoAsk ?? [],

    // Ensure organicResults is always an array AND map description: undefined -> null
    organicResults: (analysisData.organicResults ?? []).map(result => ({
      ...result,
      description: result.description ?? null, // Ensure description is string | null
      displayedUrl: result.displayedUrl ?? null,
      emphasizedKeywords: result.emphasizedKeywords ?? []
    })),

    // Ensure analysis fields exist (defaults to null)
    contentTypeAnalysis: analysisData.contentTypeAnalysis ?? null,
    userIntentAnalysis: analysisData.userIntentAnalysis ?? null,
    titleAnalysis: analysisData.titleAnalysis ?? null,
    contentTypeAnalysisText: analysisData.contentTypeAnalysisText ?? null,
    userIntentAnalysisText: analysisData.userIntentAnalysisText ?? null,

    // Initialize JSON fields required by client component if not already present
    contentTypeAnalysisJson: null, // These are typically generated on client-side
    userIntentAnalysisJson: null // These are typically generated on client-side
  };
  // --- End Data Preparation ---

  console.log(
    `[SERP Result Page] Rendering analysis data for ID ${serpId} (Keyword: ${analysisData.originalKeyword}).`
  );
  // Pass the prepared data, including the id, to the client
  // The structure should now match ClientSerpAnalysisData
  return <SerpDisplayClient initialAnalysisData={serializableAnalysisData} />;
}

// The main Page component - async
export default async function SerpResultPage({ params }: SerpResultPageProps) {
  const resolvedParams = await params;
  const serpId = resolvedParams.serpId; // This is the auto-ID

  // No need to decode anymore
  if (!serpId) {
    console.log('[SERP Result Page] Missing serpId in params.');
    notFound();
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {/* Pass the auto-ID directly */}
      <SerpResultContent serpId={serpId} />
    </Suspense>
  );
}
