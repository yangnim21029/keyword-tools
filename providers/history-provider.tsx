'use client';

import { type ReactNode, createContext, useContext, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// 新增：添加內存緩存存儲歷史記錄詳情
const historyDetailCache: Record<string, any> = {};

// 直接在文件中定義所需類型
interface ClusteringResult {
  clusters: Record<string, string[]>;
  metadata?: {
    timestamp: Date;
    algorithm?: string;
    parameters?: Record<string, any>;
  };
}

// 歷史記錄列表項目類型
interface SearchHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: Date;
  suggestionCount: number;
  resultsCount: number;
  
  // 可選字段
  suggestions?: string[];
  searchResults?: any[];
  clusters?: Record<string, string[]> | null;
  clustersCount?: number;
  personas?: any[]; // 新增：用戶畫像
  personasLastUpdated?: Date; // 新增：用戶畫像最後更新時間
  
  // 用於顯示預覽的字段（僅在列表項目中使用）
  suggestionsPreview?: string[];
}

// 服务器返回的历史记录项目类型
interface ServerHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: string | Date;
  suggestionCount: number;
  resultsCount: number;
  suggestions?: string[];
  searchResults?: any[];
  clusters?: Record<string, string[]> | null;
  clustersCount?: number;
  suggestionsPreview?: string[];
}

// 用於歷史記錄存儲的狀態類型
interface HistoryState {
  histories: SearchHistoryItem[];
  loading: boolean;
  error: string | null;
  selectedHistoryId: string | null;
  selectedHistoryDetail: SearchHistoryItem | null;
  // 新增：標示是否使用緩存數據
  usingCachedData: boolean;
}

interface HistoryActions {
  // 基本操作
  setSelectedHistoryId: (id: string | null, useCache?: boolean) => void;
  setSelectedHistoryDetail: (history: SearchHistoryItem | null) => void;
  clearSelectedHistoryDetail: () => void;
  
  // API 交互
  fetchHistories: (forceRefresh?: boolean) => Promise<void>;
  saveClusteringResults: (clusterId: string, result: Record<string, string[]>) => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;
  // 修改：更新現有歷史記錄的搜索結果，允許返回一個表示成功的對象
  updateHistorySearchResults: (historyId: string, searchResults: any[]) => Promise<{ success: boolean } | void>;
  // 新增：清除緩存
  clearCache: (historyId?: string) => void;
  // 新增：強制重新加載歷史詳情
  forceRefreshHistoryDetail: (historyId: string) => Promise<void>;
  // 新增：更新用戶畫像
  updateHistoryPersonas: (historyId: string, personas: any[]) => Promise<{ success: boolean } | void>;
}

export type HistoryStore = {
  state: HistoryState;
  actions: HistoryActions;
};

// 默認初始狀態
export const defaultHistoryState: HistoryState = {
  histories: [],
  loading: false,
  error: null,
  selectedHistoryId: null,
  selectedHistoryDetail: null,
  usingCachedData: false,
};

