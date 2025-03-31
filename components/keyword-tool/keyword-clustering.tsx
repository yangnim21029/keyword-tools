'use client';

import { saveHistoryClusteringResults } from '@/app/actions';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHistoryStore } from '@/store/historyStore';
import { useSearchStore } from '@/store/searchStore';
import { BarChart2, Check, Copy, LayoutGrid, Sparkles } from "lucide-react";
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// 直接從store和全局環境獲取數據而不是props
export default function KeywordClustering() {
  // 狀態管理
  const [isClustering, setIsClustering] = useState<boolean>(false);
  const [clusteringText, setClusteringText] = useState<string>("");
  const [clusters, setClusters] = useState<Record<string, string[]> | null>(null);
  const [copiedClusterIndex, setCopiedClusterIndex] = useState<number | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>("gpt-4");

  // 從store獲取狀態和操作
  const setGlobalLoading = useSearchStore(state => state.actions.setLoading);
  
  const historyState = useHistoryStore(store => store.state);
  const historyActions = useHistoryStore(store => store.actions);
  
  const selectedHistoryDetail = historyState.selectedHistoryDetail;
  const historyId = selectedHistoryDetail?.id;
  
  // 使用本地狀態保存關鍵詞列表
  const [keywords, setKeywords] = useState<string[]>([]);
  
  // 從 sessionStorage 獲取關鍵詞搜索量數據
  const [volumeData, setVolumeData] = useState<Record<string, number>>({});
  
  // 在組件加載時從session storage獲取關鍵詞或從歷史記錄中獲取
  useEffect(() => {
    try {
      // 重置狀態
      setIsClustering(false);
      setClusteringText("");
      
      // 優先從當前歷史記錄中獲取
      if (selectedHistoryDetail) {
        // 檢查是否有 clusters 數據
        if (selectedHistoryDetail.clusters && Object.keys(selectedHistoryDetail.clusters).length > 0) {
          setClusters(selectedHistoryDetail.clusters);
        } else {
          // 如果歷史記錄中沒有 clusters 數據，則重置 clusters
          setClusters(null);
        }
        
        // 從歷史記錄中獲取關鍵詞（首先檢查 searchResults）
        if (selectedHistoryDetail.searchResults && Array.isArray(selectedHistoryDetail.searchResults)) {
          const keywordsFromResults = selectedHistoryDetail.searchResults
            .map((item: any) => item.text || '')
            .filter(Boolean);
          
          if (keywordsFromResults.length > 0) {
            setKeywords(keywordsFromResults);
            return;
          }
        }
        
        // 如果 searchResults 中沒有關鍵詞，嘗試從 suggestions 獲取
        if (selectedHistoryDetail.suggestions && Array.isArray(selectedHistoryDetail.suggestions)) {
          if (selectedHistoryDetail.suggestions.length > 0) {
            setKeywords(selectedHistoryDetail.suggestions);
            return;
          }
        }
      } else {
        // 清空聚類結果，如果沒有選中任何歷史記錄
        setClusters(null);
        setKeywords([]);
      }
      
      // 後備選項：從 session storage 中獲取
      if (typeof window !== 'undefined') {
        const storedKeywords = sessionStorage.getItem('clustering-keywords');
        if (storedKeywords) {
          setKeywords(JSON.parse(storedKeywords));
        }
      }
    } catch (error) {
      console.error('獲取關鍵詞或聚類結果失敗:', error);
      setClusters(null);
      setKeywords([]);
    }
  }, [selectedHistoryDetail]);
  
  // 從 sessionStorage 獲取關鍵詞搜索量數據
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        const storedVolumeData = sessionStorage.getItem('keyword-volume-data');
        if (storedVolumeData) {
          // 直接解析並優化數據存儲
          const parsedData = JSON.parse(storedVolumeData);
          // 一次性創建映射，避免多次轉換
          const volumeMap: Record<string, number> = {};
          
          for (const item of parsedData) {
            if (item.text) {
              // 直接使用數字類型，避免重複轉換
              const key = item.text.toLowerCase();
              const volumeValue = typeof item.searchVolume === 'number' 
                ? item.searchVolume  // 如果已經是數字，直接使用
                : item.searchVolume
                  ? Number(item.searchVolume) // 只在需要時轉換
                  : 0; // 對於null/undefined等情況，默認為0
              
              volumeMap[key] = isNaN(volumeValue) ? 0 : volumeValue;
            }
          }
          
          setVolumeData(volumeMap);
          console.log('Volume data loaded efficiently:', Object.keys(volumeMap).length, 'keywords');
        } else {
          // 如果沒有存儲的數據，清空 volumeData
          setVolumeData({});
        }
      }
    } catch (error) {
      console.error('獲取搜索量數據失敗:', error);
      setVolumeData({});
    }
  }, [selectedHistoryDetail]); // 添加 selectedHistoryDetail 作為依賴項
  
  // 計算群組總搜索量 - 優化性能
  const calculateClusterTotalVolume = (keywords: string[]): number => {
    if (!keywords || keywords.length === 0) return 0;
    
    let total = 0;
    // 使用for循環替代reduce，減少函數調用開銷
    for (let i = 0; i < keywords.length; i++) {
      const keyword = keywords[i].toLowerCase();
      total += volumeData[keyword] || 0;
    }
    return total;
  };
  
  // 生成分群背景色
  const getClusterBgColor = (index: number, totalVolume: number) => {
    // 基礎顏色數組
    const colorClasses = [
      "bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20",
      "bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20",
      "bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20",
      "bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20",
      "bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-900/20",
      "bg-cyan-50 dark:bg-cyan-900/10 border border-cyan-100 dark:border-cyan-900/20",
      "bg-lime-50 dark:bg-lime-900/10 border border-lime-100 dark:border-lime-900/20",
      "bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-900/20",
      "bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20",
      "bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-900/20",
    ];
    
    // 根據搜索量添加強調樣式
    let emphasis = "";
    if (totalVolume > 5000) {
      emphasis = "ring-2 ring-offset-1 ring-blue-300 dark:ring-blue-700 shadow-md";
    } else if (totalVolume > 1000) {
      emphasis = "ring-1 ring-offset-1 ring-blue-200 dark:ring-blue-800 shadow-sm";
    }
    
    return `${colorClasses[index % colorClasses.length]} ${emphasis}`;
  };

  // 處理保存聚類結果到歷史記錄 - 直接傳入要保存的聚類結果
  const handleSaveToHistory = async (clustersToSave: Record<string, string[]>) => {
    // 確保historyId存在且有效
    if (!historyId || typeof historyId !== 'string' || historyId.trim() === '') {
      console.error('無法保存聚類：historyId無效', historyId);
      return;
    }
    
    // 確保有聚類結果
    if (!clustersToSave || Object.keys(clustersToSave).length === 0) {
      console.error('無法保存聚類：缺少聚類結果或聚類結果為空');
      return;
    }
    
    setGlobalLoading(true, '正在保存聚類結果...');
    
    try {
      // 使用 server action 保存聚類結果並重置緩存
      const result = await saveHistoryClusteringResults(historyId, clustersToSave);
      
      if (!result.success) {
        throw new Error(result.error || '保存聚類結果失敗');
      }
      
      // 刷新歷史記錄列表
      await historyActions.fetchHistories();
      
      // 不需要顯式重置緩存，server action 已經處理了
    } catch (err) {
      console.error('保存聚類結果失敗:', err);
    } finally {
      setGlobalLoading(false);
    }
  };

  const handleClustering = async () => {
    // 確保有足夠的關鍵詞
    if (!keywords.length || keywords.length < 5) {
      alert("需要至少5個關鍵詞才能進行語意分群");
      return;
    }
    
    // 重置狀態
    setIsClustering(true);
    setClusteringText("");
    setClusters(null);
    
    // 設置全局加載狀態
    setGlobalLoading(true, '正在進行語意分群...');
    
    // 設置請求超時控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      alert('語意分群請求超時 (60秒)');
      setIsClustering(false);
      setGlobalLoading(false);
    }, 60000);
    
    try {
      // 更新進度提示
      setClusteringText('請求 AI 分群中...');
      
      // 調用 API
      const response = await fetch('/api/semantic-clustering', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          keywords: keywords.slice(0, 80),
          historyId: historyId,
          model: selectedModel
        }),
        signal: controller.signal,
      });
      
      // 檢查響應狀態
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`伺服器錯誤 ${response.status}: ${errorText || response.statusText}`);
      }
      
      if (!response.body) {
        throw new Error('無法讀取伺服器回應流');
      }
      
      // 處理流式響應
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let receivedText = '';
      
      setClusteringText(prev => prev + '接收 AI 分群結果...');
      
      // 讀取流
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解碼並添加到接收的文本
        receivedText += decoder.decode(value, { stream: true });
        setClusteringText(receivedText); // 仍然更新文本但不顯示
        
        // 嘗試提前解析結果
        try {
          const parsedData = JSON.parse(receivedText);
          if (parsedData.clusters) {
            setClusters(parsedData.clusters);
          }
        } catch (e) {
          // JSON 尚未完成，繼續讀取
        }
      }
      
      // 確保最終解碼完成
      receivedText += decoder.decode();
      setClusteringText(receivedText);
      
      // 解析最終結果
      setClusteringText(prev => prev + '\n解析分群結果...');
      
      try {
        const finalJsonResult = JSON.parse(receivedText);
        
        if (finalJsonResult && finalJsonResult.clusters && Object.keys(finalJsonResult.clusters).length > 0) {
          setClusters(finalJsonResult.clusters);
          
          // 更新完成提示（僅內部記錄）
          setClusteringText(prev => 
            prev + `\n✅ 分群完成！成功創建 ${Object.keys(finalJsonResult.clusters).length} 個分群。`
          );
          
          // 自動保存到歷史記錄
          if (historyId && typeof historyId === 'string' && historyId.trim() !== '') {
            await handleSaveToHistory(finalJsonResult.clusters);
            
            // 重新選擇當前歷史記錄 ID，這會觸發重新獲取詳情
            if (historyActions.setSelectedHistoryId) {
              historyActions.setSelectedHistoryId(historyId);
            }
          }
        } else if (finalJsonResult && finalJsonResult.error) {
          alert(`聚類失敗: ${finalJsonResult.message || finalJsonResult.error}`);
          setClusters(null);
        } else {
          alert('聚類結果格式不正確或未包含有效分群');
          setClusters(null);
        }
      } catch (parseError) {
        alert('聚類結果格式錯誤，請檢查響應數據');
        setClusters(null);
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // 超時錯誤已被處理
      } else {
        alert(`語意分群失敗: ${error.message || '未知錯誤'}`);
      }
      setClusters(null);
    } finally {
      clearTimeout(timeoutId);
      setIsClustering(false);
      setGlobalLoading(false);
    }
  };

  // 複製關鍵詞到剪貼板
  const copyKeywords = (keywordsToCopy: string[], index: number) => {
    if (!Array.isArray(keywordsToCopy)) {
      console.error('Keywords to copy is not an array:', keywordsToCopy);
      return;
    }
    
    try {
      // 將關鍵詞數組轉換為每行一個關鍵詞的字符串
      const keywordsText = keywordsToCopy.join('\n');
      navigator.clipboard.writeText(keywordsText);
      
      // 設置複製狀態，用於顯示視覺反饋
      setCopiedClusterIndex(index);
      
      // 3秒後重置複製狀態
      setTimeout(() => {
        setCopiedClusterIndex(null);
      }, 3000);
    } catch (err) {
      console.error('Failed to copy keywords: ', err);
    }
  };

  const renderClusterLabel = (clusterName: string, keywordList: string[], index: number) => {
    const totalVolume = calculateClusterTotalVolume(keywordList);
    // 直接使用數字不進行格式化，提高性能
    const formattedVolume = totalVolume > 0 ? totalVolume : '無數據'; 
    
    return (
      <div className="flex flex-col gap-1 w-full">
        <div className="flex justify-between items-start">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1">
            群組 {index + 1}: {clusterName}
          </div>
          <div>
            {totalVolume > 0 && (
              <Badge variant="outline" className={`ml-2 ${
                totalVolume > 5000 
                  ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800/60 text-green-700 dark:text-green-400'
                  : totalVolume > 1000
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-400'
                    : 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-800/60 text-gray-700 dark:text-gray-400'
              }`}>
                <BarChart2 className="w-3 h-3 mr-1 inline" />
                {formattedVolume}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {keywordList.length} 個關鍵詞
        </div>
      </div>
    );
  };

  // 支持默認顯示所有關鍵詞，始終保持展開狀態
  const renderClusterCard = (clusterName: string, keywordList: string[], index: number) => {
    // 按搜索量排序關鍵詞，使用for循環優化排序
    const keywordsWithVolume = keywordList.map(keyword => ({
      text: keyword,
      volume: volumeData[keyword.toLowerCase()] || 0
    }));
    
    // 使用更高效的排序
    keywordsWithVolume.sort((a, b) => b.volume - a.volume);
    
    // 提取排序後的關鍵詞，顯示所有關鍵詞
    const sortedKeywords = keywordsWithVolume.map(item => item.text);
    const totalVolume = calculateClusterTotalVolume(keywordList);
    
    return (
      <div className="w-full">
        <div className={`p-6 rounded-lg shadow-md ${getClusterBgColor(index, totalVolume)}`}>
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full bg-white/80 dark:bg-gray-800/80 text-sm font-semibold text-gray-600 dark:text-gray-300 w-8 h-8">
                {index + 1}
              </span>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                {clusterName} 
                {totalVolume > 0 && (
                  <span className={`ml-3 ${
                    totalVolume > 5000 
                      ? 'text-green-700 dark:text-green-400'
                      : totalVolume > 1000
                        ? 'text-blue-700 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-400'
                  } text-base font-medium`}>
                    <BarChart2 className="inline mr-1 w-5 h-5" strokeWidth={2} />
                    {totalVolume}
                  </span>
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost"
                size="icon"
                className="rounded-full bg-white/80 dark:bg-gray-800/80 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 shadow-sm hover:bg-white dark:hover:bg-gray-800 h-8 w-8"
                onClick={(e) => {
                  e.stopPropagation();
                  copyKeywords(keywordList, index);
                }}
              >
                {copiedClusterIndex === index ? (
                  <Check className="text-green-600 dark:text-green-400 h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {sortedKeywords.map((kw, idx) => (
                <div key={`${kw}-${idx}`}>
                  {renderKeyword(kw, true)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 渲染單個關鍵詞
  const renderKeyword = (keyword: string, isExpanded = false) => {
    const volume = volumeData[keyword.toLowerCase()] || 0;
    // 模擬 CPC 數據，實際項目中應該從數據源取得
    const cpc = volume > 0 ? (volume * 0.05).toFixed(2) : null;
    
    return (
      <div
        className={`
          cursor-pointer transition-all rounded py-1.5 px-2.5
          ${isExpanded ? 'text-base' : 'text-sm'}
          ${volume > 100 
            ? 'bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 border border-green-100 dark:border-green-900/30' 
            : volume > 0
              ? 'bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 border border-blue-100 dark:border-blue-900/30'
              : 'bg-white/80 dark:bg-gray-800/80 text-gray-800 dark:text-gray-200 border border-gray-100 dark:border-gray-900/30'}
        `}
        onClick={() => {
          navigator.clipboard.writeText(keyword);
          toast.success(`已複製關鍵詞: ${keyword}`);
        }}
      >
        <div className="font-medium">{keyword}</div>
        {(volume > 0 || cpc) && (
          <div className="flex items-center gap-2 mt-1 text-xs">
            {volume > 0 && (
              <span className={volume > 100 ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}>
                <BarChart2 className="inline w-3 h-3 mr-0.5" />{volume}
              </span>
            )}
            {cpc && (
              <span className="text-purple-600 dark:text-purple-400">
                CPC: {cpc}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // 在組件的頂部添加一個判斷函數
  const hasKeywordsButNoClusters = keywords.length > 0 && (!clusters || Object.keys(clusters).length === 0);

  // 添加骨架屏組件
  const renderSkeleton = () => {
    return (
      <div className="space-y-4">
        {/* 分群卡片骨架屏 */}
        <div className="space-y-4">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="w-full">
              <div className="p-6 rounded-lg shadow-md bg-gray-50 dark:bg-gray-900/50">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-6 w-48" />
                  </div>
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {[...Array(5)].map((_, idx) => (
                      <Skeleton key={idx} className="h-8 w-24 rounded-md" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* 關鍵詞數量不足5個的提示 */}
      {keywords.length > 0 && keywords.length < 5 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 p-3 rounded-md text-sm border border-amber-100 dark:border-amber-800">
          <p>需要至少 5 個關鍵詞才能進行分群，當前只有 {keywords.length} 個</p>
        </div>
      )}

      {/* 分群按鈕和模型選擇 */}
      <div className="flex items-center gap-4">
        <Button 
          onClick={handleClustering} 
          disabled={isClustering || (!selectedHistoryDetail?.clusters && keywords.length < 5)}
          className="flex items-center gap-2"
        >
          <Sparkles className="h-4 w-4" />
          {selectedHistoryDetail?.clusters ? "重新分群" : "開始語意分群"}
        </Button>
        
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="選擇模型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gpt-4">GPT-4 (最佳質量)</SelectItem>
            <SelectItem value="gpt-3.5-turbo">GPT-3.5 (更快)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 加載狀態顯示骨架屏 */}
      {isClustering ? (
        renderSkeleton()
      ) : (
        <>
          {/* 分群結果顯示 */}
          {clusters && Object.keys(clusters).length > 0 && (
            <div className="w-full">
              {/* 分群卡片網格 */}
              <div className="grid grid-cols-1 gap-4">
                {Object.keys(clusters).map((clusterName, index) => {
                  const keywordList = clusters[clusterName] || [];
                  return (
                    <div key={`cluster-${index}`} className="w-full">
                      {renderClusterCard(clusterName, keywordList, index)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 空白狀態 - 沒有關鍵詞或沒有結果且不在處理中 */}
          {keywords.length === 0 && !clusters && !isClustering && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-800 p-12 text-center shadow-sm">
              <div className="flex flex-col items-center">
                <LayoutGrid className="h-10 w-10 text-gray-300 dark:text-gray-700 mb-4" />
                <h3 className="text-lg font-medium text-gray-600 dark:text-gray-300 mb-2">尚未生成分群</h3>
                <p className="text-gray-500 dark:text-gray-400 max-w-md mb-6">
                  請先進行關鍵詞研究，系統將對關鍵詞進行智能分類，找出相關主題
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 