import { getHistoryDetail, getRegions } from '@/app/actions'; // Import getRegions
import HistoryDetailClientLayout from '@/components/layout/keywrod-research-detail-client-layout';
import { notFound } from 'next/navigation';
// Import constants if needed directly, or rely on getRegions
// import { LANGUAGES, REGIONS } from '@/app/config/constants';

interface HistoryDetailPageProps {
  params: {
    id: string;
  };
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const historyId = params.id;

  if (!historyId) {
    console.error('History detail page called without ID.');
    notFound();
  }

  // Fetch both history detail and regions/languages data in parallel
  let historyDetail = null;
  let regionsData = null;
  try {
    console.log(`[History Detail Page] Fetching data for ID: ${historyId}`);
    [historyDetail, regionsData] = await Promise.all([
      getHistoryDetail(historyId),
      getRegions() // Fetch regions/languages data
    ]);
  } catch (error) {
    console.error(`[History Detail Page] Error fetching data for ${historyId}:`, error);
    return <div>無法加載頁面數據：{error instanceof Error ? error.message : '未知錯誤'}</div>;
  }

  if (!historyDetail) {
    console.warn(`[History Detail Page] No details found for ID: ${historyId}`);
    notFound();
  }

  // Pass both data sets to the client component
  return (
      <HistoryDetailClientLayout 
        historyDetail={historyDetail} 
        initialRegionsData={regionsData} // Pass regions data
      />
  );
} 