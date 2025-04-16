'use client';

import type { SerpAnalysisData as FirebaseSerpAnalysisData } from '@/app/services/firebase'; // Rename imported type
import React, { useCallback, useMemo, useState } from 'react'; // Ensure React is imported
// Import Server Actions
import {
  convertAnalysisTextToJson,
  performContentTypeAnalysis,
  performSerpTitleAnalysis,
  performUserIntentAnalysis,
  // Import the exported types
  type ContentTypeAnalysisJson,
  type TitleAnalysisJson,
  type UserIntentAnalysisJson
} from '@/app/actions/serp-action';

// Define the data structure expected by the Client Component
// Store both text and JSON results for content/intent
type ClientSerpAnalysisData = Omit<
  FirebaseSerpAnalysisData,
  'timestamp' | 'contentTypeAnalysis' | 'userIntentAnalysis' | 'titleAnalysis' // Omit fields we redefine
> & {
  timestamp: Date;
  contentTypeAnalysisText: string | null;
  userIntentAnalysisText: string | null;
  titleAnalysis: TitleAnalysisJson | null; // Use imported type
  // Add fields for the converted JSON
  contentTypeAnalysisJson: ContentTypeAnalysisJson | null; // Use imported type
  userIntentAnalysisJson: UserIntentAnalysisJson | null; // Use imported type
};

// Update props type to use the client-specific data structure
type SerpDisplayClientProps = {
  initialAnalysisData: ClientSerpAnalysisData;
};

// Analysis types will now trigger different flows
type AnalysisTriggerType = 'contentType' | 'userIntent' | 'title';

