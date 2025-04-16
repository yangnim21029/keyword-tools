import { KeywordInputForm } from '@/app/serp/keyword-input-form';
import { Suspense } from 'react';
import { getSerpAnalysisList } from '../services/firebase'; // Import the list function

// Loading component for the list
const ListLoadingFallback = () => {
  return (
    <p className="text-center text-gray-500 mt-4">正在載入已分析列表...</p>
  );
};

// Component to render the list fetching and display
async function ExistingKeywordsList() {
  let keywordsList: { id: string; keyword: string }[] = []; // Expect array of objects
  let error: string | null = null;

  try {
    keywordsList = await getSerpAnalysisList(); // Call the updated function
  } catch (err) {
    console.error('[SERP Input Page] Error fetching keyword list:', err);
    error = '無法載入已分析列表。';
  }

  if (error) {
    return <p className="text-center text-red-500 mt-4">{error}</p>;
  }

  // Pass the list of {id, keyword} objects to the client component
  return <KeywordInputForm existingKeywords={keywordsList} />;
}

// This page now primarily serves as the entry point for keyword input.
// It fetches the list of existing keywords.
export default function SerpInputPage() {
  console.log('[SERP Input Page] Rendering...');

  return (
    <div className="container mx-auto p-4 pt-16 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-6">輸入關鍵字進行 SERP 分析</h1>
      <p className="text-gray-600 mb-8 max-w-md text-center">
        輸入您想分析的關鍵字，或選擇下方已分析過的關鍵字查看結果。
      </p>
      {/* Wrap the async component in Suspense */}
      <Suspense fallback={<ListLoadingFallback />}>
        <ExistingKeywordsList />
      </Suspense>
    </div>
  );
}

/* 
// Removed old logic that fetched data based on searchParams
import { SerpDisplayClient } from '@/app/serp/serp-display-client';
import { Timestamp } from 'firebase-admin/firestore';
import { Suspense } from 'react';
import {
  getSerpAnalysis,
  saveSerpAnalysis,
  type SerpAnalysisData
} from '../services/firebase';
import { fetchKeywordData } from '../services/serp.service';

type SerpPageProps = {
  searchParams: Promise<{ keyword?: string | string[] }>;
};

function LoadingSpinner() { ... }
function ErrorDisplay({ message }: { message: string }) { ... }
async function SerpContent({ searchParams }: { searchParams: Promise<{ keyword?: string | string[] }> }) { ... }

export default function SerpPage({ searchParams }: SerpPageProps) {
  console.log('[SERP Page] Rendering...');
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <SerpContent searchParams={searchParams} />
    </Suspense>
  );
}
*/
