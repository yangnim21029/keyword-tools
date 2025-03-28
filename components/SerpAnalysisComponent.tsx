import React, { useState } from 'react';
import DomainCategoryAnalysis from './DomainCategoryAnalysis';
// 導入需要的函數
import { extractBaseDomain, getDomainCategory } from './domainCategoryUtils';

// 定義 SERP 資料結構
interface SerpResult {
  results: Array<{
    title: string;
    url: string;
    displayUrl: string;
    position: number;
    description: string;
    siteLinks: any[];
    emphasizedKeywords?: string[]; // 新增強調的關鍵詞
  }>;
  analysis: {
    totalResults: number;
    domains: Record<string, number>;
    topDomains: string[];
    avgTitleLength: number;
    avgDescriptionLength: number;
  };
  timestamp: string;
  originalQuery?: string;
  // 添加新欄位
  queryDetails?: {
    term?: string;
    url?: string;
    device?: string;
    page?: number;
    type?: string;
    domain?: string;
    countryCode?: string;
    languageCode?: string;
    resultsPerPage?: string;
  };
  totalResults?: number; // 搜尋引擎返回的總結果數
  relatedQueries?: Array<{
    title: string;
    url: string;
  }>;
  peopleAlsoAsk?: any[];
}

// 定義不同語言的標準
const languageStandards = {
  // 英文標準
  en: {
    title: {
      ideal: 60, // 理想的英文標題長度
      max: 70,   // 最大建議標題長度
    },
    description: {
      ideal: 160, // 理想的英文描述長度
      max: 175,   // 最大建議描述長度
    }
  },
  // 中文標準 (繁體)
  'zh-TW': {
    title: {
      ideal: 30, // 理想的中文標題字數
      max: 40,   // 最大建議標題字數
    },
    description: {
      ideal: 80,  // 理想的中文描述字數
      max: 100,   // 最大建議描述字數
    }
  },
  // 中文標準 (簡體)
  'zh-CN': {
    title: {
      ideal: 30, // 理想的中文標題字數
      max: 40,   // 最大建議標題字數
    },
    description: {
      ideal: 80,  // 理想的中文描述字數
      max: 100,   // 最大建議描述字數
    }
  },
  // 默認標準 (如果沒有特定語言設置)
  default: {
    title: {
      ideal: 60,
      max: 70,
    },
    description: {
      ideal: 160,
      max: 175,
    }
  }
};

interface SerpAnalysisComponentProps {
  data: SerpResult | Record<string, SerpResult> | SerpResult[];
  language?: string;
  showHtmlAnalysis?: boolean;
}

