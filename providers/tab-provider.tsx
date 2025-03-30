'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type TabType = 'keyword' | 'url' | 'serp' | 'history';

interface TabState {
  activeTab: TabType;
}

interface TabActions {
  setActiveTab: (tab: TabType) => void;
}

export type TabStore = {
  state: TabState;
  actions: TabActions;
};

// 默認初始狀態
export const defaultTabState: TabState = {
  activeTab: 'keyword',
};

// 創建store工廠函數
const createTabStore = (initState: TabState = defaultTabState) => {
  return createStore<TabStore>()((set) => ({
    state: {
      ...initState
    },
    
    actions: {
      setActiveTab: (activeTab) => {
        set((store) => ({
          state: {
            ...store.state,
            activeTab
          }
        }));
        
        // 觸發標籤變更事件
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('tabChanged'));
        }
      },
    }
  }));
};

// 建立Context
export type TabStoreApi = ReturnType<typeof createTabStore>;
const TabStoreContext = createContext<TabStoreApi | null>(null);

// 提供Provider組件
export interface TabProviderProps {
  children: ReactNode;
}

export function TabProvider({ children }: TabProviderProps) {
  const storeRef = useRef<TabStoreApi | null>(null);
  
  if (!storeRef.current) {
    // 初始化store
    storeRef.current = createTabStore();
  }
  
  // 添加事件監聽器來處理 getActiveTab 事件
  useEffect(() => {
    if (typeof window !== 'undefined' && storeRef.current) {
      const handleGetActiveTab = (event: Event) => {
        const customEvent = event as CustomEvent;
        if (customEvent.detail && customEvent.detail.callback && storeRef.current) {
          const activeTab = storeRef.current.getState().state.activeTab;
          customEvent.detail.callback(activeTab);
        }
      };
      
      window.addEventListener('getActiveTab', handleGetActiveTab);
      
      return () => {
        window.removeEventListener('getActiveTab', handleGetActiveTab);
      };
    }
  }, []);
  
  return (
    <TabStoreContext.Provider value={storeRef.current}>
      {children}
    </TabStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useTabStore<T>(selector: (store: TabStore) => T): T {
  const tabStore = useContext(TabStoreContext);
  
  if (!tabStore) {
    throw new Error('useTabStore必須在TabProvider內部使用');
  }
  
  return useStore(tabStore, selector);
} 