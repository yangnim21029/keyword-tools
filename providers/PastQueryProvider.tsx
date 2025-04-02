'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Directly define necessary types within this file
interface ClusteringResult {
  clusters: Record<string, string[]>;
  metadata?: {
    timestamp: Date;
    algorithm?: string;
    parameters?: Record<string, any>;
  };
}

// Type for history items used in the store and UI
interface SearchHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: Date;
  suggestionCount: number;
  resultsCount: number;
  
  // Optional fields
  suggestions?: string[];
  searchResults?: any[];
  clusters?: Record<string, string[]> | null;
  clustersCount?: number;
  personas?: any[];
  personasLastUpdated?: Date;
  
  // Field used for preview in list items
  suggestionsPreview?: string[];
}

// Type for history items as returned by the server
interface ServerHistoryItem {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: string | Date; // Can be string or Date from server
  suggestionCount: number;
  resultsCount: number;
  suggestions?: string[];
  searchResults?: any[];
  clusters?: Record<string, string[]> | null;
  clustersCount?: number;
  suggestionsPreview?: string[];
}

// State type for the history store
interface PastQueryState {
  histories: SearchHistoryItem[]; // List of history items
  loading: boolean; // Loading state for the list
  error: string | null; // Error for the list
  selectedHistoryId: string | null; // ID of the currently selected history item
  selectedHistoryDetail: SearchHistoryItem | null; // Detailed data for the selected item
  loadingDetail: boolean; // Loading state for fetching details
}

// Actions type for the history store
interface PastQueryActions {
  // Basic operations
  setSelectedHistoryId: (id: string | null) => void;
  setSelectedHistoryDetail: (history: SearchHistoryItem | null) => void;
  clearSelectedHistoryDetail: () => void;
  
  // API interactions (calling Server Actions)
  fetchHistories: (forceRefresh?: boolean) => Promise<void>;
  saveClusteringResults: (clusterId: string, result: Record<string, string[]>) => Promise<void>;
  deleteHistory: (id: string) => Promise<void>;
  updateHistorySearchResults: (historyId: string, searchResults: any[]) => Promise<{ success: boolean } | void>;
  updateHistoryPersonas: (historyId: string, personas: any[]) => Promise<{ success: boolean } | void>;
}

// Type defining the complete store structure
export type PastQueryStore = {
  state: PastQueryState;
  actions: PastQueryActions;
};

// Default initial state for the store
export const defaultPastQueryState: PastQueryState = {
  histories: [],
  loading: false,
  error: null,
  selectedHistoryId: null,
  selectedHistoryDetail: null,
  loadingDetail: false,
};

