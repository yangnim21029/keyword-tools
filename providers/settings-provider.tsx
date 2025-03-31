'use client';

import { type ReactNode, createContext, useContext, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

export type Language = 'zh-TW' | 'en-US';

export interface SettingsState {
  language: Language;
  region: string;
  languages: Record<string, string[]>;
  regions: string[];
  regionMap: Record<string, string>;
  languageMap: Record<string, string>;
  isGoogleAdsConnected: boolean;
  isSerperConnected: boolean;
  googleTokenExpiry: Date | null;
  
  // 搜索選項設置
  useAlphabet: boolean;
  useSymbols: boolean;
  filterZeroVolume: boolean;
  maxResults: number;
}

interface SettingsActions {
  setLanguage: (language: Language) => void;
  setRegion: (region: string) => void;
  setLanguages: (languages: Record<string, string[]>) => void;
  setRegions: (regions: string[]) => void;
  setRegionMap: (map: Record<string, string>) => void;
  setLanguageMap: (map: Record<string, string>) => void;
  setGoogleAdsConnected: (connected: boolean) => void;
  setSerperConnected: (connected: boolean) => void;
  setGoogleTokenExpiry: (expiry: Date | null) => void;
  
  // 搜索選項設置
  setUseAlphabet: (use: boolean) => void;
  setUseSymbols: (use: boolean) => void;
  setFilterZeroVolume: (filter: boolean) => void;
  setMaxResults: (max: number) => void;
}

export type SettingsStore = {
  state: SettingsState;
  actions: SettingsActions;
};

// 預設設置
export const defaultSettings: SettingsState = {
  language: 'zh-TW',
  region: 'TW',
  languages: {},
  regions: [],
  regionMap: {},
  languageMap: {},
  isGoogleAdsConnected: false,
  isSerperConnected: false,
  googleTokenExpiry: null,
  
  // 搜索選項默認值
  useAlphabet: true,
  useSymbols: false,
  filterZeroVolume: false,
  maxResults: 40
};

// 創建store工廠函數
const createSettingsStore = (initState: SettingsState = defaultSettings) => {
  return createStore<SettingsStore>()((set) => ({
    state: {
      ...initState
    },
    
    actions: {
      setLanguage: (language) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            language 
          } 
        })),
      
      setRegion: (region) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            region 
          } 
        })),
      
      setLanguages: (languages) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            languages 
          } 
        })),
      
      setRegions: (regions) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            regions 
          } 
        })),
      
      setRegionMap: (regionMap) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            regionMap 
          } 
        })),
      
      setLanguageMap: (languageMap) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            languageMap 
          } 
        })),
      
      setGoogleAdsConnected: (isGoogleAdsConnected) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            isGoogleAdsConnected 
          } 
        })),
      
      setSerperConnected: (isSerperConnected) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            isSerperConnected 
          } 
        })),
      
      setGoogleTokenExpiry: (googleTokenExpiry) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            googleTokenExpiry 
          } 
        })),
      
      setUseAlphabet: (use) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            useAlphabet: use 
          } 
        })),
      
      setUseSymbols: (use) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            useSymbols: use 
          } 
        })),
      
      setFilterZeroVolume: (filter) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            filterZeroVolume: filter 
          } 
        })),
      
      setMaxResults: (max) => 
        set((store) => ({ 
          state: { 
            ...store.state, 
            maxResults: max 
          } 
        }))
    }
  }));
};

// 建立Context
export type SettingsStoreApi = ReturnType<typeof createSettingsStore>;
const SettingsStoreContext = createContext<SettingsStoreApi | null>(null);

// 提供Provider組件
export interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const storeRef = useRef<SettingsStoreApi | null>(null);
  
  if (!storeRef.current) {
    // 初始化store，並從localStorage載入設置
    let initialSettings = defaultSettings;
    
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('settings');
        if (savedSettings) {
          const parsedSettings = JSON.parse(savedSettings);
          
          // 確保解析後的設置包含所有必要的字段
          initialSettings = {
            ...defaultSettings,
            ...parsedSettings
          };
          
          // 處理日期字符串轉換
          if (parsedSettings.googleTokenExpiry) {
            initialSettings.googleTokenExpiry = new Date(parsedSettings.googleTokenExpiry);
          }
        }
      } catch (error) {
        console.error('無法加載設置:', error);
      }
    }
    
    storeRef.current = createSettingsStore(initialSettings);
  }
  
  // 保存設置到localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && storeRef.current) {
      const unsubscribe = storeRef.current.subscribe((state) => {
        try {
          localStorage.setItem('settings', JSON.stringify(state.state));
        } catch (error) {
          console.error('無法保存設置:', error);
        }
      });
      
      return () => unsubscribe();
    }
  }, []);
  
  return (
    <SettingsStoreContext.Provider value={storeRef.current}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useSettingsStore<T>(selector: (store: SettingsStore) => T): T {
  const settingsStore = useContext(SettingsStoreContext);
  
  if (!settingsStore) {
    throw new Error('useSettingsStore必須在SettingsProvider內部使用');
  }
  
  return useStore(settingsStore, selector);
} 