// 創建store工廠函數
const createHistoryStore = (initState: HistoryState = defaultHistoryState) => {
  return createStore<HistoryStore>()((set, get) => ({
    state: {
      ...initState
    },
    
    actions: {
      // 設置選中的歷史記錄ID (修改：添加緩存參數)
      setSelectedHistoryId: (historyId, useCache = true) => {
        // 更新當前選中的歷史記錄ID
        set((state) => ({
          state: {
            ...state.state,
            selectedHistoryId: historyId,
            usingCachedData: false // 重置緩存狀態
          }
        }));
        
        // 如果ID為空，清空選中的歷史記錄詳情
        if (!historyId) {
          set((state) => ({
            state: {
              ...state.state,
              selectedHistoryDetail: null
            }
          }));
          return;
        }
        
        // 新增：如果啟用緩存並且緩存中存在該歷史記錄，則直接使用緩存
        if (useCache && historyDetailCache[historyId]) {
          console.log('[HistoryProvider] 使用緩存的歷史記錄詳情:', historyId);
          set((state) => ({
            state: {
              ...state.state,
              selectedHistoryDetail: historyDetailCache[historyId],
              usingCachedData: true
            }
          }));
          return;
        }
        
        // 從服務器獲取歷史記錄詳情
        (async () => {
          try {
            const { getHistoryDetail } = await import('@/app/actions');
            console.log('[HistoryProvider] 正在獲取歷史記錄詳情:', historyId);
            
            // 直接獲取歷史記錄詳情，避免 Next.js 緩存
            const historyDetail = await getHistoryDetail(historyId);
            
            // 檢查是否包含 clusters 字段
            console.log('[HistoryProvider] 歷史記錄詳情:', {
              hasDetail: !!historyDetail,
              hasClusters: historyDetail && 'clusters' in historyDetail,
              clustersType: historyDetail && historyDetail.clusters ? typeof historyDetail.clusters : 'undefined',
              clustersKeys: historyDetail && historyDetail.clusters ? Object.keys(historyDetail.clusters) : []
            });
            
            // 最重要的修改：確保 clusters 字段正確傳遞
            // 1. 明確處理嵌套對象
            let detailWithClusters = historyDetail;
            
            // 2. 如果原始數據中有 clusters，確保它被正確處理
            if (historyDetail && historyDetail.clusters) {
              // 再次序列化/反序列化以確保數據結構正確
              const clustersStr = JSON.stringify(historyDetail.clusters);
              const parsedClusters = JSON.parse(clustersStr);
              
              // 創建新對象，明確包含所有必要字段
              detailWithClusters = {
                ...historyDetail,
                clusters: parsedClusters,
              };
              
              console.log('[HistoryProvider] 處理後的 clusters 數據:', {
                originalKeys: historyDetail.clusters ? Object.keys(historyDetail.clusters).length : 0,
                processedKeys: parsedClusters ? Object.keys(parsedClusters).length : 0
              });
            }
            
            // 新增：保存到緩存
            if (detailWithClusters) {
              historyDetailCache[historyId] = detailWithClusters;
            }
            
            // 更新選中的歷史記錄詳情
            set((state) => ({
              state: {
                ...state.state,
                selectedHistoryDetail: detailWithClusters,
                usingCachedData: false // 不是從緩存加載的
              }
            }));
            
            // 打印最終設置到 store 的數據
            console.log('[HistoryProvider] 最終設置到 store 的詳情:', {
              id: detailWithClusters?.id,
              hasClusters: !!(detailWithClusters && detailWithClusters.clusters),
              clustersKeys: detailWithClusters && detailWithClusters.clusters ? Object.keys(detailWithClusters.clusters) : []
            });
          } catch (error) {
            console.error('[HistoryProvider] 獲取歷史記錄詳情失敗:', error);
            const { toast } = await import('sonner');
            toast.error('獲取歷史記錄詳情失敗: ' + (error instanceof Error ? error.message : String(error)));
          }
        })();
      },
      
      // 清除選中的歷史記錄詳情
      clearSelectedHistoryDetail: () => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            selectedHistoryId: null, 
            selectedHistoryDetail: null,
            usingCachedData: false
          } 
        })),
        
      // 新增：清除緩存  
      clearCache: (historyId?: string) => {
        if (historyId) {
          // 清除指定歷史記錄的緩存
          delete historyDetailCache[historyId];
          console.log('[HistoryProvider] 已清除歷史記錄緩存:', historyId);
          
          // 如果當前選中的就是這個歷史記錄，則重置緩存狀態
          const currentId = get().state.selectedHistoryId;
          if (currentId === historyId) {
            set((state) => ({
              state: {
                ...state.state,
                usingCachedData: false
              }
            }));
          }
        } else {
          // 清除所有緩存
          Object.keys(historyDetailCache).forEach(key => delete historyDetailCache[key]);
          console.log('[HistoryProvider] 已清除所有歷史記錄緩存');
          
          // 重置緩存狀態
          set((state) => ({
            state: {
              ...state.state,
              usingCachedData: false
            }
          }));
        }
      },
      
      // 新增：強制重新加載歷史詳情
      forceRefreshHistoryDetail: async (historyId: string) => {
        // 先清除指定緩存
        delete historyDetailCache[historyId];
        
        // 如果目前選中的是這條歷史，則重新加載
        const currentId = get().state.selectedHistoryId;
        if (currentId === historyId) {
          // 重新加載詳情（不使用緩存）
          get().actions.setSelectedHistoryId(historyId, false);
        }
      },
      
      // 獲取所有歷史記錄 - 使用server actions
      fetchHistories: async (forceRefresh = true) => {
        set((store) => ({ 
          state: { 
            ...store.state, 
            loading: true 
          } 
        }));
        
        try {
          // 使用動態導入獲取server action
          const { fetchSearchHistory } = await import('@/app/actions');
          
          // 使用 forceRefresh 參數來強制刷新緩存
          const result = await fetchSearchHistory(100, forceRefresh);
          
          if (result.error) {
            throw new Error(result.error);
          }
          
          // 確保處理server action返回的數據
          const formattedHistories: SearchHistoryItem[] = Array.isArray(result.data) ? 
            result.data.map((item: ServerHistoryItem) => ({
              id: item.id,
              mainKeyword: item.mainKeyword || '',
              region: item.region || '',
              language: item.language || '',
              timestamp: item.timestamp instanceof Date ? item.timestamp : new Date(item.timestamp),
              suggestionCount: typeof item.suggestionCount === 'number' ? item.suggestionCount : 0,
              resultsCount: typeof item.resultsCount === 'number' ? item.resultsCount : 0,
              suggestionsPreview: Array.isArray(item.suggestionsPreview) ? item.suggestionsPreview : [],
              clustersCount: typeof item.clustersCount === 'number' ? item.clustersCount : 0,
              clusters: item.clusters || null,
            })) : [];
          
          set((store) => ({ 
            state: { 
              ...store.state, 
              histories: formattedHistories, 
              loading: false 
            } 
          }));
          
        } catch (error) {
          console.error('獲取歷史記錄失敗:', error);
          set((store) => ({ 
            state: { 
              ...store.state, 
              loading: false 
            } 
          }));
          throw error;
        }
      },
      
      // 保存聚類結果 - 使用server actions
      saveClusteringResults: async (clusterId, clusters) => {
        try {
          // 使用 toast 顯示狀態
          const { toast } = await import('sonner');
          toast.loading('正在保存聚類結果...');
          
          // 使用server action保存聚類結果
          const { saveHistoryClusteringResults } = await import('@/app/actions');
          const result = await saveHistoryClusteringResults(clusterId, clusters);
          
          if (!result.success) {
            throw new Error(result.error || '保存聚類結果失敗');
          }
          
          // 立即更新當前選中的歷史記錄細節（不等待fetchHistories）
          const currentState = get().state;
          if (currentState.selectedHistoryDetail && currentState.selectedHistoryDetail.id === clusterId) {
            // 在保存聚類結果後，繞過緩存重新獲取最新數據
            try {
              const { getHistoryDetail } = await import('@/app/actions');
              console.log('[HistoryProvider] 保存後重新獲取歷史記錄詳情:', clusterId);
              
              // 使用 noCache=true 確保獲取最新數據
              const freshDetail = await getHistoryDetail(clusterId);
              
              if (freshDetail && freshDetail.clusters) {
                console.log('[HistoryProvider] 成功獲取最新聚類數據:', {
                  clustersCount: Object.keys(freshDetail.clusters).length
                });
                
                // 更新到狀態
                set((state) => ({
                  state: {
                    ...state.state,
                    selectedHistoryDetail: freshDetail
                  }
                }));
              } else {
                // 如果無法獲取最新數據，則使用提供的 clusters 參數
                set((state) => ({
                  state: {
                    ...state.state,
                    selectedHistoryDetail: {
                      ...state.state.selectedHistoryDetail!,
                      clusters: clusters,
                      clustersCount: Object.keys(clusters).length
                    }
                  }
                }));
              }
            } catch (fetchError) {
              console.error('[HistoryProvider] 保存後無法獲取最新數據:', fetchError);
              // 回退到直接更新
              set((state) => ({
                state: {
                  ...state.state,
                  selectedHistoryDetail: {
                    ...state.state.selectedHistoryDetail!,
                    clusters: clusters,
                    clustersCount: Object.keys(clusters).length
                  }
                }
              }));
            }
            
            console.log('[HistoryProvider] 已更新本地狀態中的聚類結果');
          }
          
          // 刷新歷史記錄
          const { actions } = get();
          await actions.fetchHistories();
          
          toast.success('聚類結果已保存');
        } catch (error) {
          console.error('保存聚類結果失敗:', error);
          const { toast } = await import('sonner');
          toast.error('保存聚類結果失敗: ' + (error instanceof Error ? error.message : String(error)));
          throw error;
        }
      },
      
      // 刪除歷史記錄 - 使用server actions
      deleteHistory: async (id) => {
        try {
          // 使用 toast 顯示狀態
          const { toast } = await import('sonner');
          toast.loading('正在刪除歷史記錄...');
          
          // 使用server action刪除歷史記錄
          const { deleteSearchHistoryRecord } = await import('@/app/actions');
          const result = await deleteSearchHistoryRecord(id);
          
          if (result.error) {
            throw new Error(result.error);
          }
          
          // 如果刪除的是當前選中的歷史記錄，清除選擇
          if (get().state.selectedHistoryId === id) {
            get().actions.clearSelectedHistoryDetail();
          }
          
          // 刷新歷史記錄
          const { actions } = get();
          await actions.fetchHistories();
          
          toast.success('歷史記錄已刪除');
        } catch (error) {
          console.error('刪除歷史記錄失敗:', error);
          const { toast } = await import('sonner');
          toast.error('刪除歷史記錄失敗: ' + (error instanceof Error ? error.message : String(error)));
          throw error;
        }
      },
      
      // 設置選中的歷史記錄詳情
      setSelectedHistoryDetail: (selectedHistoryDetail) => 
        set((store) => ({ 
          state: {
            ...store.state, 
            selectedHistoryDetail 
          }
        })),
      
      // 更新現有歷史記錄的搜索結果
      updateHistorySearchResults: async (historyId, searchResults) => {
        // 使用 toast.promise 包裹異步操作
        const promise = (async () => {
          try {
            // 使用 server action 更新 Firebase 中的數據
            const { updateSearchHistoryWithResults } = await import('@/app/actions');
            const result = await updateSearchHistoryWithResults(historyId, searchResults);
            
            if (!result.success) {
              throw new Error(result.error || '更新搜索結果失敗');
            }
            
            // 更新 Zustand store 狀態
            const currentState = get().state;
            
            // 更新當前選中的歷史記錄詳情（如果是當前選中的歷史記錄）
            if (currentState.selectedHistoryDetail && currentState.selectedHistoryDetail.id === historyId) {
              set((state) => ({
                state: {
                  ...state.state,
                  selectedHistoryDetail: {
                    ...state.state.selectedHistoryDetail!,
                    searchResults: searchResults,
                    resultsCount: searchResults.length,
                    lastUpdated: new Date()
                  }
                }
              }));
            }
            
            // 更新歷史記錄列表中的對應項目
            set((state) => ({
              state: {
                ...state.state,
                histories: state.state.histories.map(item => 
                  item.id === historyId 
                    ? { ...item, resultsCount: searchResults.length, lastUpdated: new Date() } 
                    : item
                )
              }
            }));
            
            // 返回成功信息
            return { success: true };
          } catch (error) {
            console.error('更新搜索結果失敗:', error);
            // 向上拋出錯誤以便 toast.promise 捕獲
            throw error;
          }
        })();

        // 配置 toast.promise
        const { toast } = await import('sonner');
        toast.promise(promise, {
          loading: '正在更新搜索結果...',
          success: '搜索結果已成功更新！',
          error: (err) => `更新搜索結果失敗: ${err instanceof Error ? err.message : String(err)}`,
        });

        // 返回 promise，以便調用方可以選擇等待
        return promise;
      },
      // 新增：更新用戶畫像
      updateHistoryPersonas: async (historyId: string, personas: any[]) => {
        // 使用 toast.promise 包裹異步操作
        const promise = (async () => {
          try {
            // 使用 server action 更新 Firebase 中的數據
            const { updateSearchHistoryWithPersonas } = await import('@/app/actions');
            const result = await updateSearchHistoryWithPersonas(historyId, personas);
            
            if (!result.success) {
              throw new Error(result.error || '更新用戶畫像失敗');
            }
            
            // 更新 Zustand store 狀態
            const currentState = get().state;
            
            // 更新當前選中的歷史記錄詳情（如果是當前選中的歷史記錄）
            if (currentState.selectedHistoryDetail && currentState.selectedHistoryDetail.id === historyId) {
              set((state) => ({
                state: {
                  ...state.state,
                  selectedHistoryDetail: {
                    ...state.state.selectedHistoryDetail!,
                    personas: personas,
                    personasLastUpdated: new Date()
                  }
                }
              }));
            }
            
            // 更新歷史記錄列表中的對應項目
            set((state) => ({
              state: {
                ...state.state,
                histories: state.state.histories.map(item => 
                  item.id === historyId 
                    ? { 
                        ...item, 
                        personas: personas,
                        personasLastUpdated: new Date()
                      } 
                    : item
                )
              }
            }));
            
            // 返回成功信息
            return { success: true };
          } catch (error) {
            console.error('更新用戶畫像失敗:', error);
            throw error;
          }
        })();

        // 配置 toast.promise
        const { toast } = await import('sonner');
        toast.promise(promise, {
          loading: '正在更新用戶畫像...',
          success: '用戶畫像已成功更新！',
          error: (err) => `更新用戶畫像失敗: ${err instanceof Error ? err.message : String(err)}`,
        });

        // 返回 promise，以便調用方可以選擇等待
        return promise;
      },
    }
  }));
};

