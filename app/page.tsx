'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { getKeywordSuggestions, getRegions, getSearchVolume, getSemanticClustering, getUrlSuggestions, getFirebaseStats, getSerpAnalysis } from './actions';
import { SuggestionsResult, SearchVolumeResult, KeywordVolumeResult, SerpAnalysisResult } from '@/app/types';
import SearchHistory from './components/SearchHistory';
import SerpAnalysisComponent from './components/SerpAnalysisComponent';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'keyword' | 'url' | 'settings' | 'serp'>('keyword');
  const [query, setQuery] = useState('');
  const [url, setUrl] = useState('');
  const [region, setRegion] = useState('HK'); // 默認香港
  const [language, setLanguage] = useState('zh-TW');
  const [regions, setRegions] = useState<Record<string, string>>({});
  const [languages, setLanguages] = useState<Record<string, string>>({});
  const [suggestions, setSuggestions] = useState<SuggestionsResult>({ suggestions: [], estimatedProcessingTime: 0 });
  const [volumeData, setVolumeData] = useState<SearchVolumeResult>({ results: [], processingTime: { estimated: 0, actual: 0 } });
  const [clusters, setClusters] = useState<any>(null);
  const [serpResults, setSerpResults] = useState<SerpAnalysisResult | null>(null);
  const [serpKeywords, setSerpKeywords] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState('');
  const [step, setStep] = useState<'input' | 'suggestions' | 'volumes' | 'clusters'>('input');
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  
  // 設定選項
  const [useAlphabet, setUseAlphabet] = useState(false);
  const [useSymbols, setUseSymbols] = useState(false);
  const [filterZeroVolume, setFilterZeroVolume] = useState(true);
  const [maxResults, setMaxResults] = useState(40);
  
  // 搜索历史侧边栏相关状态
  const [sidebarMounted, setSidebarMounted] = useState(false);
  const searchHistoryContainerRef = useRef<Element | null>(null);

  // 獲取可用地區
  useEffect(() => {
    async function fetchRegions() {
      try {
        const { regions, languages } = await getRegions();
        setRegions(regions);
        setLanguages(languages || {});
      } catch (error) {
        console.error('Error fetching regions:', error);
      }
    }
    fetchRegions();
    
    // 查找侧边栏容器并设置 ref
    const sidebarContainer = document.getElementById('search-history-container');
    if (sidebarContainer) {
      searchHistoryContainerRef.current = sidebarContainer;
      setSidebarMounted(true);
    }
  }, []);

  // 处理从历史记录中加载数据
  const handleSelectHistory = (historyDetail: any) => {
    if (!historyDetail) return;
    
    // 加载历史记录中的数据
    setQuery(historyDetail.mainKeyword);
    setRegion(historyDetail.region);
    setLanguage(historyDetail.language);
    
    // 设置建议和搜索量数据
    if (historyDetail.suggestions?.length > 0) {
      setSuggestions({
        suggestions: historyDetail.suggestions,
        estimatedProcessingTime: 0,
        fromCache: true
      });
      setStep('suggestions');
    }
    
    if (historyDetail.searchResults?.length > 0) {
      setVolumeData({
        results: historyDetail.searchResults,
        processingTime: { estimated: 0, actual: 0 },
        fromCache: true
      });
      setStep('volumes');
    }
  };

  // 搜索關鍵詞建議
  const handleGetSuggestions = async () => {
    if (activeTab === 'keyword' && !query.trim()) {
      alert('請輸入關鍵詞');
      return;
    }
    
    if (activeTab === 'url' && !url.trim()) {
      alert('請輸入網址');
      return;
    }
    
    setIsLoading(true);
    setLoadingText(activeTab === 'keyword' ? '獲取關鍵詞建議中...' : '分析URL中...');
    setSuggestions({ suggestions: [], estimatedProcessingTime: 0 });
    setVolumeData({ results: [], processingTime: { estimated: 0, actual: 0 } });
    setClusters(null);
    setStep('input');
    
    try {
      let result;
      
      if (activeTab === 'keyword') {
        result = await getKeywordSuggestions(
          query, 
          region, 
          language, 
          useAlphabet,
          useSymbols
        );
      } else {
        result = await getUrlSuggestions({
          url,
          region,
          language
        });
      }
      
      setSuggestions(result);
      setEstimatedTime(result.estimatedProcessingTime || 0);
      setStep('suggestions');
      
      // 显示数据来源信息
      console.log(`資料來源: ${result.fromCache ? '緩存' : 'API'}`);
      if (result.fromCache) {
        // 如果数据来自缓存，可以显示一个提示
        alert('資料已從緩存中快速加載');
      }
    } catch (error) {
      console.error('搜索失敗:', error);
      alert('搜索失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // 獲取搜索量數據
  const handleGetVolumes = async () => {
    if (suggestions.suggestions.length === 0) {
      alert('沒有可用的關鍵詞建議');
      return;
    }
    
    setIsLoading(true);
    setLoadingText(`獲取搜索量數據中...\n預估需時：${estimatedTime} 秒`);
    
    try {
      // 使用與原始 app.py 相同的方式處理批量請求
      const mainKeyword = activeTab === 'keyword' ? query : url;
      const result = await getSearchVolume(suggestions.suggestions, region, mainKeyword, language);
      
      // 按搜索量降序排序，與 app.py 中的邏輯一致
      let sortedResults = [...result.results].sort((a, b) => b.searchVolume - a.searchVolume);
      
      // 根據設定過濾零搜索量
      if (filterZeroVolume) {
        sortedResults = sortedResults.filter(item => item.searchVolume > 0);
      }
      
      // 限制結果數量
      if (maxResults > 0 && sortedResults.length > maxResults) {
        sortedResults = sortedResults.slice(0, maxResults);
      }
      
      setVolumeData({
        ...result,
        results: sortedResults
      });
      setStep('volumes');
      
      // 如果有處理時間資訊，更新估計時間
      if (result.processingTime && result.processingTime.actual) {
        console.log(`實際處理時間: ${result.processingTime.actual} 秒 (預估: ${result.processingTime.estimated} 秒)`);
      }
      
      // 显示数据来源信息
      console.log(`搜索量數據來源: ${result.fromCache ? '緩存' : 'API'}`);
      if (result.fromCache) {
        // 如果数据来自缓存，可以显示一个提示
        alert('搜索量數據已從緩存中快速加載');
      }
    } catch (error) {
      console.error('獲取搜索量失敗:', error);
      alert('獲取搜索量失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // 生成語意分群
  const handleClustering = async () => {
    if (volumeData.results.length < 5) {
      alert('至少需要 5 個關鍵詞才能進行分群');
      return;
    }
    
    setIsLoading(true);
    setLoadingText('進行語意分群中...');
    setClusters(null);
    
    try {
      // 獲取關鍵詞文本
      const keywords = volumeData.results.map(item => item.text);
      
      // 直接調用 API 端點，而不是使用 server action
      const response = await fetch('/api/semantic-clustering', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ keywords }),
      });
      
      if (!response.ok) {
        throw new Error(`API 請求失敗: ${response.status}`);
      }
      
      // 處理流式回應
      const responseBody = response.body;
      if (!responseBody) {
        throw new Error('API 回應沒有 body');
      }
      
      const reader = responseBody.getReader();
      const decoder = new TextDecoder();
      let result = '';
      
      // 更新讀取狀態以顯示流式處理進度
      setLoadingText('接收 AI 分群結果中...');
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解碼接收到的數據塊
        const chunk = decoder.decode(value, { stream: true });
        result += chunk;
        
        // 嘗試解析部分 JSON，並在 UI 中顯示進度
        try {
          // 純粹的 text/event-stream 中尋找有效的 JSON
          const jsonData = JSON.parse(result);
          if (jsonData.clusters) {
            // 更新加載狀態以顯示有多少類別已經收到
            setLoadingText(`已收到 ${Object.keys(jsonData.clusters).length} 個主題分類...`);
          }
        } catch (e) {
          // 繼續收集數據直到有一個完整的 JSON
        }
      }
      
      // 當流完成時，解析最終結果
      try {
        const jsonData = JSON.parse(result);
        setClusters(jsonData);
        setStep('clusters');
      } catch (e) {
        console.error('無法解析分群結果:', e);
        throw new Error('解析語意分群回應時出錯');
      }
    } catch (error) {
      console.error('Error clustering:', error);
      alert('分群失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  // 分析 SERP 結果
  const handleSerpAnalysis = async () => {
    if (!serpKeywords.trim()) {
      alert('請輸入要分析的關鍵詞');
      return;
    }
    
    // 將輸入的關鍵詞文本分割成數組
    const keywordList = serpKeywords
      .split('\n')
      .map(k => k.trim())
      .filter(k => k.length > 0);
    
    if (keywordList.length === 0) {
      alert('請輸入至少一個有效的關鍵詞');
      return;
    }
    
    if (keywordList.length > 10) {
      alert('一次最多只能分析 10 個關鍵詞');
      return;
    }
    
    setIsLoading(true);
    setLoadingText('分析 SERP 結果中...');
    setSerpResults(null);
    
    try {
      const results = await getSerpAnalysis(keywordList, region, language, 10);
      setSerpResults(results);
      console.log('SERP 分析結果:', results);
      
      // 更新提示訊息以顯示實際處理的關鍵詞數量
      const inputCount = keywordList.length;
      const actualCount = results.totalKeywords || Object.keys(results.results).length;
      
      let message = `已分析 ${actualCount} 個關鍵詞的 SERP 結果`;
      if (results.fromCache) {
        message += ' (來自緩存)';
      }
      
      // 如果實際處理數量與輸入數量不同，添加說明
      if (inputCount !== actualCount) {
        message += `\n注意：您輸入了 ${inputCount} 個關鍵詞，但只有 ${actualCount} 個成功獲取結果`;
      }
      
      alert(message);
    } catch (error) {
      console.error('SERP 分析失敗:', error);
      alert('SERP 分析失敗，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 将搜索历史组件渲染到侧边栏 */}
      {sidebarMounted && searchHistoryContainerRef.current && 
        createPortal(
          <SearchHistory onSelectHistory={handleSelectHistory} />,
          searchHistoryContainerRef.current
        )
      }
      
      <main className="container mx-auto p-4">      
        {/* 載入覆蓋層 */}
        {isLoading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <div className="mb-4">
                <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              </div>
              <p>{loadingText}</p>
              {estimatedTime > 0 && (
                <p className="mt-2 text-sm text-gray-500">預估處理時間: {estimatedTime} 秒</p>
              )}
            </div>
          </div>
        )}
        
        {/* 頂部選項卡 */}
        <div className="border-b mb-6">
          <div className="flex">
            <button 
              onClick={() => setActiveTab('keyword')} 
              className={`px-4 py-3 ${activeTab === 'keyword' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-t-lg mr-1`}
            >
              關鍵詞搜索
            </button>
            <button 
              onClick={() => setActiveTab('url')} 
              className={`px-4 py-3 ${activeTab === 'url' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-t-lg mr-1`}
            >
              URL 分析
            </button>
            <button 
              onClick={() => setActiveTab('serp')} 
              className={`px-4 py-3 ${activeTab === 'serp' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-t-lg mr-1`}
            >
              SERP 分析
            </button>
            <button 
              onClick={() => setActiveTab('settings')} 
              className={`px-4 py-3 ${activeTab === 'settings' ? 'bg-blue-500 text-white' : 'bg-gray-100'} rounded-t-lg`}
            >
              設定選項
            </button>
          </div>
        </div>
        
        {/* 表單區域 */}
        <div className="mb-6">
          {/* 關鍵詞搜索面板 */}
          {activeTab === 'keyword' && (
            <div>
              <div className="mb-4">
                <label className="block mb-2">主要關鍵詞</label>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="輸入關鍵詞"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2">地區</label>
                  <select 
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(regions).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2">語言</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(languages).length > 0 ? (
                      Object.entries(languages).map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))
                    ) : (
                      <>
                        <option value="zh-TW">繁體中文 (zh-TW)</option>
                        <option value="zh-CN">簡體中文 (zh-CN)</option>
                        <option value="en">英文 (en)</option>
                        <option value="ms">馬來文 (ms)</option>
                        <option value="ko">韓文 (ko)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <button 
                  onClick={handleGetSuggestions}
                  disabled={isLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                >
                  獲取建議
                </button>
              </div>
            </div>
          )}
          
          {/* URL 分析面板 */}
          {activeTab === 'url' && (
            <div>
              <div className="mb-4">
                <label className="block mb-2">網址</label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="輸入URL (例如: https://example.com)"
                  className="w-full p-2 border border-gray-300 rounded"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2">地區</label>
                  <select 
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(regions).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2">語言</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(languages).length > 0 ? (
                      Object.entries(languages).map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))
                    ) : (
                      <>
                        <option value="zh-TW">繁體中文 (zh-TW)</option>
                        <option value="zh-CN">簡體中文 (zh-CN)</option>
                        <option value="en">英文 (en)</option>
                        <option value="ms">馬來文 (ms)</option>
                        <option value="ko">韓文 (ko)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <button 
                  onClick={handleGetSuggestions}
                  disabled={isLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded"
                >
                  分析 URL
                </button>
              </div>
            </div>
          )}
          
          {/* SERP 分析面板 */}
          {activeTab === 'serp' && (
            <div>
              <div className="mb-4">
                <label className="block mb-2">輸入關鍵詞（每行一個，最多10個）</label>
                <textarea
                  value={serpKeywords}
                  onChange={(e) => setSerpKeywords(e.target.value)}
                  placeholder="輸入要分析的關鍵詞，每行一個"
                  className="w-full p-2 border border-gray-300 rounded h-40"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block mb-2">地區</label>
                  <select 
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(regions).map(([name, code]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block mb-2">語言</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded"
                  >
                    {Object.entries(languages).length > 0 ? (
                      Object.entries(languages).map(([code, name]) => (
                        <option key={code} value={code}>{name} ({code})</option>
                      ))
                    ) : (
                      <>
                        <option value="zh-TW">繁體中文 (zh-TW)</option>
                        <option value="zh-CN">簡體中文 (zh-CN)</option>
                        <option value="en">英文 (en)</option>
                        <option value="ms">馬來文 (ms)</option>
                        <option value="ko">韓文 (ko)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>
              
              <div className="mb-4">
                <button 
                  onClick={handleSerpAnalysis}
                  disabled={isLoading}
                  className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded"
                >
                  分析 SERP 結果
                </button>
              </div>
            </div>
          )}
          
          {/* 設定選項面板 */}
          {activeTab === 'settings' && (
            <div className="p-6 border border-gray-200 rounded-lg bg-white shadow-sm mb-4">
              <h3 className="text-xl font-semibold mb-6">搜索設定選項</h3>
              
              <div className="mb-8">
                <h4 className="text-base font-medium text-gray-700 mb-4">關鍵詞搜索設定</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <input
                        type="checkbox"
                        id="useAlphabet"
                        checked={useAlphabet}
                        onChange={(e) => setUseAlphabet(e.target.checked)}
                        className="w-5 h-5 accent-blue-500"
                      />
                    </div>
                    <label htmlFor="useAlphabet" className="text-gray-700">
                      使用英文字母輔助搜索 (a-z)
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <div className="mr-3">
                      <input
                        type="checkbox"
                        id="useSymbols"
                        checked={useSymbols}
                        onChange={(e) => setUseSymbols(e.target.checked)}
                        className="w-5 h-5 accent-blue-500"
                      />
                    </div>
                    <label htmlFor="useSymbols" className="text-gray-700">
                      使用特殊符號輔助搜索
                    </label>
                  </div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-base font-medium text-gray-700 mb-4">搜索結果設定</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <input
                        type="checkbox"
                        id="filterZeroVolume"
                        checked={filterZeroVolume}
                        onChange={(e) => setFilterZeroVolume(e.target.checked)}
                        className="w-5 h-5 accent-blue-500"
                      />
                    </div>
                    <label htmlFor="filterZeroVolume" className="text-gray-700">
                      過濾零搜索量的關鍵詞
                    </label>
                  </div>
                  
                  <div className="flex items-center">
                    <label htmlFor="maxResults" className="text-gray-700 w-40">
                      最大顯示結果數:
                    </label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        id="maxResults"
                        value={maxResults}
                        onChange={(e) => setMaxResults(parseInt(e.target.value) || 0)}
                        min="0"
                        max="1000"
                        className="w-28 p-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-500 text-sm ml-3">(0 表示不限制)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* 關鍵詞建議區塊 */}
        {suggestions.suggestions.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">關鍵詞建議</h2>
              <div className="flex items-center gap-2">
                {estimatedTime > 0 && (
                  <span className="text-gray-500 text-sm">預估處理時間: {estimatedTime} 秒</span>
                )}
                <button
                  onClick={handleGetVolumes}
                  className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                >
                  獲取搜索量
                </button>
              </div>
            </div>
            <p className="mb-2">
              找到 {suggestions.suggestions.length} 個關鍵詞建議
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                {step === 'suggestions' && '資料已從' + (suggestions.fromCache ? '緩存' : 'API') + '加載'}
              </span>
            </p>
            <div className="overflow-auto max-h-80 border rounded">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-4 py-2 text-left">#</th>
                    <th className="border px-4 py-2 text-left">關鍵詞</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.suggestions.map((suggestion, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="border px-4 py-2">{index + 1}</td>
                      <td className="border px-4 py-2">{suggestion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* 搜索量數據表格 */}
        {volumeData.results.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-bold">搜索量數據</h2>
              <button
                onClick={handleClustering}
                className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded"
              >
                生成語意分群
              </button>
            </div>
            <p className="mb-2">
              找到 {volumeData.results.length} 個關鍵詞的搜索量數據
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                {step === 'volumes' && '資料已從' + (volumeData.fromCache ? '緩存' : 'API') + '加載'}
              </span>
            </p>
            <div className="overflow-auto max-h-80 border rounded">
              <table className="min-w-full border-collapse">
                <thead className="bg-gray-100 sticky top-0">
                  <tr>
                    <th className="border px-4 py-2 text-left">#</th>
                    <th className="border px-4 py-2 text-left">關鍵詞</th>
                    <th className="border px-4 py-2 text-left">月搜索量</th>
                    <th className="border px-4 py-2 text-left">競爭程度</th>
                    <th className="border px-4 py-2 text-left">競爭指數</th>
                    <th className="border px-4 py-2 text-left">CPC (點擊價格)</th>
                  </tr>
                </thead>
                <tbody>
                  {volumeData.results.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-gray-50' : ''}>
                      <td className="border px-4 py-2">{index + 1}</td>
                      <td className="border px-4 py-2">{item.text}</td>
                      <td className="border px-4 py-2">{item.searchVolume}</td>
                      <td className="border px-4 py-2">{item.competition}</td>
                      <td className="border px-4 py-2">
                        {typeof item.competitionIndex === 'number' 
                          ? item.competitionIndex.toFixed(2) 
                          : (item.competitionIndex || '-')}
                      </td>
                      <td className="border px-4 py-2">
                        {typeof item.cpc === 'number' 
                          ? `$${item.cpc.toFixed(2)}` 
                          : (item.cpc || '-')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* 語意分群結果 */}
        {clusters && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-2">語意分群結果</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(clusters.clusters).map(([clusterName, keywords], index) => (
                <div key={index} className="border rounded p-4">
                  <h3 className="font-bold mb-2">{clusterName}</h3>
                  <ul className="list-disc list-inside">
                    {(keywords as string[]).map((keyword, idx) => (
                      <li key={idx}>{keyword}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* SERP 分析結果 */}
        {serpResults && activeTab === 'serp' && (
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4">SERP 分析結果</h2>
            
            {serpResults.results && Object.keys(serpResults.results).length > 0 ? (
              <>
                <div className="mb-4 p-2 bg-gray-100 rounded text-xs overflow-auto">
                  <strong>調試信息:</strong> 找到 {Object.keys(serpResults.results).length} 個關鍵詞的 SERP 結果
                  {serpResults.fromCache && " (來自緩存)"}
                </div>
                
                <SerpAnalysisComponent data={serpResults.results} language={language} />
              </>
            ) : (
              <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg">
                無法獲取SERP分析數據。請確保您的關鍵詞有效並嘗試再次分析。
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}