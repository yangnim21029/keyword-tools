import { SerpDisplayClient } from '@/app/serp/serp-display-client'; // Reuse the client component
import {
  getSerpAnalysisBySanitizedId,
  saveSerpAnalysis,
  type SerpAnalysisData
} from '@/app/services/firebase'; // Import Firebase service
import { fetchKeywordData } from '@/app/services/serp.service'; // Need fetchKeywordData
import { Timestamp } from 'firebase-admin/firestore'; // Need Timestamp for constructing data
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
  serpId,
  searchParams // Receive the resolved searchParams object
}: {
  serpId: string;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let analysisData: SerpAnalysisData | null = null;
  let error: string | null = null;
  const sanitizedId = serpId;

  console.log(`[SERP Result Page] Processing sanitized ID: ${sanitizedId}`);

  try {
    analysisData = await getSerpAnalysisBySanitizedId(sanitizedId);

    if (!analysisData) {
      console.log(
        `[SERP Result Page] Data not found for ID ${sanitizedId}. Fetching from API...`
      );

      // Get original keyword, region, and language from searchParams
      const originalKeywordParam = searchParams?.q;
      const regionParam = searchParams?.region;
      const langParam = searchParams?.lang;

      const originalKeyword = decodeURIComponent(
        Array.isArray(originalKeywordParam)
          ? originalKeywordParam[0] ?? ''
          : originalKeywordParam ?? ''
      );
      // Use provided region/lang or fall back to defaults if necessary
      const region = Array.isArray(regionParam) ? regionParam[0] : regionParam;
      const language = Array.isArray(langParam) ? langParam[0] : langParam;

      if (!originalKeyword) {
        console.error(
          `[SERP Result Page] Original keyword missing in searchParams (q) for ID ${sanitizedId}.`
        );
        return (
          <ErrorDisplay message={`無法獲取 ID ${sanitizedId} 的原始關鍵字。`} />
        );
      }

      console.log(
        `[SERP Result Page] Fetching API for: kw=${originalKeyword}, region=${
          region || 'default'
        }, lang=${language || 'default'}`
      );

      // Fetch fresh data using original keyword AND region/language if available
      // NOTE: Need to update fetchKeywordData to accept region/language
      const freshSerpData = await fetchKeywordData(
        originalKeyword,
        region,
        language
      ); // Pass region and language
      console.log(
        `[SERP Result Page] Fetched ${freshSerpData.length} results from API for ${originalKeyword}.`
      );

      const dataToSave: Partial<
        Omit<SerpAnalysisData, 'id' | 'timestamp' | 'keyword'>
      > = {
        serpResults: freshSerpData,
        contentTypeAnalysis: null,
        userIntentAnalysis: null,
        titleAnalysis: null
      };

      // Save using ORIGINAL keyword
      void saveSerpAnalysis(originalKeyword, dataToSave).catch(saveError => {
        console.error(
          `[SERP Result Page] Error saving initial SERP data for ${originalKeyword} (ID: ${sanitizedId}):`,
          saveError
        );
      });

      analysisData = {
        id: sanitizedId,
        keyword: originalKeyword,
        timestamp: new Timestamp(Math.floor(Date.now() / 1000), 0),
        serpResults: freshSerpData,
        contentTypeAnalysis: null,
        userIntentAnalysis: null,
        titleAnalysis: null
      };
      console.log(
        `[SERP Result Page] Constructed initial data for ID ${sanitizedId}.`
      );
    } else {
      console.log(
        `[SERP Result Page] Found data in Firestore for ID ${sanitizedId}.`
      );
    }
  } catch (err) {
    console.error(
      `[SERP Result Page] Error processing analysis data for ID ${sanitizedId}:`,
      err
    );
    error = err instanceof Error ? err.message : '處理分析數據時發生未知錯誤';
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  // Should have analysisData here unless original keyword was missing
  if (!analysisData) {
    // This case should ideally be handled by the original keyword check now
    console.error(
      `[SERP Result Page] Analysis data is unexpectedly null for ID ${sanitizedId}.`
    );
    return <ErrorDisplay message={`無法加載 ID ${sanitizedId} 的分析數據。`} />;
  }

  // --- Convert Firestore Timestamp to standard Date ---
  // Also ensure the object matches the ClientSerpAnalysisData type
  const serializableAnalysisData = {
    ...analysisData,
    timestamp: analysisData.timestamp.toDate(), // Convert to JS Date object
    contentTypeAnalysisJson: null,
    userIntentAnalysisJson: null,
    contentTypeAnalysisText: analysisData.contentTypeAnalysisText ?? null,
    userIntentAnalysisText: analysisData.userIntentAnalysisText ?? null,
    // Ensure titleAnalysis exists, defaulting to null if undefined/null in analysisData
    titleAnalysis: analysisData.titleAnalysis ?? null
  };
  // --- End Conversion and Type Alignment ---

  console.log(
    `[SERP Result Page] Rendering analysis data for ID ${sanitizedId} (Keyword: ${analysisData.keyword}).`
  );
  return <SerpDisplayClient initialAnalysisData={serializableAnalysisData} />;
}

// The main Page component - async
export default async function SerpResultPage({
  params,
  searchParams
}: SerpResultPageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams; // Await searchParams as well
  const serpId = resolvedParams.serpId;

  if (!serpId) {
    console.log('[SERP Result Page] Missing serpId in params.');
    notFound();
  }

  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SerpResultContent serpId={serpId} searchParams={resolvedSearchParams} />
    </Suspense>
  );
}