// 建立Context
export type HistoryStoreApi = ReturnType<typeof createHistoryStore>;
const HistoryStoreContext = createContext<HistoryStoreApi | null>(null);

// 提供Provider組件
export interface HistoryProviderProps {
  children: ReactNode;
}

export function HistoryProvider({ children }: HistoryProviderProps) {
  const storeRef = useRef<HistoryStoreApi | null>(null);
  
  if (!storeRef.current) {
    storeRef.current = createHistoryStore();
  }
  
  return (
    <HistoryStoreContext.Provider value={storeRef.current}>
      {children}
    </HistoryStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useHistoryStore<T>(selector: (store: HistoryStore) => T): T {
  const historyStore = useContext(HistoryStoreContext);
  
  if (!historyStore) {
    throw new Error('useHistoryStore必須在HistoryProvider內部使用');
  }
  
  return useStore(historyStore, selector);
}

// 加載指定歷史記錄的詳細信息
const loadHistoryDetail = async (historyId: string) => {
  if (!historyId) {
    console.error('無法加載歷史記錄：historyId 為空');
    return null;
  }
  
  try {
    // 使用 toast 顯示加載狀態
    const { toast } = await import('sonner');
    toast.loading('正在加載歷史記錄詳情...');
    
    // 調用 server action 獲取歷史記錄詳情
    const { getHistoryDetail } = await import('@/app/actions');
    console.log(`開始獲取歷史記錄詳情 ID: ${historyId}`);
    const historyDetail = await getHistoryDetail(historyId);
    
    if (!historyDetail) {
      throw new Error('無法獲取歷史記錄詳情');
    }
    
    // 顯示成功通知
    toast.success('歷史記錄已加載');
    
    // 調試輸出
    console.log(`歷史記錄詳情加載成功 ID: ${historyId}`, {
      mainKeyword: historyDetail.mainKeyword,
      suggestionCount: historyDetail.suggestionCount,
      resultsCount: historyDetail.resultsCount,
      clustersCount: historyDetail.clustersCount,
      hasClusters: !!historyDetail.clusters,
      clusterKeysCount: historyDetail.clusters ? Object.keys(historyDetail.clusters).length : 0
    });
    
    // 返回歷史記錄詳情
    return historyDetail;
  } catch (error) {
    // 處理錯誤
    console.error('加載歷史記錄詳情失敗:', error);
    const { toast } = await import('sonner');
    toast.error('加載歷史記錄失敗: ' + (error instanceof Error ? error.message : String(error)));
    return null;
  }
}; 