// Factory function to create the Zustand store instance
const createPastQueryStore = (initState: PastQueryState = defaultPastQueryState) => {
  return createStore<PastQueryStore>()((set, get) => ({
    state: {
      ...initState,
    },
    
    actions: {
      // Action to set the selected history ID and fetch its details
      setSelectedHistoryId: (historyId) => {
        // Immediately update the ID, clear detail, and set loading state
        set((state) => ({
          state: {
            ...state.state,
            selectedHistoryId: historyId,
            selectedHistoryDetail: null, // Clear previous detail
            loadingDetail: !!historyId, // Set loading only if a new ID is provided
          }
        }));

        // If the ID is cleared (null), stop loading and do nothing further
        if (!historyId) {
          return;
        }

        // Asynchronously fetch the history detail using the correct Server Action
        (async () => {
          try {
            // Import the correct Server Action for fetching details
            const { fetchKeywordResearchHistoryDetail } = await import('@/app/actions'); 
            console.log('[PastQueryProvider] Fetching history detail:', historyId);

            const result = await fetchKeywordResearchHistoryDetail(historyId); // Await the Server Action

            // Handle potential errors returned by the Server Action
            if (result.error) {
              throw new Error(result.error);
            }

            const historyDetail = result.data; // Extract data from the result
            console.log('[PastQueryProvider] Fetched history detail:', historyDetail?.id);

            // Update the store with the fetched detail and clear loading state
            set((state) => ({
              state: {
                ...state.state,
                // Only update detail if the selected ID hasn't changed during fetch
                selectedHistoryDetail: state.state.selectedHistoryId === historyId ? historyDetail : state.state.selectedHistoryDetail,
                loadingDetail: false, // Clear loading state
              }
            }));

          } catch (error) {
            // Handle errors during fetch/processing
            console.error('[PastQueryProvider] Failed to fetch history detail:', error);
            toast.error('獲取歷史記錄詳情失敗: ' + (error instanceof Error ? error.message : String(error)));
            // Reset detail and loading state on error
            set((store) => ({
                state: {
                    ...store.state,
                    selectedHistoryDetail: null,
                    loadingDetail: false,
                }
            }));
          }
        })(); // End async IIFE
      }, // End setSelectedHistoryId
      
      // Action to directly set the selected history detail (e.g., after an update)
      setSelectedHistoryDetail: (history) =>
        set((store) => ({
            state: { ...store.state, selectedHistoryDetail: history },
        })),
      
      // Action to clear the current selection
      clearSelectedHistoryDetail: () =>
        set((store) => ({
          state: {
            ...store.state,
            selectedHistoryId: null,
            selectedHistoryDetail: null,
          }
        })),
      
      // Action to fetch the list of history items
      fetchHistories: async (forceRefresh = false) => {
          set((store) => ({ state: { ...store.state, loading: true, error: null } })); // Set loading state
          try {
              // Import the correct Server Action for fetching the list
              const { fetchKeywordResearchHistoryList } = await import('@/app/actions'); 
              const result = await fetchKeywordResearchHistoryList(50, forceRefresh); // Call Server Action (limit 50)

              // Handle potential errors from Server Action
              if (result.error) {
                throw new Error(result.error);
              }
              
              // Process the received data (especially timestamps)
              const processedHistories = (result.data || []).map((item: ServerHistoryItem): SearchHistoryItem => {
                    let timestampDate: Date;
                    // Robust timestamp parsing logic
                    if (item.timestamp instanceof Date) {
                        timestampDate = item.timestamp;
                    } else if (item.timestamp && typeof item.timestamp === 'object' && 'seconds' in item.timestamp && typeof (item.timestamp as any).seconds === 'number') {
                        timestampDate = new Date((item.timestamp as any).seconds * 1000); // Firestore Timestamp
                    } else if (typeof item.timestamp === 'string' || typeof item.timestamp === 'number') {
                         timestampDate = new Date(item.timestamp); // ISO string or number
                    } else {
                        console.warn(`[PastQueryProvider] Invalid timestamp format for item ${item.id}:`, item.timestamp);
                        timestampDate = new Date(); // Fallback
                    }
                    // Validate parsed date
                    if (isNaN(timestampDate.getTime())) {
                       console.warn(`[PastQueryProvider] Failed to parse timestamp for item ${item.id}, using current date:`, item.timestamp);
                       timestampDate = new Date(); // Fallback
                    }
                    // Map to the SearchHistoryItem structure
                    return {
                        id: item.id,
                        mainKeyword: item.mainKeyword || '',
                        region: item.region || '',
                        language: item.language || '',
                        timestamp: timestampDate,
                        suggestionCount: typeof item.suggestionCount === 'number' ? item.suggestionCount : 0,
                        resultsCount: typeof item.resultsCount === 'number' ? item.resultsCount : 0,
                        suggestionsPreview: Array.isArray(item.suggestionsPreview) ? item.suggestionsPreview : [],
                        clustersCount: typeof item.clustersCount === 'number' ? item.clustersCount : 0,
                        clusters: item.clusters || null,
                        suggestions: item.suggestions,
                        searchResults: item.searchResults,
                    };
                });

              // Update store with processed list and clear loading
              set((store) => ({
                  state: {
                      ...store.state,
                      histories: processedHistories,
                      loading: false
                  }
              }));
          } catch (error) {
              // Handle errors during fetch/processing
              const errorMessage = error instanceof Error ? error.message : '獲取歷史記錄失敗';
              console.error('[PastQueryProvider] Error fetching histories:', error);
              toast.error(errorMessage);
              set((store) => ({ state: { ...store.state, loading: false, error: errorMessage } }));
          }
      }, // End fetchHistories

      // Action to save clustering results
      saveClusteringResults: async (clusterId, result) => {
          // Optional: Optimistic update UI first
          set((store) => ({
              state: {
                  ...store.state,
                  selectedHistoryDetail: store.state.selectedHistoryDetail
                      ? { ...store.state.selectedHistoryDetail, clusters: result }
                      : null,
              },
          }));
          try {
              // Import the correct Server Action for saving clusters
              const { updateHistoryWithClusters } = await import('@/app/actions'); 
              const response = await updateHistoryWithClusters(clusterId, result); // Call Server Action
              // Handle potential failure response
              if (!response.success) {
                  throw new Error(response.error || '保存聚類結果失敗');
              }
              toast.success('分群結果已保存');
          } catch (error) {
              console.error('保存分群結果失敗:', error);
              toast.error('保存分群結果失敗');
              // Optional: Revert optimistic update on error
          }
      }, // End saveClusteringResults
      
      // Action to delete a history item
      deleteHistory: async (id: string) => {
          const originalHistories = get().state.histories; // Store original list for potential revert
          // Optimistic update: remove item from UI immediately
          set((store) => ({
              state: {
                  ...store.state,
                  histories: store.state.histories.filter(h => h.id !== id),
                  // Clear selection if the deleted item was selected
                  selectedHistoryId: store.state.selectedHistoryId === id ? null : store.state.selectedHistoryId,
                  selectedHistoryDetail: store.state.selectedHistoryId === id ? null : store.state.selectedHistoryDetail,
              }
          }));
          try {
              // Import the correct Server Action for deleting
              const { deleteKeywordResearchHistory } = await import('@/app/actions'); 
              const response = await deleteKeywordResearchHistory(id); // Call Server Action
              // Handle potential failure response
              if (!response.success) {
                  throw new Error(response.error || '刪除歷史記錄失敗');
              }
              toast.success('歷史記錄已刪除');
          } catch (error) {
              console.error('刪除歷史記錄失敗:', error);
              toast.error('刪除歷史記錄失敗');
              // Revert optimistic update on error
              set({ state: { ...get().state, histories: originalHistories } });
          }
      }, // End deleteHistory
      
      // Action to update search results for a history item
       updateHistorySearchResults: async (historyId, searchResults) => {
        try {
          // Import the correct Server Action for updating results
          const { updateKeywordResearchHistoryWithResults } = await import('@/app/actions'); 
          const response = await updateKeywordResearchHistoryWithResults(historyId, searchResults); // Call Server Action
          // Handle response and update UI optimistically if needed
          if (response?.success) {
            // Optimistic update: update detail in store if it's the selected one
            set(store => ({
              state: {
                ...store.state,
                selectedHistoryDetail: store.state.selectedHistoryDetail && store.state.selectedHistoryDetail.id === historyId
                  ? { ...store.state.selectedHistoryDetail, searchResults: searchResults }
                  : store.state.selectedHistoryDetail,
              },
            }));
            toast.success('搜索結果已更新');
            return { success: true };
          } else {
            throw new Error(response?.error || '更新搜索結果失敗');
          }
        } catch (error) {
          console.error('更新歷史記錄搜索結果時出錯:', error);
          toast.error(error instanceof Error ? error.message : '更新搜索結果失敗');
          // No explicit return here, implicitly returns void/undefined on error
        }
      }, // End updateHistorySearchResults

      // Action to update personas for a history item
      updateHistoryPersonas: async (historyId, personas) => {
          try {
              // Import the correct Server Action for updating personas
              const { updateKeywordResearchHistoryWithPersonas } = await import('@/app/actions'); 
              const response = await updateKeywordResearchHistoryWithPersonas(historyId, personas); // Call Server Action
               // Handle response and update UI optimistically if needed
              if (response?.success) {
                  // Optimistic update: update detail in store if it's the selected one
                  set(store => ({
                      state: {
                          ...store.state,
                          selectedHistoryDetail: store.state.selectedHistoryDetail && store.state.selectedHistoryDetail.id === historyId
                              ? { ...store.state.selectedHistoryDetail, personas: personas, personasLastUpdated: new Date() }
                              : store.state.selectedHistoryDetail,
                      },
                  }));
                  toast.success('用戶畫像已更新');
                  return { success: true };
              } else {
                  throw new Error(response?.error || '更新用戶畫像失敗');
              }
          } catch (error) {
              console.error('更新用戶畫像時出錯:', error);
              toast.error(error instanceof Error ? error.message : '更新用戶畫像失敗');
              // No explicit return here, implicitly returns void/undefined on error
          }
      }, // End updateHistoryPersonas
    } // End actions object
  })); // End createStore callback
}; // End createPastQueryStore factory

