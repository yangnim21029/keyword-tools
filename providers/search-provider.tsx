'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

interface SearchState {
  // 搜索輸入
  searchInput: string;
  
  // 加載狀態
  isLoading: boolean;
  loadingMessage: string | null;
  
  // 儲存當前 tab 狀態
  activeTab: string;
}

interface SearchActions {
  // 操作方法
  setSearchInput: (input: string) => void;
  clearSearchInput: () => void;
  setLoading: (loading: boolean, message?: string | null) => void;
  setActiveTab: (tab: string) => void;
  
  // 綜合方法
  handleSearchSubmit: () => void;
}

export type SearchStore = {
  state: SearchState;
  actions: SearchActions;
};

// 默認初始狀態
export const defaultSearchState: SearchState = {
  searchInput: '',
  isLoading: false,
  loadingMessage: null,
  activeTab: 'keyword'
};

// 創建store工廠函數
const createSearchStore = (initState: SearchState = defaultSearchState) => {
  return createStore<SearchStore>()((set, get) => ({
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
      
      // 綜合方法 - 處理搜索提交
      handleSearchSubmit: () => {
        const { searchInput } = get().state;
        
        if (!searchInput.trim()) return;
        
        // 在客戶端環境中執行
        if (typeof window !== 'undefined') {
          // 清除歷史記錄選擇 - 使用自定義事件而不是直接調用 store
          setTimeout(() => {
            // 發布一個自定義事件，由真正的組件捕獲並處理
            const event = new CustomEvent('clearHistoryDetail');
            window.dispatchEvent(event);
          }, 0);
          
          // 根據目前活動的標籤頁觸發相應的操作
          // 我們將依靠頁面上的DOM元素ID來決定觸發哪個提交按鈕
          // 依次嘗試不同的提交按鈕，以確保至少一個會被處理
          ['keyword-search-submit', 'url-analysis-submit', 'serp-analysis-submit'].forEach(id => {
            const submitButton = document.querySelector(`#${id}`);
            if (submitButton) {
              submitButton.dispatchEvent(
                new MouseEvent('click', { bubbles: true })
              );
            }
          });
        }
      }
    }
  }));
};

// 建立Context
export type SearchStoreApi = ReturnType<typeof createSearchStore>;
const SearchStoreContext = createContext<SearchStoreApi | null>(null);

// 提供Provider組件
export interface SearchProviderProps {
  children: ReactNode;
}

export function SearchProvider({ children }: SearchProviderProps) {
  const storeRef = useRef<SearchStoreApi | null>(null);
  
  if (!storeRef.current) {
    storeRef.current = createSearchStore();
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
    <SearchStoreContext.Provider value={storeRef.current}>
      {children}
    </SearchStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useSearchStore<T>(selector: (store: SearchStore) => T): T {
  const searchStore = useContext(SearchStoreContext);
  
  if (!searchStore) {
    throw new Error('useSearchStore必須在SearchProvider內部使用');
  }
  
  return useStore(searchStore, selector);
} 