export default function SerpAnalysisComponent({ data, language = 'zh-TW', showHtmlAnalysis = false }: SerpAnalysisComponentProps) {
  const [activeTab, setActiveTab] = useState('results'); // 默認顯示搜索結果標籤
  
  console.log("接收到的 SERP 資料:", data);
  console.log("使用的語言設置:", language);
  
  // 獲取當前語言的標準
  const standard = languageStandards[language as keyof typeof languageStandards] || languageStandards.default;
  
  // 查找並處理資料
  let serpData: SerpResult | null = null;
  
  // 檢查資料類型並提取結果
  if (!data) {
    console.error("沒有提供 SERP 資料");
    return <div className="p-4 text-red-500">沒有找到分析結果</div>;
  }
  
  // 處理不同的資料結構
  if (Array.isArray(data) && data.length > 0) {
    // 如果資料是陣列
    serpData = data[0];
  } else if (typeof data === 'object') {
    if ('results' in data && 'analysis' in data) {
      // 如果資料已經是 SerpResult 格式
      serpData = data as SerpResult;
    } else {
      // 嘗試處理作為對象的資料 (關鍵詞 -> 結果)
      const values = Object.values(data);
      if (values.length > 0) {
        const firstValue = values[0];
        if (firstValue && typeof firstValue === 'object' && 'results' in firstValue && 'analysis' in firstValue) {
          serpData = firstValue as SerpResult;
        }
      }
    }
  }
  
  // 如果沒有找到有效資料，顯示錯誤
  if (!serpData) {
    console.error("無法處理提供的 SERP 資料格式:", data);
    return (
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          <h3 className="font-bold text-lg mb-2">無法處理 SERP 分析數據</h3>
          <p>數據結構與預期不符。請檢查控制台獲取更多信息。</p>
          <div className="mt-4">
            <p className="font-semibold">調試信息:</p>
            <pre className="text-xs mt-1 bg-gray-100 p-2 rounded overflow-auto max-h-40">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }
  
  // 提取數據
  const { results, analysis } = serpData;
  
  // 獲取查詢關鍵詞 (直接使用 API 返回的關鍵詞資料)
  let searchQuery = "";
  if (serpData.queryDetails && serpData.queryDetails.term) {
    // 優先使用 queryDetails.term
    searchQuery = serpData.queryDetails.term;
  } else if (serpData.originalQuery) {
    // 其次使用 originalQuery
    searchQuery = serpData.originalQuery;
  }
  
  // 評估標題和描述長度是否符合標準
  const evaluateTitleLength = (length: number) => {
    if (length <= standard.title.ideal) return 'text-green-600';
    if (length <= standard.title.max) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  const evaluateDescriptionLength = (length: number) => {
    if (length <= standard.description.ideal) return 'text-green-600';
    if (length <= standard.description.max) return 'text-yellow-600';
    return 'text-red-600';
  };
  
  // 計算標題長度符合率
  const calculateCompliance = () => {
    if (!results || results.length === 0) return { title: 0, description: 0 };
    
    const totalResults = results.length;
    const goodTitles = results.filter(r => r.title.length <= standard.title.ideal).length;
    const goodDescriptions = results.filter(r => r.description.length <= standard.description.ideal).length;
    
    return {
      title: Math.round((goodTitles / totalResults) * 100),
      description: Math.round((goodDescriptions / totalResults) * 100)
    };
  };
  
  const compliance = calculateCompliance();
  
  const renderSearchResult = (result: any, index: number) => {
    return (
      <div key={index} className="mb-6 p-4 border rounded-lg hover:bg-gray-50">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-medium text-blue-600 mb-1">
              <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {result.title}
              </a>
            </h3>
            <p className="text-sm text-gray-600 mb-2">{result.displayUrl}</p>
            <p className="text-gray-700">{result.description}</p>
          </div>
          <div className="ml-4 text-sm text-gray-500">
            #{result.position}
          </div>
        </div>

        {/* HTML 分析結果 */}
        {showHtmlAnalysis && result.htmlAnalysis && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium mb-2">HTML 結構分析</h4>
            
            {/* H1 標題 */}
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-1">H1 標題:</h5>
              <ul className="list-disc list-inside text-sm">
                {result.htmlAnalysis.h1.map((h1: string, idx: number) => (
                  <li key={idx} className={result.htmlAnalysis.h1Consistency ? 'text-green-600' : 'text-red-600'}>
                    {h1}
                    {result.htmlAnalysis.h1Consistency && idx === 0 && (
                      <span className="ml-2 text-xs text-green-500">(與關鍵詞一致)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* H2 標題 */}
            <div className="mb-3">
              <h5 className="text-sm font-medium text-gray-700 mb-1">H2 標題:</h5>
              <ul className="list-disc list-inside text-sm">
                {result.htmlAnalysis.h2.map((h2: string, idx: number) => (
                  <li key={idx}>{h2}</li>
                ))}
              </ul>
            </div>

            {/* H3 標題 */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-1">H3 標題:</h5>
              <ul className="list-disc list-inside text-sm">
                {result.htmlAnalysis.h3.map((h3: string, idx: number) => (
                  <li key={idx}>{h3}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-6xl mx-auto">
      {/* 標題部分 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">
          SERP 分析結果 {searchQuery && <span className="text-blue-600">"{searchQuery}"</span>}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
            搜索結果數: {analysis.totalResults || 0}
          </span>
          {serpData.queryDetails && serpData.queryDetails.resultsPerPage && (
            <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
              請求結果: {serpData.queryDetails.resultsPerPage}
            </span>
          )}
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
            語言: {language}
          </span>
        </div>
      </div>

      {/* 標籤列 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('results')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'results'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            搜索結果
          </button>
          <button
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'categories'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            網域分類分析
          </button>
          {serpData.relatedQueries && serpData.relatedQueries.length > 0 && (
            <button
              onClick={() => setActiveTab('related')}
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === 'related'
                  ? 'border-b-2 border-blue-500 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              相關查詢
            </button>
          )}
        </nav>
      </div>

      {/* 搜索結果標籤內容 */}
      {activeTab === 'results' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-800">
              搜索結果 (共 {results.length} 項)
            </h3>
            <div className="flex space-x-2">
              {serpData.totalResults && serpData.totalResults > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  搜索引擎結果: {serpData.totalResults.toLocaleString()}
                </span>
              )}
              {serpData.queryDetails && serpData.queryDetails.resultsPerPage && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  請求結果: {serpData.queryDetails.resultsPerPage}
                </span>
              )}
            </div>
          </div>
          <div className="space-y-4">
            {results.map((result, index) => {
              // 獲取域名分類和競爭狀態
              const baseDomain = extractBaseDomain(result.url);
              const category = getDomainCategory(baseDomain);
              const isCompetitive = category === 'Unknown';
              const isOwnMedia = category === '自家媒體';
              
              return (
                <div 
                  key={index} 
                  className={`border rounded-lg p-4 hover:shadow-md transition-shadow ${
                    isOwnMedia
                      ? 'border-purple-500 border-2 bg-purple-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start">
                    <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center mr-3 flex-shrink-0 ${
                      isOwnMedia ? 'bg-purple-600' : 'bg-blue-600'
                    }`}>
                      {result.position}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <a 
                          href={result.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className={`text-lg font-medium hover:underline ${
                            isOwnMedia ? 'text-purple-600' : 'text-blue-600'
                          }`}
                        >
                          {result.title}
                        </a>
                        <div className="flex items-center gap-2">
                          {isOwnMedia ? (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-bold">
                              自家媒體
                            </span>
                          ) : category !== 'Unknown' ? (
                            <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs">
                              {category}
                            </span>
                          ) : null}
                          <span className={`px-2 py-1 rounded text-xs ${
                            isCompetitive 
                              ? 'bg-green-100 text-green-800' 
                              : isOwnMedia
                                ? 'bg-purple-200 text-purple-800 font-medium'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                            {isCompetitive ? '可競爭' : isOwnMedia ? '自家網站' : '已佔用'}
                          </span>
                        </div>
                      </div>
                      <p className={`text-sm mt-1 truncate ${
                        isOwnMedia ? 'text-purple-600' : 'text-green-600'
                      }`}>
                        {result.displayUrl}
                      </p>
                      <p className="text-gray-600 mt-2 text-sm">
                        {result.description || '無描述'}
                      </p>
                      {isOwnMedia && (
                        <div className="mt-2 text-xs text-purple-700 bg-purple-50 py-1 px-2 rounded-sm inline-block">
                          您的網站已在該關鍵詞排名中
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 網域分析標籤內容 */}
      {activeTab === 'categories' && (
        <DomainCategoryAnalysis results={results} />
      )}

      {/* 相關查詢標籤內容 */}
      {activeTab === 'related' && serpData.relatedQueries && serpData.relatedQueries.length > 0 && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">相關查詢</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {serpData.relatedQueries
              .filter((query, index, self) => 
                index === self.findIndex(q => q.title.toLowerCase() === query.title.toLowerCase())
              )
              .map((query, index) => (
                <a 
                  key={index} 
                  href={query.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="block p-4 border border-gray-200 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center mr-3 flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="text-blue-700">{query.title}</div>
                  </div>
                </a>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
} 