// Context for the store API
export type PastQueryStoreApi = ReturnType<typeof createPastQueryStore>;
const PastQueryStoreContext = createContext<PastQueryStoreApi | null>(null);

// Provider component
export interface PastQueryProviderProps {
  children: ReactNode;
}

export function PastQueryProvider({ children }: PastQueryProviderProps) {
  const storeRef = useRef<PastQueryStoreApi | null>(null);

  // Initialize the store only once
  if (!storeRef.current) {
    storeRef.current = createPastQueryStore();
  }

  // Fetch initial history data when the provider mounts
  useEffect(() => {
    if (storeRef.current) {
      storeRef.current.getState().actions.fetchHistories(); // Fetch on mount
    }
  }, []); // Empty dependency array ensures this runs only once

  return (
    <PastQueryStoreContext.Provider value={storeRef.current}>
      {children}
    </PastQueryStoreContext.Provider>
  );
}

// Custom hook to use the store
export function usePastQueryStore<T>(selector: (store: PastQueryStore) => T): T {
  const pastQueryStore = useContext(PastQueryStoreContext);

  // Provide a helpful error message if used outside the provider
  if (!pastQueryStore) {
    throw new Error('usePastQueryStore must be used within a PastQueryProvider');
  }

  // Use Zustand's useStore hook to subscribe to store changes
  return useStore(pastQueryStore, selector);
}

// Removed commented out loadHistoryDetail helper function 