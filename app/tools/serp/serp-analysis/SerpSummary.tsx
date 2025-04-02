'use client';

import { languageStandards } from '@/lib/constants/serpConstants';
import { ProcessedSerpResult } from '@/lib/schemas';
import {
  calculateLengthCompliance,
  evaluateDescriptionLengthClass,
  evaluateTitleLengthClass
} from '@/utils/serpUtils';

type LanguageStandard = typeof languageStandards.default;

interface SerpSummaryProps {
  result: ProcessedSerpResult | null;
}

export function SerpSummary({ result }: SerpSummaryProps) {
  if (!result || !result.analysis) {
    return null;
  }

  const { analysis } = result;
  const { totalResults, domains, topDomains, avgTitleLength, avgDescriptionLength } = analysis;

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
    <div className="mb-4">
      <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-gray-200">查詢摘要</h2> {/* 更深的黑色 */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-sm"> {/* 確保淺色模式是純白 */}
        <p className="mb-3 text-gray-800 dark:text-gray-300"> {/* 更深的灰色 */}
          <span className="font-medium text-black dark:text-gray-100">關鍵詞:</span> {searchQuery}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
          {/* Analysis Stats */}
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-400 mb-1"> {/* 更深的灰色 */}
              搜索結果總數: <span className="font-semibold text-black dark:text-gray-100">{totalResults.toLocaleString()}</span> {/* 純黑色 */}
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-400 mb-1"> {/* 更深的灰色 */}
              平均標題長度:
              <span className={`ml-1.5 font-semibold ${evaluateTitleLengthClass(avgTitleLength, standard)}`}>
                {avgTitleLength.toFixed(1)} 字
              </span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-400"> {/* 更深的灰色 */}
              平均描述長度:
              <span className={`ml-1.5 font-semibold ${evaluateDescriptionLengthClass(avgDescriptionLength, standard)}`}> 
                {avgDescriptionLength.toFixed(1)} 字
              </span>
            </p>
          </div>
          {/* Compliance Stats */}
          <div>
            <p className="text-sm text-gray-700 dark:text-gray-400 mb-1"> {/* 更深的灰色 */}
              標題合規率 (理想):
              <span className={`ml-1.5 font-semibold ${compliance.title >= 75 ? 'text-green-800 dark:text-green-400' : compliance.title >= 50 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'}`}> {/* 更深的色調 */}
                {compliance.title}%
              </span>
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-400"> {/* 更深的灰色 */}
              描述合規率 (理想):
              <span className={`ml-1.5 font-semibold ${compliance.description >= 75 ? 'text-green-800 dark:text-green-400' : compliance.description >= 50 ? 'text-yellow-700 dark:text-yellow-400' : 'text-red-700 dark:text-red-400'}`}> {/* 更深的色調 */}
                {compliance.description}%
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 