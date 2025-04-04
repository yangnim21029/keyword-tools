'use client';

import { languageStandards } from '@/lib/constants/serpConstants';
import { processedSerpResultSchema } from "@/lib/schemas/serp.schema"; // Import schema directly
import {
  calculateLengthCompliance,
  evaluateDescriptionLengthClass,
  evaluateTitleLengthClass
} from '@/utils/serpUtils';
import { z } from 'zod'; // Import zod

// Infer type from schema
type ProcessedSerpResult = z.infer<typeof processedSerpResultSchema>;

type LanguageStandard = typeof languageStandards.default;

interface SerpSummaryProps {
  result: ProcessedSerpResult | null;
  totalResults?: number;
  avgTitleLength?: number;
  avgDescriptionLength?: number;
  createdAt?: Date | string;
}

export function SerpSummary({ result, totalResults, avgTitleLength, avgDescriptionLength, createdAt }: SerpSummaryProps) {
  if (!result || !result.analysis) {
    return null;
  }

  const { analysis } = result;
  const { totalResults: analysisTotalResults, domains, topDomains, avgTitleLength: analysisAvgTitleLength, avgDescriptionLength: analysisAvgDescriptionLength } = analysis;

  // Determine language and standard
  const language = result.queryDetails?.languageCode || 'zh-TW'; // Fallback or get from context/settings
  const standard = languageStandards[language as keyof typeof languageStandards] || languageStandards.default;

  // Calculate compliance
  const compliance = calculateLengthCompliance(result.results, standard);

  // Determine the search query display string
  let searchQuery = "";
  if (result.queryDetails?.term) {
    searchQuery = result.queryDetails.term;
  } else if (result.originalQuery) {
    searchQuery = result.originalQuery;
  }

  // Don't render if no analysis data or no query identifier
  if (!analysis || !searchQuery) {
    return null;
  }

  return (
    <div>
      <h2 className="text-base font-semibold mb-2">查詢摘要</h2>
      <div className="p-3 rounded-md border border-gray-200 dark:border-gray-700">
        <p className="mb-2 text-sm">
          <span className="font-medium text-black dark:text-gray-100">關鍵詞:</span> {searchQuery}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          {/* 左側：基本統計 */}
          <div>
            <p className="text-gray-700 dark:text-gray-400 mb-1">
              搜索結果總數: <span className="font-semibold">{totalResults?.toLocaleString() || analysisTotalResults.toLocaleString()}</span>
            </p>
            <p className="text-gray-700 dark:text-gray-400 mb-1">
              平均標題長度:
              <span className={`ml-1 font-semibold ${evaluateTitleLengthClass(avgTitleLength || analysisAvgTitleLength, standard)}`}>
                {(avgTitleLength || analysisAvgTitleLength).toFixed(1)} 字
              </span>
            </p>
            <p className="text-gray-700 dark:text-gray-400">
              平均描述長度:
              <span className={`ml-1 font-semibold ${evaluateDescriptionLengthClass(avgDescriptionLength || analysisAvgDescriptionLength, standard)}`}> 
                {(avgDescriptionLength || analysisAvgDescriptionLength).toFixed(1)} 字
              </span>
            </p>
          </div>
          {/* 右側：合規率 */}
          <div>
            <p className="text-gray-700 dark:text-gray-400 mb-1">
              標題合規率 (理想):
              <span className={`ml-1 font-semibold ${compliance.title >= 75 ? 'text-green-600' : compliance.title >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {compliance.title}%
              </span>
            </p>
            <p className="text-gray-700 dark:text-gray-400">
              描述合規率 (理想):
              <span className={`ml-1 font-semibold ${compliance.description >= 75 ? 'text-green-600' : compliance.description >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                {compliance.description}%
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 