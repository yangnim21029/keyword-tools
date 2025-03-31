'use client';

import { debounce } from 'lodash';
import {
  BarChart2,
  Copy,
  Sparkles
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { getKeywordSuggestions, getSearchVolume } from '@/app/actions';
import type { SuggestionsResult } from '@/app/types';
import KeywordClustering from "@/components/keyword-tool/keyword-clustering";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SearchHistoryItem } from '@/lib/schemas'; // Assume type includes 'type'
import { KeywordVolumeItem } from '@/lib/schemas';
import { useSearchStore, type SearchStore } from '@/store/searchStore';
import { useSettingsStore } from "@/store/settingsStore";
import { SortField, SortState } from "@/types/keywordTool.d";
import { detectChineseType } from '@/utils/chineseDetector';
import { SupplementalKeywordPanel } from './supplemental-keyword-panel';

// Assume SearchHistoryItem includes 'type' (keyword, url, serp)
interface ExtendedSearchHistoryItem extends SearchHistoryItem {
    type: 'keyword' | 'url' | 'serp';
}

// Add historyDetail prop
interface KeywordSearchTabProps {
  researchDetail?: ExtendedSearchHistoryItem | null;
  globalSearchInput?: string;
}

const MAX_KEYWORDS_FOR_VOLUME = 100;

interface ClusteringContext {
  query: string;
  region: string;
  language: string;
  historyIdToUpdate: string | null | undefined;
  suggestions: string[];
  volumeData: KeywordVolumeItem[];
}

// 修改 ResultTab 類型定義，只保留 volume 選項
type ResultTab = 'volume';


