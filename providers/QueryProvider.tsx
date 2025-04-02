'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Import server actions and types
// Remove direct service import if no longer needed elsewhere in this file
// import { getSearchVolume } from '@/app/services/KeywordDataService';
import { getKeywordSuggestions, saveKeywordResearch, fetchSearchVolume } from '@/app/actions'; // Import fetchSearchVolume action
import { KeywordVolumeItem } from '@/lib/schemas'; // Assuming this is the correct path

// --- Import the past query store hook --- 
import { usePastQueryStore } from './PastQueryProvider'; 

// Define settings type for clarity
export interface SearchSettings {
  region: string;
  language: string;
  useAlphabet: boolean;
  useSymbols: boolean;
}

// --- Define the type for the new state --- 
interface TriggeredSearch { 
  tool: string; 
  query: string; 
  timestamp: number; 
}

interface QueryState {
  // 搜索輸入
  searchInput: string;
  
  // 加載狀態
  isLoading: boolean;
  loadingMessage: string | null;
  
  // 儲存當前 tab 狀態
  activeTab: string;

  // Add new state fields for results
  suggestions: string[];
  volumeData: KeywordVolumeItem[];
  error: string | null; // Add error state

  // --- Add new state for last trigger --- 
  lastTriggeredSearch: TriggeredSearch | null;
}

interface QueryActions {
  // 操作方法
  setSearchInput: (input: string) => void;
  clearSearchInput: () => void;
  setLoading: (loading: boolean, message?: string | null) => void;
  setActiveTab: (tab: string) => void;
  setSuggestions: (suggestions: string[]) => void; // Add setter
  setVolumeData: (data: KeywordVolumeItem[]) => void; // Add setter
  setError: (error: string | null) => void; // Add setter
  clearResults: () => void; // Action to clear results
  
  // --- Add new action for triggering search --- 
  triggerGlobalSearch: (tool: string, query: string) => void;
  
  // 綜合方法
  handleSearchSubmit: (settings: SearchSettings) => Promise<void>;
}

export type QueryStore = {
  state: QueryState;
  actions: QueryActions;
};

// 默認初始狀態
export const defaultQueryState: QueryState = {
  searchInput: '',
  isLoading: false,
  loadingMessage: null,
  activeTab: 'keyword',
  suggestions: [],
  volumeData: [],
  error: null,
  // --- Initialize new state --- 
  lastTriggeredSearch: null,
};