export function SerpDisplayClient({
  initialAnalysisData
}: SerpDisplayClientProps) {
  const [analysisData, setAnalysisData] =
    useState<ClientSerpAnalysisData>(initialAnalysisData);

  // Combined loading state for Text Generation + JSON Conversion
  const [isLoading, setIsLoading] = useState<
    Record<AnalysisTriggerType, boolean>
  >({
    contentType: false,
    userIntent: false,
    title: false
  });

  // Combined error state
  const [analysisError, setAnalysisError] = useState<
    Record<AnalysisTriggerType, string | null>
  >({
    contentType: null,
    userIntent: null,
    title: null
  });

  const keyword = analysisData.keyword;
  const serpResults = analysisData.serpResults;

  const formatSerpForPrompt = useCallback(
    (data: typeof serpResults): string => {
      return data
        .slice(0, 10)
        .map(
          (item, index) =>
            `Position: ${index + 1}\nTitle: ${item.title}\nURL: ${item.url}\n\n`
        )
        .join('');
    },
    []
  ); // Memoize this helper

  // --- Main analysis handler function ---
  const handleAnalyze = useCallback(
    async (type: AnalysisTriggerType) => {
      setIsLoading(prev => ({ ...prev, [type]: true }));
      setAnalysisError(prev => ({ ...prev, [type]: null }));

      try {
        const serpString = formatSerpForPrompt(serpResults);
        console.log(
          `[Client] Requesting ${type} analysis for keyword: ${keyword}`
        );

        if (type === 'contentType' || type === 'userIntent') {
          // --- Step 1: Get Raw Text ---
          const analysisFn =
            type === 'contentType'
              ? performContentTypeAnalysis
              : performUserIntentAnalysis;
          const params: any = { keyword, serpString };
          if (type === 'userIntent') {
            // TODO: Replace mock data with actual logic to fetch/provide relatedKeywordsRaw
            // For example, fetch from an API or pass down as a prop.
            // const realRelatedKeywords = await fetchRelatedKeywords(keyword);
            params.relatedKeywordsRaw = ''; // Pass empty string for now
          }

          console.log(`[Client] Performing ${type} text analysis...`);
          const textResult: { analysisText: string } = await analysisFn(params);
          const rawText = textResult.analysisText;

          // Update state with raw text immediately (optional, but can show intermediate step)
          const textStateKey =
            type === 'contentType'
              ? 'contentTypeAnalysisText'
              : 'userIntentAnalysisText';
          setAnalysisData(prev => ({ ...prev, [textStateKey]: rawText }));

          console.log(
            `[Client] Received raw ${type} text. Converting to JSON...`
          );

          // --- Step 2: Convert Text to JSON ---
          const conversionResult = await convertAnalysisTextToJson({
            analysisType: type,
            analysisText: rawText,
            keyword: keyword
            // model: 'gpt-4o-mini' // Optionally use a cheaper model for conversion
          });

          console.log(
            `[Client] Received converted ${type} JSON:`,
            conversionResult
          );

          // Update state with the final JSON result
          const jsonStateKey =
            type === 'contentType'
              ? 'contentTypeAnalysisJson'
              : 'userIntentAnalysisJson';
          setAnalysisData(prev => ({
            ...prev,
            [jsonStateKey]: conversionResult
          }));
        } else if (type === 'title') {
          // --- Direct JSON Analysis (Title) ---
          console.log(`[Client] Performing title JSON analysis...`);
          const result = await performSerpTitleAnalysis({
            keyword,
            serpString
          });
          console.log(`[Client] Received title JSON:`, result);
          setAnalysisData(prev => ({ ...prev, titleAnalysis: result }));
        }
      } catch (err) {
        console.error(
          `[Client] Error during ${type} analysis/conversion:`,
          err
        );
        const errorMessage =
          err instanceof Error ? err.message : '分析或轉換時發生未知錯誤';
        setAnalysisError(prev => ({ ...prev, [type]: errorMessage }));
        // Optionally clear partial results on error
        // setAnalysisData(prev => ({ ...prev, ... }));
      } finally {
        setIsLoading(prev => ({ ...prev, [type]: false }));
      }
    },
    [keyword, serpResults, formatSerpForPrompt]
  ); // Dependencies for useCallback

  // Memoize analysis results for passing to sections
  const results = useMemo(
    () => ({
      contentType: analysisData.contentTypeAnalysisJson,
      userIntent: analysisData.userIntentAnalysisJson,
      title: analysisData.titleAnalysis
    }),
    [analysisData]
  );

  return (
    <div className="container mx-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left Column: SERP Results */}
      <div className="border rounded-lg p-4 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">
          Google SERP 結果 - {keyword}
        </h2>
        {serpResults.length > 0 ? (
          <ul className="space-y-4">
            {serpResults.map((item, index) => (
              <li
                key={item.url + index}
                className="border-b pb-4 last:border-b-0"
              >
                <span className="text-sm font-medium text-gray-500">
                  {index + 1}.
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline ml-2 block font-semibold"
                >
                  {item.title}
                </a>
                <span className="text-green-700 text-sm block mt-1 break-all">
                  {item.url}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p>未找到與 "{keyword}" 相關的 SERP 結果。</p>
        )}
      </div>

      {/* Right Column: AI Analysis */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold mb-4">AI 分析工具</h2>

        {/* Content Type Analysis */}
        <AnalysisSection
          title="內容類型分析"
          type="contentType"
          isLoading={isLoading.contentType}
          error={analysisError.contentType}
          onAnalyze={() => handleAnalyze('contentType')}
          result={results.contentType} // Pass memoized JSON result
          rawTextResult={analysisData.contentTypeAnalysisText} // Optionally pass raw text
        />

        {/* User Intent Analysis */}
        <AnalysisSection
          title="用戶意圖分析"
          type="userIntent"
          isLoading={isLoading.userIntent}
          error={analysisError.userIntent}
          onAnalyze={() => handleAnalyze('userIntent')}
          result={results.userIntent} // Pass memoized JSON result
          rawTextResult={analysisData.userIntentAnalysisText} // Optionally pass raw text
        />

        {/* Title Analysis */}
        <AnalysisSection
          title="SERP 標題分析"
          type="title"
          isLoading={isLoading.title}
          error={analysisError.title}
          onAnalyze={() => handleAnalyze('title')}
          result={results.title} // Pass memoized JSON result
        />
      </div>
    </div>
  );
}

// Helper component for displaying each analysis section
type AnalysisSectionProps = {
  title: string;
  type: AnalysisTriggerType;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
  result:
    | ContentTypeAnalysisJson
    | UserIntentAnalysisJson
    | TitleAnalysisJson
    | null;
  rawTextResult?: string | null; // Optional raw text for display
};

function AnalysisSection({
  title,
  type,
  isLoading,
  error,
  onAnalyze,
  result,
  rawTextResult
}: AnalysisSectionProps): React.ReactNode {
  // --- Render Result Logic ---
  const renderResult = (): React.ReactNode | null => {
    if (!result) return null;

    // Content Type Rendering
    if (type === 'contentType' && result && 'contentTypes' in result) {
      const data = result as ContentTypeAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">
            {data.analysisTitle || title}
          </h4>
          {data.reportDescription && (
            <p className="text-gray-600">{data.reportDescription}</p>
          )}
          {data.usageHint && (
            <p className="text-xs italic text-gray-500">
              提示: {data.usageHint}
            </p>
          )}
          <h5 className="font-medium mt-2">內容類型分佈:</h5>
          {data.contentTypes && data.contentTypes.length > 0 ? (
            <ul className="list-disc pl-5 space-y-2">
              {data.contentTypes.map((ct, index) => (
                <li key={index}>
                  <span className="font-medium">{ct.type}</span> ({ct.count}{' '}
                  個結果)
                  {ct.pages && ct.pages.length > 0 && (
                    <ul className="list-circle pl-5 mt-1 text-xs space-y-1">
                      {ct.pages.map(page => (
                        <li key={page.position}>
                          <a
                            href={page.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            位置 {page.position}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">未分析出內容類型。</p>
          )}
        </div>
      );
    }

    // User Intent Rendering
    if (type === 'userIntent' && result && 'intents' in result) {
      const data = result as UserIntentAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">
            {data.analysisTitle || title}
          </h4>
          {data.reportDescription && (
            <p className="text-gray-600">{data.reportDescription}</p>
          )}
          {data.usageHint && (
            <p className="text-xs italic text-gray-500">
              提示: {data.usageHint}
            </p>
          )}

          <h5 className="font-medium mt-2">用戶意圖分析:</h5>
          {data.intents && data.intents.length > 0 ? (
            <ul className="space-y-3">
              {data.intents.map((intent, index) => (
                <li key={index} className="border-l-2 pl-3 border-gray-200">
                  <p>
                    <span className="font-medium">類別:</span> {intent.category}
                  </p>
                  <p>
                    <span className="font-medium">具體意圖:</span>{' '}
                    {intent.specificIntent} ({intent.count} 個結果)
                  </p>
                  {intent.pages && intent.pages.length > 0 && (
                    <div className="mt-1">
                      <span className="text-xs font-medium">涉及頁面:</span>
                      <ul className="list-circle pl-5 text-xs space-y-1">
                        {intent.pages.map(page => (
                          <li key={page.position}>
                            <a
                              href={page.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              位置 {page.position}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500">未分析出用戶意圖。</p>
          )}

          {data.relatedKeywords && data.relatedKeywords.length > 0 && (
            <div className="mt-4">
              <h5 className="font-medium">相關關鍵字:</h5>
              <ul className="list-disc pl-5 space-y-1 text-xs">
                {data.relatedKeywords.map((kw, index) => (
                  <li key={index}>
                    {kw.keyword} (搜索量: {kw.searchVolume ?? '?'})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Title Analysis Rendering
    if (type === 'title' && result && 'title' in result) {
      const data = result as TitleAnalysisJson; // Type assertion
      return (
        <div className="space-y-3 text-sm">
          <h4 className="font-semibold text-base">建議標題:</h4>
          <p className="bg-green-50 p-2 rounded border border-green-200">
            {data.title}
          </p>

          <h5 className="font-medium mt-2">標題分析:</h5>
          <p className="text-gray-700 whitespace-pre-wrap break-words">
            {data.analysis}
          </p>

          {data.recommendations && data.recommendations.length > 0 && (
            <div className="mt-2">
              <h5 className="font-medium">建議:</h5>
              <ul className="list-disc pl-5 space-y-1">
                {data.recommendations.map((rec, index) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    }

    // Fallback for unknown result structure or type
    return (
      <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  // --- Render Raw Text Logic ---
  const renderRawText = (): React.ReactNode | null => {
    if (!rawTextResult || result) return null; // Only show if no JSON result yet
    return (
      <div className="mt-2">
        <h4 className="text-sm font-medium text-gray-600 mb-1">
          原始文本結果:
        </h4>
        <pre className="text-xs bg-yellow-50 p-3 rounded overflow-x-auto whitespace-pre-wrap break-words">
          {rawTextResult}
        </pre>
      </div>
    );
  };

  // --- Main Component Return ---
  return (
    <div className="border rounded-lg p-4 shadow-sm">
      {/* Header with Title and Button */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        <button
          onClick={onAnalyze}
          disabled={isLoading}
          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        >
          {isLoading ? '處理中...' : '開始分析'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="text-red-600 bg-red-50 p-2 rounded mb-2 text-sm">
          錯誤: {error}
        </div>
      )}

      {/* Loading Indicator */}
      {isLoading && (
        <p className="text-sm text-gray-500">正在加載分析結果...</p>
      )}

      {/* Content Area: Render JSON or Raw Text or Placeholder */}
      {!isLoading && !error && (
        <>
          {renderResult()} {/* Call the render function */}
          {renderRawText()} {/* Call the render function */}
        </>
      )}

      {/* Placeholder when no data, not loading, and no error */}
      {!result && !rawTextResult && !isLoading && !error && (
        <p className="text-sm text-gray-400">點擊 "開始分析" 以獲取結果。</p>
      )}
    </div>
  );
}