// 添加一個優化的關鍵詞卡片組件，減少重新渲染
const KeywordCard = memo(({ 
  item, 
  index, 
  onClick 
}: { 
  item: KeywordVolumeItem; 
  index: number; 
  onClick: (text: string) => void 
}) => {
  return (
    <div
      className={`
        rounded-md border border-gray-200 dark:border-gray-800
        hover:shadow-sm transition-all duration-200 cursor-pointer
        ${item.searchVolume && item.searchVolume > 100 
          ? 'bg-green-50/50 dark:bg-green-900/10 border-green-100 dark:border-green-900/20' 
          : item.searchVolume && item.searchVolume > 0
            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20'
            : 'bg-white dark:bg-gray-900'}
      `}
      onClick={() => onClick(item.text || '')}
    >
      <div className="p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {index + 1}
            </span>
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
              {item.text}
            </span>
          </div>
          
          <div className="flex items-center gap-2 ml-8">
            {item.searchVolume !== undefined && item.searchVolume !== null ? (
              <span className={`text-xs flex items-center ${
                item.searchVolume > 100 
                  ? 'text-green-700 dark:text-green-500' 
                  : 'text-blue-700 dark:text-blue-500'
              }`}>
                <BarChart2 className="h-3 w-3 mr-1" />
                {new Intl.NumberFormat().format(item.searchVolume)}
              </span>
            ) : (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                無數據
              </span>
            )}
            
            {item.cpc && (
              <span className="text-xs text-purple-700 dark:text-purple-500">
                CPC: {typeof item.cpc === 'number' ? item.cpc.toFixed(2) : item.cpc}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
KeywordCard.displayName = 'KeywordCard';

export default function KeywordSearchTab({
  researchDetail,
  globalSearchInput,
}: KeywordSearchTabProps) {
  // 狀態管理
  const [query, setQuery] = useState("");
  const [step, setStep] = useState<'input' | 'suggestions' | 'volumes' | 'clusters'>('input');
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [volumeData, setVolumeData] = useState<KeywordVolumeItem[]>([]);
  const [sortState, setSortState] = useState<SortState>({ field: 'searchVolume' as SortField, direction: 'desc' });
  const [resultTab, setResultTab] = useState<ResultTab>("volume");

  // 從Provider獲取設置
  const settingsState = useSettingsStore(state => state.state);
  const settingsActions = useSettingsStore(state => state.actions);
  
  const {
    region,
    language,
    filterZeroVolume,
    maxResults,
    useAlphabet,
    useSymbols,
  } = settingsState;
  
  const isLoading = useSearchStore((store: SearchStore) => store.state.isLoading);
  const loadingText = useSearchStore((store: SearchStore) => store.state.loadingMessage) ?? '';
  const setGlobalLoading = useSearchStore((store: SearchStore) => store.actions.setLoading);

  // 重設搜索狀態
  const resetSearchState = useCallback(() => {
    setError(null);
    setStep('input');
  }, []);

  // Load data from researchDetail prop
  useEffect(() => {
    if (researchDetail && researchDetail.type === 'keyword') {
      console.log("Keyword Tab received detail:", researchDetail);
      setQuery(researchDetail.mainKeyword || '');
      setSuggestions(researchDetail.suggestions || []);
      setVolumeData(researchDetail.searchResults || []);
      
      // Determine the initial step based on loaded data
      const nextStep = researchDetail.clusters ? 'clusters' 
                       : researchDetail.searchResults?.length ? 'volumes' 
                       : researchDetail.suggestions?.length ? 'suggestions' 
                       : 'input';
      setStep(nextStep);
      setError(null);
    }
  }, [researchDetail]);

  // 處理獲取搜索量
  const handleGetVolumes = useCallback(async (keywordStrings: string[], currentQuery: string) => {
    if (!keywordStrings || keywordStrings.length === 0) {
      setStep('suggestions');
      return;
    }
    const limitedKeywords = keywordStrings.slice(0, MAX_KEYWORDS_FOR_VOLUME);
    if (limitedKeywords.length < keywordStrings.length) {
      toast.info(`關鍵詞 > ${MAX_KEYWORDS_FOR_VOLUME}，僅處理前 ${MAX_KEYWORDS_FOR_VOLUME}`);
    }

    setGlobalLoading(true, `正在獲取 ${limitedKeywords.length} 個關鍵詞搜索量...`);
    setError(null);
    setStep('volumes');

    try {
      console.log('[Component API Call] Getting volumes');
      const volumeResult = await getSearchVolume(limitedKeywords, region, language, currentQuery);

      if (volumeResult.sourceInfo) { toast.info(volumeResult.sourceInfo); }
      if (volumeResult.error) { throw new Error(volumeResult.error); }

      // 添加調試輸出，檢查返回的 competition 值
      console.log('API 返回的競爭度值範例:', 
        volumeResult.results.slice(0, 5).map(item => ({
          keyword: item.text,
          competition: item.competition,
          competitionType: typeof item.competition
        }))
      );

      // 使用直接的結果數據
      let volumeDataResults = volumeResult.results || [];

      if (detectChineseType(currentQuery) !== 'simplified') {
        volumeDataResults = volumeDataResults.filter((item: KeywordVolumeItem) => {
          const itemType = detectChineseType(item?.text || '');
          return item?.text && (itemType === 'traditional' || itemType === 'mixed' || itemType === 'none');
        });
      }
      
      setVolumeData(volumeDataResults);
      setError(null);
      
    } catch (err: any) {
      console.error("[Component Error] Getting volumes:", err);
      const errorMessage = err.message || '獲取搜索量錯誤';
      if (!errorMessage.startsWith('數據來源:')) { toast.error(errorMessage); }
      setError(errorMessage);
      setStep(keywordStrings.length > 0 ? 'suggestions' : 'input');
      setGlobalLoading(false);
    }
  }, [region, language, setGlobalLoading]);

  // 處理保存當前上下文
  const handleSaveCurrentContext = useCallback(() => {
    // Implementation needed
  }, []);

  // 處理獲取建議
  const handleGetSuggestions = useCallback(async (searchQuery?: string) => {
    const currentQuery = (searchQuery || query).trim();
    if (!currentQuery || !region || !language) {
      setError('請輸入關鍵詞並選擇地區和語言');
      return;
    }
    resetSearchState();
    setGlobalLoading(true, '正在獲取建議...');
    setError(null);
    setStep('suggestions');

    try {
      console.log('[Component API Call] Getting suggestions');
      const suggestionResult: SuggestionsResult = await getKeywordSuggestions(currentQuery, region, language, useAlphabet, useSymbols);

      if (suggestionResult.sourceInfo) { toast.info(suggestionResult.sourceInfo); }
      if (suggestionResult.error) { throw new Error(suggestionResult.error); }

      if (suggestionResult.suggestions && suggestionResult.suggestions.length > 0) {
        setSuggestions(suggestionResult.suggestions);
        setError(null);
        await handleGetVolumes(suggestionResult.suggestions, currentQuery);
      } else {
        setStep("input");
        toast.info("未找到建議");
        setGlobalLoading(false);
      }
    } catch (err: any) {
      console.error("[Component Error] Getting suggestions:", err);
      const errorMessage = err.message || '獲取建議錯誤';
      if (!errorMessage.startsWith('數據來源:')) { toast.error(errorMessage); }
      setError(errorMessage);
      setStep('input');
      setGlobalLoading(false);
    }
  }, [region, language, useAlphabet, useSymbols, query, resetSearchState, setGlobalLoading, handleGetVolumes]);

  // 排序邏輯
  const handleSort = useCallback((field: SortField) => {
    setSortState(prevState => ({
      field,
      direction: prevState.field === field && prevState.direction === "desc" ? "asc" : "desc"
    }));
  }, []);

  // 過濾體積數據
  const filteredVolumeData = useMemo(() => {
    if (!volumeData) {
      return [];
    }
    
    // 定義統一處理競爭度值的函數
    const getCompetitionValue = (comp: string | undefined): number => {
      if (!comp) return 2; // 默認中等
      
      const compLower = typeof comp === 'string' ? comp.toLowerCase() : '';
      if (compLower === 'low' || compLower === '低') return 1;
      if (compLower === 'medium' || compLower === '中') return 2;
      if (compLower === 'high' || compLower === '高') return 3;
      
      // 如果是數字格式
      const numComp = parseFloat(comp);
      if (!isNaN(numComp)) {
        if (numComp <= 33) return 1;
        if (numComp <= 66) return 2;
        return 3;
      }
      
      return 2; // 默認中等
    };
    
    // 先進行過濾
    let filteredData = filterZeroVolume 
      ? volumeData.filter(item => item.searchVolume != null && item.searchVolume > 0)
      : [...volumeData];
    
    // 然後根據 sortState 進行排序
    filteredData.sort((a, b) => {
      const { field, direction } = sortState;
      
      // 處理缺失值（null/undefined）- 將它們放在排序的末尾
      if (a[field] === null || a[field] === undefined) return 1;
      if (b[field] === null || b[field] === undefined) return -1;
      
      // 特別處理競爭程度字段
      if (field === 'competition') {
        // 使用上面定義的函數獲取競爭度數值
        const aValue = getCompetitionValue(a[field] as string);
        const bValue = getCompetitionValue(b[field] as string);
        
        return direction === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      // 處理一般字段
      if (typeof a[field] === 'string' && typeof b[field] === 'string') {
        // 字符串比較
        return direction === 'asc' 
          ? (a[field] as string).localeCompare(b[field] as string)
          : (b[field] as string).localeCompare(a[field] as string);
      } else {
        // 數值比較
        return direction === 'asc' 
          ? (a[field] as number) - (b[field] as number)
          : (b[field] as number) - (a[field] as number);
      }
    });
    
    return filteredData;
  }, [volumeData, filterZeroVolume, sortState]);

  // 整合建議列表和搜索量數據
  const integratedKeywordData = useMemo(() => {
    // 如果沒有建議或搜索量數據，則返回空數組
    if (!suggestions || suggestions.length === 0) {
      return [];
    }

    // 建立搜索量數據的映射，方便查詢
    const volumeMap = new Map<string, KeywordVolumeItem>();
    volumeData?.forEach(item => {
      if (item.text) {
        volumeMap.set(item.text.toLowerCase(), item);
      }
    });

    // 將建議列表轉換為整合數據，並添加搜索量信息
    const integrated = suggestions.map(suggestion => {
      const volumeItem = volumeMap.get(suggestion.toLowerCase());
      return {
        keyword: suggestion,
        searchVolume: volumeItem?.searchVolume || 0,
        competition: volumeItem?.competition || '',
        cpc: volumeItem?.cpc || 0,
        hasVolumeData: !!volumeItem
      };
    });

    // 優先按是否有搜索量數據排序，然後按搜索量降序排序
    integrated.sort((a, b) => {
      // 先比較是否有搜索量數據
      if (a.hasVolumeData && !b.hasVolumeData) return -1;
      if (!a.hasVolumeData && b.hasVolumeData) return 1;
      
      // 如果都有搜索量數據，則按搜索量降序排序
      return b.searchVolume - a.searchVolume;
    });

    return integrated;
  }, [suggestions, volumeData]);

  // 修改更新結果選項卡的 useEffect，去掉與 clusters 相關的條件
  useEffect(() => {
    // 所有情況下都設置為 volume
    setResultTab("volume");
  }, [step]);

  // 同步全局搜索輸入
  useEffect(() => {
    if (globalSearchInput !== undefined) {
      setQuery(globalSearchInput);
    }
  }, [globalSearchInput]);

  const hasVolumeResults = (volumeData?.length ?? 0) > 0;
  const debouncedHandleGetSuggestions = debounce(handleGetSuggestions, 300);

  // 移除與補充關鍵詞相關的舊狀態
  const [selectedKeyword, setSelectedKeyword] = useState<string>('');
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  // 添加新狀態來存儲從側邊欄選定的補充關鍵詞
  const [selectedSupplementalKeyword, setSelectedSupplementalKeyword] = useState<string>('');
  
  // 處理關鍵詞卡片點擊
  const handleKeywordCardClick = useCallback((keywordText: string) => {
    setSelectedKeyword(keywordText);
    setIsPanelOpen(true);
  }, []);

  // 更新同步session storage的函數 - 實現選項 A: 更新現有 + 追加新詞
  const handleVolumeUpdateFromPanel = useCallback((updatedVolumes: KeywordVolumeItem[]) => {
    if (!updatedVolumes || updatedVolumes.length === 0) return;

    const updatedVolumeMap = new Map<string, KeywordVolumeItem>();
    updatedVolumes.forEach(item => {
      if (item.text) {
        updatedVolumeMap.set(item.text.toLowerCase(), item);
      }
    });
    
    setVolumeData(prevVolumeData => {
      const existingKeywordTexts = new Set(prevVolumeData.map(item => item.text?.toLowerCase()).filter(Boolean));

      const updatedExistingData = prevVolumeData.map(currentItem => {
        if (!currentItem.text) return currentItem;
        const lowerCaseText = currentItem.text.toLowerCase();
        if (updatedVolumeMap.has(lowerCaseText)) {
          const updatedItemData = updatedVolumeMap.get(lowerCaseText)!;
          return { ...currentItem, searchVolume: updatedItemData.searchVolume, competition: updatedItemData.competition };
        }
        return currentItem;
      });

      const newKeywordsToAppend = updatedVolumes.filter(item => 
        item.text && !existingKeywordTexts.has(item.text.toLowerCase())
      );

      const newVolumeData = [...updatedExistingData, ...newKeywordsToAppend];

      // 計算更新和添加的數量 (可選，用於更詳細的提示)
      const updatedCount = updatedExistingData.filter((item, idx) => 
        prevVolumeData[idx] && 
        (item.searchVolume !== prevVolumeData[idx].searchVolume || item.competition !== prevVolumeData[idx].competition)
      ).length;
      const addedCount = newKeywordsToAppend.length;

      // 更新 Toast 提示
      if (updatedCount > 0 || addedCount > 0) {
        let message = "關鍵詞數據已更新";
        if (updatedCount > 0 && addedCount > 0) {
          message = `更新了 ${updatedCount} 個，新增了 ${addedCount} 個關鍵詞數據`;
        } else if (updatedCount > 0) {
          message = `更新了 ${updatedCount} 個關鍵詞數據`;
        } else if (addedCount > 0) {
          message = `新增了 ${addedCount} 個關鍵詞數據`;
        }
        toast.success(message);
      }

      return newVolumeData;
    });
  }, []);

  // 使用Memo優化關鍵詞列表渲染
  const sortedVolumeData = useMemo(() => {
    if (!volumeData || volumeData.length === 0) return [];
    return [...volumeData].sort((a, b) => (b.searchVolume || 0) - (a.searchVolume || 0));
  }, [volumeData]);

  // 使用Memo優化聚類顯示
  const clusteringSection = useMemo(() => {
    // 如果在分群頁面，顯示完整的分群組件
    if (step === 'clusters') {
      return (
        <div className="space-y-6 mb-8">
          <div className="max-w-full">
            <KeywordClustering />
          </div>
        </div>
      );
    }
    
    // 只要有搜索量數據，無論在哪個步驟，都顯示分群按鈕
    if (volumeData.length > 0) {
      return (
        <div className="flex justify-end mb-4">
          <Button 
            onClick={() => setStep('clusters')}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Sparkles className="h-4 w-4" />
            開始語意分群
          </Button>
        </div>
      );
    }
    
    return null;
  }, [step, volumeData.length]);

  // 處理頁面內重新整理，保留已有數據
  const handleDataRefresh = useCallback(async () => {
    // 確保有查詢和結果才能刷新
    if (!query || step === 'input') {
      toast.info('請先執行搜索');
      return;
    }
    
    setGlobalLoading(true, '正在重新獲取數據...');
    try {
      // 根據當前步驟決定要刷新什麼
      if (step === 'volumes' || step === 'clusters') {
        // 收集目前的搜索結果中的URL，用於保留已分析的HTML數據
        const existingKeywords = suggestions?.length > 0 ? [...suggestions] : [];
        // 重新獲取搜索量數據，但保留現有的HTML分析結果
        await handleGetVolumes(existingKeywords, query);
        toast.success('數據已重新整理');
      } else if (step === 'suggestions') {
        // 重新獲取關鍵詞建議
        await handleGetSuggestions(query);
        toast.success('關鍵詞建議已重新整理');
      }
    } catch (error) {
      console.error('重新整理數據失敗:', error);
      toast.error('重新整理失敗');
    } finally {
      setGlobalLoading(false);
    }
  }, [query, step, suggestions, handleGetVolumes, handleGetSuggestions, setGlobalLoading]);

  // 在搜索結果區域添加重新整理按鈕
  const renderResultsHeader = () => {
    // 只在有建議或者卷數據時顯示總結果數
    const totalResults = volumeData.length || suggestions.length || 0;
    
    if (totalResults === 0) return null;
    
    return (
      <div className="flex justify-between items-center pb-2 mb-2">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-medium text-gray-700 dark:text-gray-300">
            搜尋結果
          </h3>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({totalResults})
          </span>
        </div>
      </div>
    );
  };

  // 完全移除歷史記錄標頭
  const renderHistoryHeader = useMemo(() => {
    return null;
  }, []);

  return (
    <div className="w-full h-full flex flex-col space-y-6 pb-10">
      {/* 主內容區域 - 不再顯示歷史記錄標頭 */}
      <div className="space-y-4">
        {/* 移除了renderHistoryHeader */}
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-md shadow-sm">
          <p className="font-medium">錯誤:</p>
          <p>{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="mt-2 text-red-700 hover:bg-red-100">
            關閉
          </Button>
        </div>
      )}

      <button id="keyword-search-submit" onClick={() => debouncedHandleGetSuggestions()} style={{ display: 'none' }}>Submit</button>

      {/* 顯示從側邊欄選定的補充關鍵詞，並提供進行新搜索的按鈕 */}
      {selectedSupplementalKeyword && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-md shadow-sm">
          <p className="text-blue-700 dark:text-blue-400 font-medium">已選擇補充關鍵詞:</p>
          <p className="text-blue-800 dark:text-blue-300 font-semibold my-1">{selectedSupplementalKeyword}</p>
          <div className="flex gap-2 mt-2">
            <Button 
              size="sm" 
              onClick={() => {
                setQuery(selectedSupplementalKeyword);
                handleGetSuggestions(selectedSupplementalKeyword);
                setSelectedSupplementalKeyword('');
                setIsPanelOpen(false); // 執行主搜索後關閉面板
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              用此關鍵詞進行新搜索
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setSelectedSupplementalKeyword('');
              }}
              className="text-blue-700 dark:text-blue-400"
            >
              取消
            </Button>
          </div>
        </div>
      )}

      {/* 使用memo優化的聚類顯示區 */}
      {clusteringSection}

      {/* 添加搜索結果標題和重新整理按鈕 */}
      {(suggestions.length > 0 || volumeData.length > 0) && renderResultsHeader()}

      {/* Tabs 區域 - 移除TabsList */}
      {(suggestions.length > 0 || volumeData.length > 0) && (
        <div className="mt-2">
          {volumeData.length > 0 ? (
            // 顯示關鍵詞卡片網格，恢復卡片標題和描述
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg font-medium">關鍵詞搜索量</CardTitle>
                  {volumeData.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        const keywords = volumeData.map(item => item.text).join('\n');
                        navigator.clipboard.writeText(keywords);
                        toast(`已複製 ${volumeData.length} 個關鍵詞到剪貼板`);
                      }}
                      className="h-8"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" />
                      複製全部
                    </Button>
                  )}
                </div>
                <CardDescription>
                  共 {volumeData.length} 個關鍵詞的搜索量數據
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedVolumeData.map((item, index) => (
                    <KeywordCard
                      key={index}
                      item={item}
                      index={index}
                      onClick={handleKeywordCardClick}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="flex flex-col items-center justify-center text-center" style={{ minHeight: '300px' }}>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  {isLoading ? "獲取搜索量數據中..." : "尚無搜索量數據"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
      
      {/* 補充關鍵詞側邊欄 */}
      <SupplementalKeywordPanel
        isOpen={isPanelOpen}
        onClose={() => setIsPanelOpen(false)}
        keyword={selectedKeyword}
        region={region}
        language={language}
        onKeywordSelect={(keyword) => {
          // 不再直接觸發新搜索，只存儲選定的關鍵詞
          setSelectedSupplementalKeyword(keyword);
          // 不關閉側邊欄，讓用戶可以繼續交互
        }}
        onVolumeUpdate={handleVolumeUpdateFromPanel}
      />

      {researchDetail && (
        <div className="mt-4 p-2 bg-yellow-100 dark:bg-yellow-900 rounded border border-yellow-300 dark:border-yellow-700">
          <p className="text-sm">Loaded from Research: {researchDetail.mainKeyword}</p>
        </div>
      )}
    </div>
  );
}