// 創建store工廠函數
const createQueryStore = (initState: QueryState = defaultQueryState) => {
  return createStore<QueryStore>()((set, get) => ({
    state: {
      ...initState
    },
    
    actions: {
      // 操作方法
      setSearchInput: (searchInput) => set((store) => ({
        state: {
          ...store.state,
          searchInput
        }
      })),
      
      clearSearchInput: () => set((store) => ({
        state: {
          ...store.state,
          searchInput: ''
        }
      })),
      
      setLoading: (loading, message = null) => set((store) => ({
        state: {
          ...store.state,
          isLoading: loading,
          loadingMessage: loading ? (message ?? store.state.loadingMessage ?? '處理中...') : null
        }
      })),
      
      setActiveTab: (activeTab) => set((store) => ({
        state: {
          ...store.state,
          activeTab
        }
      })),
      
      // Add new setters
      setSuggestions: (suggestions) => set(store => ({ state: { ...store.state, suggestions }})),
      setVolumeData: (volumeData) => set(store => ({ state: { ...store.state, volumeData }})),
      setError: (error) => set(store => ({ state: { ...store.state, error }})),
      clearResults: () => set(store => ({ state: { ...store.state, suggestions: [], volumeData: [], error: null }})),

      // --- Implement new trigger action --- 
      triggerGlobalSearch: (tool, query) => {
        console.log(`[QueryStore] Global search triggered. Tool: ${tool}, Query: ${query}`);
        set((store) => ({
          state: {
            ...store.state,
            // Update search input as well when triggered globally
            searchInput: query, 
            lastTriggeredSearch: { tool, query, timestamp: Date.now() }
          }
        }));
        // Optionally, immediately trigger handleSearchSubmit if it's a keyword search?
        // Or rely on useEffect in the Keyword page to react to lastTriggeredSearch
      },

      // 綜合方法 - Use passed settings
      handleSearchSubmit: async (settings) => { 
        const { searchInput, activeTab } = get().state;
        const actions = get().actions;
        const { region, language, useAlphabet, useSymbols } = settings;

        // 只處理 keyword tab 的搜索
        if (activeTab !== 'keyword' || !searchInput.trim()) {
          console.log(`[QueryStore] Skipping submit for tab: ${activeTab} or empty input.`);
          return;
        }
        
        actions.setLoading(true, '正在獲取建議...');
        actions.clearResults(); // 清除舊結果 (in this store)

        let suggestionsList: string[] = [];

        try {
          // 1. 獲取所有建議
          console.log(`[QueryStore] Fetching suggestions for: \"${searchInput}\", Region: ${region}, Lang: ${language}, Alpha: ${useAlphabet}, Sym: ${useSymbols}`); // Log settings
          const suggestionsResult = await getKeywordSuggestions(searchInput, region, language, useAlphabet, useSymbols);

          if (suggestionsResult.error || !suggestionsResult.suggestions || suggestionsResult.suggestions.length === 0) {
            const errorMsg = suggestionsResult.error || '未找到關鍵詞建議';
            console.warn(`[QueryStore] No suggestions found or error: ${errorMsg}`);
            actions.setError(errorMsg);
            toast.error(errorMsg);
            actions.setLoading(false);
            return;
          }
          
          suggestionsList = suggestionsResult.suggestions; // Store the full list
          actions.setSuggestions(suggestionsList);

          const suggestionsToProcess = suggestionsList.slice(0, 40);
          console.log(`[QueryStore] Got ${suggestionsList.length} suggestions, processing top ${suggestionsToProcess.length} for volume.`);

          if (suggestionsToProcess.length === 0) {
            console.log("[QueryStore] No suggestions left after slicing, skipping volume fetch.");
            toast.info("建議列表為空，無法獲取搜索量。");
            actions.setLoading(false);
            return;
          }

          actions.setLoading(true, `正在獲取 ${suggestionsToProcess.length} 個關鍵詞搜索量...`);
          // --- Call the fetchSearchVolume ACTION instead of the service --- 
          const volumeResult = await fetchSearchVolume( // Use the action
             suggestionsToProcess, 
             region, 
             searchInput, // Pass the original searchInput as the 'url'/'context' maybe?
             language
          );

          if (volumeResult.error) {
            console.error(`[QueryStore] Error fetching volume: ${volumeResult.error}`);
            actions.setError(volumeResult.error);
            toast.error(volumeResult.error);
          } else {
            console.log(`[QueryStore] Received ${volumeResult.results.length} volume results.`);
            actions.setVolumeData(volumeResult.results);
            actions.setError(null);
            toast.success(`成功獲取 ${volumeResult.results.length} 個關鍵詞數據`);

            // --- ADD HISTORY SAVING LOGIC HERE --- 
            try {
              actions.setLoading(true, '正在保存歷史記錄...');
              const saveResult = await saveKeywordResearch(
                searchInput,
                region,
                language,
                suggestionsList,
                volumeResult.results
                // No need to pass clusters
              );
              
              if (saveResult.historyId) { 
                console.log(`[QueryStore] History saved successfully with ID: ${saveResult.historyId}`);
                toast.success('搜索結果已保存至歷史記錄');
              } else {
                throw new Error(saveResult.error || '保存歷史記錄失敗');
              }
            } catch (saveError) {
              console.error("[QueryStore] Error saving history:", saveError);
              toast.error(`保存歷史記錄失敗: ${saveError instanceof Error ? saveError.message : '未知錯誤'}`);
            } 
            // --- END HISTORY SAVING LOGIC --- 
          }

        } catch (error) {
          console.error("[QueryStore] Unexpected error during search process:", error);
          const errorMsg = error instanceof Error ? error.message : '搜索過程中發生未知錯誤';
          actions.setError(errorMsg);
          toast.error(errorMsg);
        } finally {
          actions.setLoading(false);
        }
      }
    }
  }));
};

// 建立Context
export type QueryStoreApi = ReturnType<typeof createQueryStore>;
const QueryStoreContext = createContext<QueryStoreApi | null>(null);

// 提供Provider組件
export interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const storeRef = useRef<QueryStoreApi | null>(null);
  
  if (!storeRef.current) {
    storeRef.current = createQueryStore();
  }
  
  // 從 tabStore 同步 activeTab 狀態
  useEffect(() => {
    // 延遲導入，避免在服務器端執行
    if (typeof window !== 'undefined') {
      const syncActiveTab = async () => {
        try {
          const { useTabStore } = await import('../store/tabStore');
          // 使用 EventListener 替代直接 hook 調用
          const handleTabChange = () => {
            if (storeRef.current) {
              // 使用自定義事件傳遞 activeTab
              const tabEvent = new CustomEvent('getActiveTab', {
                detail: { callback: (activeTab: string) => {
                  if (storeRef.current) {
                    storeRef.current.setState((store) => ({
                      state: {
                        ...store.state,
                        activeTab
                      },
                      actions: store.actions
                    }));
                  }
                }}
              });
              window.dispatchEvent(tabEvent);
            }
          };
          
          // 初始同步
          handleTabChange();
          
          // 監聽標籤變化事件
          window.addEventListener('tabChanged', handleTabChange);
          
          // 清理
          return () => {
            window.removeEventListener('tabChanged', handleTabChange);
          };
        } catch (error) {
          console.warn('無法同步活動標籤:', error);
        }
      };
      
      syncActiveTab();
    }
  }, []);
  
  return (
    <QueryStoreContext.Provider value={storeRef.current}>
      {children}
    </QueryStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useQueryStore<T>(selector: (store: QueryStore) => T): T {
  const queryStore = useContext(QueryStoreContext);
  
  if (!queryStore) {
    throw new Error('useQueryStore必須在QueryProvider內部使用');
  }
  
  return useStore(queryStore, selector);
} 