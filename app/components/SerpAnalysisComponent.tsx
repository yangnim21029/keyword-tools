import React, { useState } from 'react';

// 定義 SERP 資料結構
interface SerpResult {
  results: Array<{
    title: string;
    url: string;
    displayUrl: string;
    position: number;
    description: string;
    siteLinks: any[];
  }>;
  analysis: {
    totalResults: number;
    domains: Record<string, number>;
    topDomains: string[];
    avgTitleLength: number;
    avgDescriptionLength: number;
  };
  timestamp: string;
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

// 組件可以接受單一 SERP 結果對象或陣列
const SerpAnalysisComponent = ({ 
  data, 
  language = 'zh-TW' 
}: { 
  data: SerpResult | SerpResult[] | Record<string, SerpResult>;
  language?: string;
}) => {
  const [activeTab, setActiveTab] = useState('overview'); // 默認顯示概覽標籤
  
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
  
  // 獲取查詢關鍵詞 (嘗試從 URL 中提取)
  let searchQuery = "";
  if (results && results.length > 0 && results[0].url) {
    try {
      const url = new URL(results[0].url);
      const match = url.search.match(/[?&]q=([^&]+)/);
      if (match) {
        searchQuery = decodeURIComponent(match[1]);
      } else {
        // 如果 URL 中沒有查詢參數，嘗試從網址路徑獲取
        const pathParts = url.pathname.split('/');
        const lastPart = pathParts[pathParts.length - 1];
        if (lastPart && lastPart !== "") {
          searchQuery = decodeURIComponent(lastPart);
        }
      }
    } catch (e) {
      // URL 解析錯誤
    }
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
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            平均標題長度: {analysis.avgTitleLength || 0} 字符
          </span>
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            平均描述長度: {analysis.avgDescriptionLength || 0} 字符
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm">
            語言: {language}
          </span>
        </div>
      </div>

      {/* 標籤列 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex space-x-4" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'overview'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            概覽
          </button>
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
            onClick={() => setActiveTab('domains')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'domains'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            頂級網域分析
          </button>
        </nav>
      </div>

      {/* 概覽標籤內容 */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* 搜索結果摘要 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-2">搜索結果摘要</h3>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">總結果數:</span>
                  <span className="font-medium">{analysis.totalResults}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">平均標題長度:</span>
                  <span className={`font-medium ${evaluateTitleLength(analysis.avgTitleLength)}`}>
                    {analysis.avgTitleLength} 字符
                    <span className="text-xs ml-1">
                      (建議: ≤{standard.title.ideal})
                    </span>
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">平均描述長度:</span>
                  <span className={`font-medium ${evaluateDescriptionLength(analysis.avgDescriptionLength)}`}>
                    {analysis.avgDescriptionLength} 字符
                    <span className="text-xs ml-1">
                      (建議: ≤{standard.description.ideal})
                    </span>
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">頂級網域數:</span>
                  <span className="font-medium">{analysis.topDomains.length}</span>
                </li>
              </ul>
            </div>
            
            {/* 頂級網域 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-gray-800 mb-2">頂級網域</h3>
              <div className="space-y-2">
                {analysis.topDomains.map((domain, index) => (
                  <div key={domain} className="flex items-center">
                    <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center mr-2">
                      {index + 1}
                    </span>
                    <span className="flex-1 text-gray-700">{domain}</span>
                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                      {analysis.domains[domain] || 0} 結果
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          {/* 內容分析 */}
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-3">內容分析</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-gray-600 mb-1">
                  標題長度標準 
                  <span className="text-xs ml-1">
                    (符合率: {compliance.title}%)
                  </span>
                </p>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${compliance.title > 70 ? 'bg-green-600' : compliance.title > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${compliance.title}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-gray-700 font-medium">{analysis.avgTitleLength} / {standard.title.ideal}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  理想標題長度: ≤{standard.title.ideal} 字符, 最大: {standard.title.max} 字符
                </p>
              </div>
              
              <div>
                <p className="text-gray-600 mb-1">
                  描述長度標準
                  <span className="text-xs ml-1">
                    (符合率: {compliance.description}%)
                  </span>
                </p>
                <div className="flex items-center">
                  <div className="flex-1 bg-gray-200 rounded-full h-4">
                    <div 
                      className={`h-4 rounded-full ${compliance.description > 70 ? 'bg-green-600' : compliance.description > 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                      style={{ width: `${compliance.description}%` }}
                    ></div>
                  </div>
                  <span className="ml-2 text-gray-700 font-medium">{analysis.avgDescriptionLength} / {standard.description.ideal}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  理想描述長度: ≤{standard.description.ideal} 字符, 最大: {standard.description.max} 字符
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 搜索結果標籤內容 */}
      {activeTab === 'results' && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">
            搜索結果 (共 {results.length} 項)
          </h3>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mr-3 flex-shrink-0">
                    {result.position}
                  </div>
                  <div className="flex-1">
                    <a 
                      href={result.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-lg font-medium text-blue-600 hover:underline"
                    >
                      {result.title}
                    </a>
                    <span className={`ml-2 text-xs ${evaluateTitleLength(result.title.length)}`}>
                      ({result.title.length} 字符)
                    </span>
                    <p className="text-green-600 text-sm mt-1 truncate">
                      {result.displayUrl}
                    </p>
                    <p className="text-gray-600 mt-2 text-sm">
                      {result.description || '無描述'}
                      {result.description && (
                        <span className={`ml-2 text-xs ${evaluateDescriptionLength(result.description.length)}`}>
                          ({result.description.length} 字符)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 網域分析標籤內容 */}
      {activeTab === 'domains' && (
        <div>
          <h3 className="text-lg font-medium text-gray-800 mb-4">網域分析</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(analysis.domains).sort((a, b) => b[1] - a[1]).map(([domain, count], index) => (
              <div key={domain} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center mr-3 flex-shrink-0">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{domain}</p>
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-blue-600 h-2.5 rounded-full" 
                          style={{ width: `${(count / analysis.totalResults) * 100}%` }}
                        ></div>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {count} 結果 ({Math.round((count / analysis.totalResults) * 100)}% 佔比)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SerpAnalysisComponent; 