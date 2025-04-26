import { getTotalAnalyzedSerpsCount } from '@/app/services/firebase/data-serp-result';
import TestSerpActionPage from './use-serp-ai';

export default async function SerpAnalysisTestRoute() {
  const totalAnalyzedCount = await getTotalAnalyzedSerpsCount();

  return <TestSerpActionPage totalAnalyzedSerps={totalAnalyzedCount} />;
}
