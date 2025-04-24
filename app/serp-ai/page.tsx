import TestSerpActionPage from './use-serp-ai';
import { getTotalAnalyzedSerpsCount } from '@/app/services/firebase/db-serp';

export default async function SerpAnalysisTestRoute() {
  const totalAnalyzedCount = await getTotalAnalyzedSerpsCount();

  return <TestSerpActionPage totalAnalyzedSerps={totalAnalyzedCount} />;
}
