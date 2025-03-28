import { useState } from 'react';
import { KeywordVolumeResult } from '@/app/types';
import { getSearchVolume, getSemanticClustering } from '../app/actions';

interface KeywordResultsProps {
  suggestions: string[];
  region: string;
}

const KeywordResults: React.FC<KeywordResultsProps> = ({ suggestions, region }) => {
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [volumeData, setVolumeData] = useState<KeywordVolumeResult[]>([]);
  const [clusters, setClusters] = useState<{ [key: string]: string[] }>({});
  const [isLoadingVolume, setIsLoadingVolume] = useState(false);
  const [isLoadingClusters, setIsLoadingClusters] = useState(false);
  const [activeTab, setActiveTab] = useState<'selection' | 'volume' | 'clusters'>(
    'selection'
  );

  const toggleKeyword = (keyword: string) => {
    setSelectedKeywords(prev => 
      prev.includes(keyword) 
        ? prev.filter(k => k !== keyword)
        : [...prev, keyword]
    );
  };

  const selectAll = () => {
    setSelectedKeywords([...suggestions]);
  };

  const deselectAll = () => {
    setSelectedKeywords([]);
  };

  const fetchSearchVolume = async () => {
    if (selectedKeywords.length === 0) return;
    
    setIsLoadingVolume(true);
    try {
      const results = await getSearchVolume(selectedKeywords, region);
      if (results.results) {
        setVolumeData(results.results);
        setActiveTab('volume');
      }
    } catch (error) {
      console.error('Error fetching search volume:', error);
    } finally {
      setIsLoadingVolume(false);
    }
  };

  const fetchSemanticClusters = async () => {
    if (selectedKeywords.length < 5) {
      alert('請至少選擇5個關鍵詞進行語義聚類');
      return;
    }
    
    setIsLoadingClusters(true);
    try {
      const results = await getSemanticClustering(selectedKeywords);
      
      // Check if we should use the streaming API
      if (results.useStreamingApi) {
        // Create a new AbortController for fetch request
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds timeout
        
        try {
          // Call the streaming API endpoint
          const response = await fetch('/api/semantic-clustering', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              keywords: results.limitedKeywords || selectedKeywords.slice(0, 100) 
            }),
            signal: controller.signal,
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
          }
          
          // Handle the streaming response
          const reader = response.body?.getReader();
          let decoder = new TextDecoder();
          let receivedText = '';
          
          if (!reader) {
            throw new Error('Could not get reader from response');
          }
          
          // Read the stream
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Decode and append to our received text
            receivedText += decoder.decode(value, { stream: true });
            
            try {
              // Try to parse JSON as it comes in (it might be incomplete)
              const parsedData = JSON.parse(receivedText);
              if (parsedData.clusters) {
                setClusters(parsedData.clusters);
              }
            } catch (e) {
              // Not complete JSON yet, continue reading
              console.log('Still receiving stream data...');
            }
          }
          
          // Final decode
          receivedText += decoder.decode();
          
          try {
            // Parse the complete response
            const parsedData = JSON.parse(receivedText);
            if (parsedData.clusters) {
              setClusters(parsedData.clusters);
              setActiveTab('clusters');
            }
          } catch (e) {
            console.error('Error parsing final JSON response:', e);
            throw new Error('Error parsing JSON from streaming response');
          }
        } catch (streamError) {
          console.error('Error in streaming semantic clusters:', streamError);
          throw streamError;
        } finally {
          clearTimeout(timeoutId);
        }
      } else if (results.clusters) {
        // Fall back to the original non-streaming response
        setClusters(results.clusters);
        setActiveTab('clusters');
      }
    } catch (error) {
      console.error('Error fetching semantic clusters:', error);
    } finally {
      setIsLoadingClusters(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card bg-base-100 shadow-md">
        <div className="card-body">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <h2 className="card-title flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              關鍵詞建議 
              <span className="ml-2 badge badge-primary">{suggestions.length}</span>
            </h2>
            <div className="flex gap-2">
              <button 
                onClick={selectAll} 
                className="btn btn-outline btn-primary btn-sm"
              >
                全選
              </button>
              <button 
                onClick={deselectAll} 
                className="btn btn-outline btn-neutral btn-sm"
              >
                取消全選
              </button>
            </div>
          </div>

          <div className="tabs mb-6">
            <button 
              className={`tab tab-bordered ${activeTab === 'selection' ? 'tab-active' : ''}`}
              onClick={() => setActiveTab('selection')}
            >
              關鍵詞列表
            </button>
            {volumeData.length > 0 && (
              <button 
                className={`tab tab-bordered ${activeTab === 'volume' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('volume')}
              >
                搜尋量數據
              </button>
            )}
            {Object.keys(clusters).length > 0 && (
              <button 
                className={`tab tab-bordered ${activeTab === 'clusters' ? 'tab-active' : ''}`}
                onClick={() => setActiveTab('clusters')}
              >
                語義聚類
              </button>
            )}
          </div>

          {/* Keyword Selection View */}
          {activeTab === 'selection' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {suggestions.map((suggestion, index) => (
                  <div 
                    key={index} 
                    className={`border rounded-lg p-3 cursor-pointer hover:bg-base-200 transition-colors flex items-center ${
                      selectedKeywords.includes(suggestion) ? 'bg-primary/10 border-primary/30' : 'border-base-300'
                    }`}
                    onClick={() => toggleKeyword(suggestion)}
                  >
                    <input 
                      type="checkbox" 
                      className="checkbox checkbox-sm mr-3" 
                      checked={selectedKeywords.includes(suggestion)}
                      onChange={() => {}} // Handled by parent div click
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="font-medium">{suggestion}</span>
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="w-full bg-base-200 p-4 rounded-lg mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold">已選關鍵詞</span>
                    <span className="badge badge-primary">{selectedKeywords.length}</span>
                  </div>
                  {selectedKeywords.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {selectedKeywords.map((keyword, idx) => (
                        <span key={idx} className="badge badge-lg gap-1">
                          {keyword}
                          <button 
                            className="hover:text-error" 
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleKeyword(keyword);
                            }}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm opacity-70">尚未選擇關鍵詞</p>
                  )}
                </div>

                {isLoadingVolume ? (
                  <div className="flex justify-center items-center h-32">
                    <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                    <span>獲取搜尋量數據中...</span>
                  </div>
                ) : null}
                
                <div className="flex flex-wrap gap-3 mt-4">
                  <button 
                    onClick={fetchSearchVolume}
                    disabled={isLoadingVolume || selectedKeywords.length === 0}
                    className={`btn btn-primary ${isLoadingVolume ? 'btn-disabled' : ''}`}
                  >
                    {isLoadingVolume ? (
                      <span className="flex items-center">
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        處理中...
                      </span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3m0 0l3 3m-3-3v12m6-6l3 3m0 0l3-3m-3 3V6" />
                        </svg>
                        取得搜尋量
                      </>
                    )}
                  </button>
                  
                  <button 
                    onClick={fetchSemanticClusters}
                    disabled={isLoadingClusters || selectedKeywords.length < 5}
                    className={`btn btn-secondary ${isLoadingClusters ? 'btn-disabled' : ''}`}
                  >
                    {isLoadingClusters ? (
                      <span className="flex items-center">
                        <span className="loading loading-spinner loading-sm mr-2"></span>
                        分析中...
                      </span>
                    ) : (
                      <>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                        </svg>
                        語義聚類分析
                      </>
                    )}
                  </button>
                </div>
                
                {selectedKeywords.length > 0 && selectedKeywords.length < 5 && (
                  <p className="text-sm text-amber-600 mt-2 w-full flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    語義聚類需要至少選擇 5 個關鍵詞
                  </p>
                )}
              </div>
            </>
          )}

          {/* Volume Data Results */}
          {activeTab === 'volume' && volumeData.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">關鍵詞</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">月搜尋量</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">競爭程度</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">競爭指數</th>
                    <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">平均CPC</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {volumeData.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.text}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.searchVolume ? (
                          <span className="font-semibold text-indigo-600">{item.searchVolume.toLocaleString()}</span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.competition && (
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            item.competition === '低' ? 'bg-green-100 text-green-800' : 
                            item.competition === '中' ? 'bg-yellow-100 text-yellow-800' : 
                            'bg-red-100 text-red-800'
                          }`}>
                            {item.competition}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.competitionIndex ? (
                          <div className="flex items-center justify-center">
                            <div className="w-16 bg-gray-200 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${
                                  item.competitionIndex < 33 ? 'bg-green-500' : 
                                  item.competitionIndex < 66 ? 'bg-yellow-500' : 
                                  'bg-red-500'
                                }`}
                                style={{ width: `${item.competitionIndex}%` }}
                              ></div>
                            </div>
                            <span className="ml-2 text-gray-700">{Math.round(item.competitionIndex)}%</span>
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        {item.cpc ? (
                          <span className="font-semibold text-emerald-600">${item.cpc.toFixed(2)}</span>
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-gray-500 mt-4">
                <span className="font-bold">資料來源：</span> Google Ads API
              </p>
            </div>
          )}

          {/* Clusters Results */}
          {activeTab === 'clusters' && Object.keys(clusters).length > 0 && (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {Object.entries(clusters).map(([clusterName, keywords], index) => (
                  <div key={index} className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow transition-shadow">
                    <div className="p-5">
                      <h4 className="flex items-center mb-3">
                        <div className="bg-indigo-100 text-indigo-800 text-xs font-semibold h-6 w-6 rounded-full flex items-center justify-center mr-2">{index + 1}</div>
                        <span className="text-lg font-bold text-gray-900">{clusterName}</span>
                      </h4>
                      <div className="border-t border-gray-200 my-3"></div>
                      <div className="flex flex-wrap gap-2">
                        {keywords.map((keyword, kidx) => (
                          <span key={kidx} className="px-3 py-1 bg-gray-100 text-gray-800 text-sm rounded-full">{keyword}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-500 mt-6">
                <span className="font-bold">聚類方法：</span> 基於 OpenAI 的語義相似度分析
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KeywordResults; 