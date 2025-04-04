'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Import server actions
import {
  createKeywordResearch,
  fetchSearchVolume,
  getKeywordSuggestions,
  getUrlSuggestions,
  updateKeywordResearchKeywords,
} from '@/app/actions';
// Import types
import {
  type KeywordVolumeItem
} from '@/app/types'; // Assuming types index exports KeywordVolumeItem and CreateKeywordResearchInput

// --- Define the type for the query settings --- 
export interface QuerySettings {
  region: string;
  language: string;
  useAlphabet: boolean;
  useSymbols: boolean;
  // Remove userId as it's handled by Firebase Admin on the server
  // userId: string; 
}

// --- Define the type for the triggered query state --- 
interface TriggeredQuery { 
  tool: string; 
  query: string; 
  timestamp: number; 
}

interface QueryState {
  queryInput: string;
  isLoading: boolean;
  loadingMessage: string | null;
  activeTab: string; // Keep track of active tool tab
  suggestions: string[];
  volumeData: KeywordVolumeItem[];
  error: string | null;
  lastTriggeredQuery: TriggeredQuery | null;
}

interface QueryActions {
  setQueryInput: (input: string) => void; // Renamed for consistency
  clearQueryInput: () => void; // Renamed for consistency
  setLoading: (loading: boolean, message?: string | null) => void;
  setActiveTab: (tab: string) => void;
  setSuggestions: (suggestions: string[]) => void;
  setVolumeData: (data: KeywordVolumeItem[]) => void;
  setError: (error: string | null) => void;
  clearResults: () => void;
  triggerGlobalQuery: (tool: string, query: string) => void;
  handleQuerySubmit: (settings: QuerySettings) => Promise<void>;
}

export type QueryStore = {
  state: QueryState;
  actions: QueryActions;
};

export const defaultQueryState: QueryState = {
  queryInput: '',
  isLoading: false,
  loadingMessage: null,
  activeTab: 'keyword', // Default tab
  suggestions: [],
  volumeData: [],
  error: null,
  lastTriggeredQuery: null,
};

