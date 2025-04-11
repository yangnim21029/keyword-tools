import {
  fetchKeywordResearchDetail,
  fetchKeywordResearchList
} from '@/app/actions';
import type { KeywordVolumeItem } from '@/lib/schema'; // Import Keyword type
import { notFound } from 'next/navigation';
import KeywordResearchDetail from '../components/keyword-research-detail';

// Define the params type as a Promise
type Params = Promise<{ researchId: string }>;
type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

// Define the props type for the page component
type Props = {
  params: Params;
  searchParams?: SearchParams;
};

// Define the structure for distribution data
// Updated for Fixed Volume Ranges
interface VolumeDistributionData {
  min: number; // Overall min volume (>= 0)
  max: number; // Overall max volume
  count: number; // Total count of keywords with volume >= 1
  countZero: number; // Count of keywords with volume 0
  countRange1: number; // Count in [1, 10]
  countRange2: number; // Count in [11, 1000]
  countRange3: number; // Count in [1001, 10000]
  countRange4: number; // Count in [10001, 100000]
  countRange5: number; // Count in >= 100001
}

// Helper function to calculate distribution (can be moved to a utils file)
function calculateVolumeDistribution(
  keywords: KeywordVolumeItem[] | null | undefined
): VolumeDistributionData {
  // Get all volumes, including 0
  const allVolumes = (keywords || []).map(kw => kw.searchVolume ?? 0);

  let minVal = 0;
  let maxVal = 0;
  const countTotal = allVolumes.length;
  let countGtZero = 0;
  let countZero = 0;
  let countRange1 = 0;
  let countRange2 = 0;
  let countRange3 = 0;
  let countRange4 = 0;
  let countRange5 = 0;

  if (countTotal > 0) {
    // Calculate min/max from all volumes
    minVal = Math.min(...allVolumes);
    maxVal = Math.max(...allVolumes);

    allVolumes.forEach(vol => {
      if (vol === 0) {
        countZero++;
      } else if (vol >= 1) {
        countGtZero++; // Count keywords with volume >= 1
        if (vol <= 10) {
          countRange1++;
        } else if (vol <= 1000) {
          countRange2++;
        } else if (vol <= 10000) {
          countRange3++;
        } else if (vol <= 100000) {
          countRange4++;
        } else {
          countRange5++;
        }
      }
      // Volumes < 0 are ignored by default
    });
  } else {
    // Handle case with no keywords
    minVal = 0;
    maxVal = 0;
  }

  return {
    min: minVal,
    max: maxVal,
    count: countGtZero, // Return count of keywords with volume >= 1
    countZero: countZero,
    countRange1: countRange1,
    countRange2: countRange2,
    countRange3: countRange3,
    countRange4: countRange4,
    countRange5: countRange5
  };
}

// Function to generate static paths at build time
export async function generateStaticParams() {
  // Fetch all research items (consider fetching only IDs if performance becomes an issue)
  const { data: researches } = await fetchKeywordResearchList(
    undefined,
    undefined,
    1000
  ); // Fetch a large number or implement pagination if needed

  // Map the data to the format required by generateStaticParams
  return researches.map(research => ({
    researchId: research.id
  }));
}

export default async function KeywordResultPage({ params }: Props) {
  // Resolve the Promise to get params
  const { researchId } = await params;

  // Fetch initial data on the server
  const researchDetail = await fetchKeywordResearchDetail(researchId);

  // If no research detail is found, show 404
  if (!researchDetail) {
    notFound();
  }

  // --- Calculate volume distribution on the server ---
  const volumeDistribution = calculateVolumeDistribution(
    researchDetail.keywords
  );

  return (
    <KeywordResearchDetail
      initialResearchDetail={researchDetail}
      researchId={researchId}
      // Pass calculated distribution data as prop
      volumeDistribution={volumeDistribution}
    />
  );
}
