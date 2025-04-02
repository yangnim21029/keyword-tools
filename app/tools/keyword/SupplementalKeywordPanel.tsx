import { getKeywordSuggestionsWithDelay } from '@/app/actions';
import { getSearchVolume } from '@/app/services/KeywordDataService';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from "@/components/ui/sheet";
import { KeywordVolumeItem } from '@/lib/schemas';
import { BarChart2, Copy, Loader, PlusSquare, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

// 200毫秒延遲函數
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 定義本地的 KeywordSuggestionWithVolume 接口
interface KeywordSuggestionWithVolume {
  text: string;
  searchVolume?: number;
  cpc?: number | null;
  competition?: string;
}

interface SupplementalKeywordPanelProps {
  isOpen: boolean;
  onClose: () => void;
  keyword: string;
  region: string;
  language: string;
  onKeywordSelect?: (keyword: string) => void;
  // 添加新的回調函數屬性，用於更新主視圖的搜索量數據
  onVolumeUpdate?: (updatedVolumes: KeywordVolumeItem[]) => void;
}

export function SupplementalKeywordPanel({
  isOpen,
  onClose,
  keyword,
  region,
  language,
  onKeywordSelect,
  onVolumeUpdate
}: SupplementalKeywordPanelProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [supplementalKeywords, setSupplementalKeywords] = useState<KeywordSuggestionWithVolume[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetchingVolume, setIsFetchingVolume] = useState<boolean>(false);
  const [volumeFetchError, setVolumeFetchError] = useState<string | null>(null);
  const [fetchedVolumeData, setFetchedVolumeData] = useState<KeywordVolumeItem[] | null>(null);
  const [showAddButton, setShowAddButton] = useState<boolean>(false);

  // 當側邊欄打開且有關鍵詞時，獲取補充關鍵詞
  useEffect(() => {
    const fetchSupplementalKeywords = async () => {
      if (!isOpen || !keyword) return;
      
      setIsLoading(true);
      setSupplementalKeywords([]);
      setError(null);
      setVolumeFetchError(null);
      setFetchedVolumeData(null);
      setShowAddButton(false);
      
      try {
        await sleep(200);
        
        const suggestionResult = await getKeywordSuggestionsWithDelay(keyword, region, language);
        
        if (!suggestionResult.suggestions || suggestionResult.suggestions.length === 0) {
          toast.info("未找到相關長尾關鍵詞");
          setIsLoading(false);
          return;
        }
        
        const supplementalData: KeywordSuggestionWithVolume[] = suggestionResult.suggestions.map((text: string) => ({
          text,
          searchVolume: undefined,
          cpc: undefined,
          competition: undefined
        }));
        
        setSupplementalKeywords(supplementalData);
      } catch (error) {
        console.error('獲取補充關鍵詞失敗:', error);
        setError('獲取補充關鍵詞失敗，請稍後再試');
        toast.error('獲取補充關鍵詞失敗');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSupplementalKeywords();
  }, [isOpen, keyword, region, language]);

  // 批量獲取搜索量的處理函數
  const handleFetchVolumes = async () => {
    if (!supplementalKeywords.length || isFetchingVolume) return;

    setIsFetchingVolume(true);
    setVolumeFetchError(null);
    setFetchedVolumeData(null);
    setShowAddButton(false);

    try {
      const keywordsToFetch = supplementalKeywords.map(k => k.text);
      const volumeResult = await getSearchVolume(keywordsToFetch, region, language, keyword);
      
      if (volumeResult.error) {
        throw new Error(volumeResult.error);
      }
      
      const volumeData = volumeResult.results || [];
      
      if (volumeData.length > 0) {
        // 轉換 KeywordVolumeResult[] 為 KeywordVolumeItem[]
        const convertedData: KeywordVolumeItem[] = volumeData.map(item => ({
          text: item.text,
          searchVolume: item.searchVolume,
          cpc: item.cpc,
          competition: item.competition,
          competitionIndex: item.competitionIndex
        }));
        
        setFetchedVolumeData(convertedData);
        
        const volumeMap = new Map<string, KeywordVolumeItem>();
        convertedData.forEach(item => {
          if (item.text) {
            volumeMap.set(item.text.toLowerCase(), item);
          }
        });
        
        const updatedKeywords = supplementalKeywords.map(kw => {
          const key = kw.text.toLowerCase();
          const volumeInfo = volumeMap.get(key);
          return {
            text: kw.text,
            searchVolume: volumeInfo?.searchVolume,
            cpc: volumeInfo?.cpc,
            competition: volumeInfo?.competition
          };
        });
        
        setSupplementalKeywords(updatedKeywords);
        setShowAddButton(true);
        toast.success(`已獲取 ${volumeData.length} 個關鍵詞搜索量，可選擇添加到主列表`);
      } else {
        toast.info("未找到相關搜索量數據");
        setFetchedVolumeData(null);
        setShowAddButton(false);
        const updatedKeywords = supplementalKeywords.map(kw => ({
          text: kw.text,
          searchVolume: undefined,
          cpc: undefined,
          competition: undefined
        }));
        setSupplementalKeywords(updatedKeywords);
      }
    } catch (error) {
      console.error('批量獲取搜索量失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '批量獲取搜索量失敗，請稍後再試';
      setVolumeFetchError(errorMessage);
      toast.error('批量獲取搜索量失敗');
      setFetchedVolumeData(null);
      setShowAddButton(false);
    } finally {
      setIsFetchingVolume(false);
    }
  };

  // 新增：處理「添加關鍵詞」按鈕點擊
  const handleAddKeywords = () => {
    if (!fetchedVolumeData || !onVolumeUpdate) {
      console.error("無法添加關鍵詞：缺少數據或回調函數");
      toast.error("添加關鍵詞失敗");
      return;
    }
    
    onVolumeUpdate(fetchedVolumeData);
    
    setFetchedVolumeData(null);
    setShowAddButton(false);
    onClose();
  };

  // 格式化搜索量顯示
  const formatSearchVolume = (volume?: number) => {
    if (volume === undefined || volume === null) return '無數據';
    return new Intl.NumberFormat().format(volume);
  };
  
  // 獲取競爭程度顯示樣式
  const getCompetitionStyle = (competition?: string) => {
    if (!competition) return {};
    
    switch (competition) {
      case 'Low':
        return 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 border-green-100 dark:border-green-900/30';
      case 'Medium':
        return 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-500 border-orange-100 dark:border-orange-900/30';
      case 'High':
        return 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-500 border-red-100 dark:border-red-900/30';
      default:
        return 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400';
    }
  };
  
  // 獲取競爭程度翻譯
  const getCompetitionLabel = (competition?: string) => {
    if (!competition) return '未知';
    
    switch (competition) {
      case 'Low': return '低競爭';
      case 'Medium': return '中競爭';
      case 'High': return '高競爭';
      default: return competition;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-md bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 flex flex-col h-full">
        <SheetHeader className="mb-5 flex-shrink-0">
          <SheetTitle className="flex items-center text-gray-900 dark:text-gray-100">
            <Search className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            {keyword ? `"${keyword}" 的補充關鍵詞` : "補充關鍵詞"}
          </SheetTitle>
          <SheetDescription className="text-gray-600 dark:text-gray-400">
            {isLoading 
              ? "正在獲取補充關鍵詞..." 
              : supplementalKeywords.length > 0 
                ? `找到 ${supplementalKeywords.length} 個相關長尾關鍵詞`
                : "獲取相關的長尾關鍵詞"}
          </SheetDescription>
          
          {/* 操作按鈕群組 */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {supplementalKeywords.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => {
                  navigator.clipboard.writeText(supplementalKeywords.map(k => k.text).join('\n'));
                  toast(`已複製 ${supplementalKeywords.length} 個關鍵詞到剪貼板`);
                }}
                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                複製全部
              </Button>
            )}
            
            {supplementalKeywords.length > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleFetchVolumes}
                disabled={isLoading || isFetchingVolume || supplementalKeywords.length === 0}
                className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                {isFetchingVolume ? (
                  <>
                    <Loader className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    獲取中...
                  </>
                ) : (
                  <>
                    <BarChart2 className="h-3.5 w-3.5 mr-1.5" />
                    批量獲取搜量
                  </>
                )}
              </Button>
            )}

            {showAddButton && fetchedVolumeData && (
              <Button 
                size="sm" 
                onClick={handleAddKeywords}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <PlusSquare className="h-4 w-4 mr-1.5" />
                添加到主列表
              </Button>
            )}
          </div>
        </SheetHeader>

        {/* 顯示錯誤信息 (保持在可滾動區域外部) */}
        {(error || volumeFetchError) && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-md shadow-sm mb-4 flex-shrink-0">
            <p className="font-medium">錯誤:</p>
            <p>{error || volumeFetchError}</p>
          </div>
        )}

        {/* 讓這個 div 佔據剩餘空間並可以滾動 */}
        <div className="mt-4 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 h-full">
              <div className="flex flex-col items-center gap-2">
                <Loader className="h-6 w-6 animate-spin text-gray-400 dark:text-gray-500" />
                <span className="text-sm text-gray-500 dark:text-gray-400">正在獲取補充關鍵詞...</span>
              </div>
            </div>
          ) : supplementalKeywords.length > 0 ? (
            <div className="space-y-2">
              {supplementalKeywords.map((kw, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-all border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 cursor-pointer flex-grow mr-2" onClick={() => onKeywordSelect?.(kw.text)}>
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-600 dark:text-gray-300 flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate" title={kw.text}>{kw.text}</span>
                      </div>
                      
                      <div className="flex items-center flex-shrink-0">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(kw.text);
                            toast(`已複製關鍵詞 "${kw.text}"`);
                          }}
                          className="h-7 w-7 rounded-full text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                          title="複製此關鍵詞"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    {(kw.searchVolume !== undefined || kw.cpc) && (
                      <div className="flex items-center gap-2 ml-8 mt-1">
                        {kw.searchVolume !== undefined && (
                          <Badge className={`
                            ${kw.searchVolume > 100 
                              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-500 border-green-100 dark:border-green-900/30' 
                              : kw.searchVolume > 0
                                ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-500 border-blue-100 dark:border-blue-900/30'
                                : 'bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}
                          `}>
                            <BarChart2 className="h-3 w-3 mr-1" />
                            {formatSearchVolume(kw.searchVolume)}
                          </Badge>
                        )}
                        
                        {kw.cpc && (
                          <Badge variant="outline" className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-500 border-purple-100 dark:border-purple-900/30">
                            CPC: {typeof kw.cpc === 'number' ? kw.cpc.toFixed(2) : kw.cpc}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : !isLoading && keyword ? (
            <div className="p-8 text-center h-full flex items-center justify-center">
              <div className="text-gray-500 dark:text-gray-400">未找到相關補充關鍵詞</div>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}