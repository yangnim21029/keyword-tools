"use server";

import { getRegions } from '@/app/actions';
import { getKeywordResearchById } from '@/app/services/firebase';
// Import the renamed client layout component
import KeywordResearchDetailClientLayout from '@/components/layout/keyword-research-detail-client-layout';
import { notFound } from 'next/navigation';

interface KeywordResearchDetailPageProps { // Renamed interface
  params: {
    id: string;
  };
}

export default async function KeywordResearchDetailPage({ params }: KeywordResearchDetailPageProps) { // Renamed function
  const {id} = params; 

  if (!id) {
    console.error('Keyword research detail page called without ID.');
    notFound();
  }

  let researchDetail = null; // Renamed variable
  let regionsData = null;
  try {
    console.log(`[Keyword Research Detail Page] Fetching data for ID: ${id}`);
    [researchDetail, regionsData] = await Promise.all([
      getKeywordResearchById(id), // Still using original action name
      getRegions()
    ]);
  } catch (error) {
    console.error(`[Keyword Research Detail Page] Error fetching data for ${id}:`, error);
    return <div>無法加載頁面數據：{error instanceof Error ? error.message : '未知錯誤'}</div>;
  }

  if (!researchDetail) {
    console.warn(`[Keyword Research Detail Page] No details found for ID: ${id}`);
    notFound();
  }

  // Render the renamed client layout component
  return (
      <KeywordResearchDetailClientLayout 
        researchDetail={researchDetail} 
        initialRegionsData={regionsData} 
      />
  );
} 