const createQueryStore = (initState: QueryState = defaultQueryState) => {
  return createStore<QueryStore>()((set, get) => ({
    state: {
      ...initState
    },
    
    actions: {
      setQueryInput: (queryInput) => set((store) => ({ state: { ...store.state, queryInput }})),
      clearQueryInput: () => set((store) => ({ state: { ...store.state, queryInput: '' }})),
      setLoading: (loading, message = null) => set((store) => ({
        state: {
          ...store.state,
          isLoading: loading,
          loadingMessage: loading ? (message ?? store.state.loadingMessage ?? '處理中...') : null
        }
      })),
      setActiveTab: (activeTab) => set((store) => ({ state: { ...store.state, activeTab }})),
      setSuggestions: (suggestions) => set(store => ({ state: { ...store.state, suggestions }})),
      setVolumeData: (volumeData) => set(store => ({ state: { ...store.state, volumeData }})),
      setError: (error) => set(store => ({ state: { ...store.state, error }})),
      clearResults: () => set(store => ({ state: { ...store.state, suggestions: [], volumeData: [], error: null }})),

      triggerGlobalQuery: (tool, query) => {
        console.log(`[QueryStore] Global Query triggered. Tool: ${tool}, Query: ${query}`);
        set((store) => ({
          state: {
            ...store.state,
            queryInput: query, 
            lastTriggeredQuery: { tool, query, timestamp: Date.now() }
          }
        }));
      },

      handleQuerySubmit: async (settings) => {
        const { queryInput } = get().state;
        const actions = get().actions;
        // Destructure settings - remove userId
        const { region, language, useAlphabet, useSymbols } = settings;

        if (!queryInput.trim()) {
          console.log(`[QueryStore] Skipping submit due to empty input.`);
          return;
        }

        actions.setLoading(true, '正在處理請求...');
        actions.clearResults();

        let suggestionsList: string[] = [];
        const isUrl = queryInput.startsWith('http');
        const currentInputType = isUrl ? 'url' : 'keyword';
        console.log(`[QueryStore] Input type detected: ${currentInputType}`);

        try {
          // 1. Fetch Suggestions
          actions.setLoading(true, '正在獲取建議...');
          let suggestionsResult;
          if (currentInputType === 'keyword') {
            suggestionsResult = await getKeywordSuggestions(queryInput, region, language, useAlphabet, useSymbols);
          } else {
            suggestionsResult = await getUrlSuggestions({ url: queryInput, region, language });
          }

          if (suggestionsResult.error || !suggestionsResult.suggestions || suggestionsResult.suggestions.length === 0) {
            const errorMsg = suggestionsResult.error || (currentInputType === 'keyword' ? '未找到關鍵詞建議' : '無法從 URL 獲取建議');
            throw new Error(errorMsg); // Throw error to be caught below
          }

          suggestionsList = suggestionsResult.suggestions;
          actions.setSuggestions(suggestionsList);

          // 2. Fetch Volume Data
          const suggestionsToProcess = suggestionsList.slice(0, 80);
          if (suggestionsToProcess.length === 0) {
            console.log("[QueryStore] No suggestions left after slicing, skipping volume fetch.");
            toast.info("建議列表為空，無法獲取搜索量。");
            actions.setLoading(false); // Stop loading
            return;
          }

          actions.setLoading(true, `正在獲取 ${suggestionsToProcess.length} 個關鍵詞搜索量...`);
          const volumeResult = await fetchSearchVolume(
             suggestionsToProcess,
             region,
             isUrl ? queryInput : undefined, // Pass URL only if input was URL
             language
          );

          if (volumeResult.error || !volumeResult.results) {
             throw new Error(volumeResult.error || '獲取搜索量數據失敗'); // Throw error
          }
          
          actions.setVolumeData(volumeResult.results);
          toast.success(`成功獲取 ${volumeResult.results.length} 個關鍵詞數據`);
          actions.setError(null);

          // 3. Save Keyword Research & Keywords
          let savedResearchId: string | null = null;
          try {
            actions.setLoading(true, '正在創建研究記錄...');
            
            // Create input object for the action.
            // Remove userId as Firebase Admin handles it server-side.
            const researchInput = {
                query: queryInput,
                // userId: userId, // Removed
                location: region,
                language: language,
                // Optional fields are not included here unless provided in settings
            };

            // Type assertion no longer needed as the schema is corrected.
            const saveResult = await createKeywordResearch(researchInput);

            if (saveResult.researchItem && saveResult.researchItem.id) {
              savedResearchId = saveResult.researchItem.id;
              console.log(`[QueryStore] KeywordResearch created successfully with ID: ${savedResearchId}`);
              toast.success('研究記錄已創建');

              // Demand: Notify KeywordResearchList to refresh after saving data.
              // Dispatch global event to notify other components (like KeywordResearchList) about the new data.
              if (typeof window !== 'undefined') {
                const saveEvent = new CustomEvent('researchSaved', { detail: saveResult.researchItem });
                window.dispatchEvent(saveEvent);
                console.log('[QueryStore] Dispatched researchSaved event.');
              }

              // Now, save the keywords using the new ID
              if (volumeResult.results && volumeResult.results.length > 0) {
                  actions.setLoading(true, '正在保存關鍵詞數據...');
                  // Assuming updateKeywordResearchKeywords action exists and works correctly
                  const keywordsUpdateResult = await updateKeywordResearchKeywords(savedResearchId, volumeResult.results);
                  if (keywordsUpdateResult.success) {
                      toast.success('關鍵詞數據已關聯至研究記錄');
                  } else {
                      throw new Error(keywordsUpdateResult.error || '保存關鍵詞數據失敗');
                  }
              }

            } else {
              throw new Error(saveResult.error || '創建關鍵詞研究失敗，未返回有效項目');
            }
          } catch (saveError) {
            console.error("[QueryStore] Error saving keywordResearch or keywords:", saveError);
            toast.error(`保存關鍵詞研究失敗: ${saveError instanceof Error ? saveError.message : '未知錯誤'}`);
          }

        } catch (error) {
           // Catch errors from suggestions or volume fetching
           console.error("[QueryStore] Error during query submission:", error);
           const message = error instanceof Error ? error.message : '處理查詢時發生錯誤';
           actions.setError(message);
           toast.error(message);
        } finally {
          actions.setLoading(false);
        }
      },
    }
  }))
};

// React Context and Provider Setup
export type QueryStoreApi = ReturnType<typeof createQueryStore>;
const QueryStoreContext = createContext<QueryStoreApi | null>(null);

export interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const storeRef = useRef<QueryStoreApi | null>(null); // Provide null as initial value
  if (!storeRef.current) {
    storeRef.current = createQueryStore();
  }

  // Optional: Effect to sync active tab with URL or other state management
  useEffect(() => {
    if (!storeRef.current) return;
    // Example: Sync active tab based on URL hash or external state
    const syncActiveTab = () => {
       // ... logic to determine active tab ...
       // storeRef.current?.getState().actions.setActiveTab(determinedTab);
    };
    // Example: Listener for tab changes if using browser history or tabs component events
    const handleTabChange = () => {
       // ... logic to get current tab and update store ...
    };
    // window.addEventListener('hashchange', syncActiveTab);
    // return () => window.removeEventListener('hashchange', syncActiveTab);
  }, []);

  return (
    <QueryStoreContext.Provider value={storeRef.current}>
      {children}
    </QueryStoreContext.Provider>
  );
}

// Hook to use the store
export function useQueryStore<T>(
  selector: (store: QueryStore) => T,
): T {
  const store = useContext(QueryStoreContext);

  if (!store) {
    throw new Error('useQueryStore must be used within a QueryProvider');
  }

  return useStore(store, selector);
} 