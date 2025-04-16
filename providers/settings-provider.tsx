'use client';

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useRef
} from 'react';
import { StoreApi, useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

// Corrected import path and names for constants
import { LANGUAGES, REGIONS } from '@/app/config/constants'; // Use correct path and names

// Assume constants are defined elsewhere, e.g., in @/lib/constants/geo-data
// Placeholder import - replace with your actual constant path

export type Language = 'en' | 'zh-TW' | 'ja' | 'ko';
// Define type for Persona Model
export type PersonaModelType = 'gpt-o3-mini' | 'gpt-o3-mini';

export interface SettingsState {
  language: Language;
  region: string;
  languages: Record<string, string>;
  regions: Record<string, string>;
  isGoogleAdsConnected: boolean;
  isSerperConnected: boolean;
  googleTokenExpiry: Date | null;

  // 搜索選項設置
  useAlphabet: boolean;
  useSymbols: boolean;
  filterZeroVolume: boolean;
  maxResults: number;
  // Add persona model state
  personaModel: PersonaModelType;
}

interface SettingsActions {
  setLanguage: (language: Language) => void;
  setRegion: (region: string) => void;
  setLanguages: (languages: Record<string, string>) => void;
  setRegions: (regions: Record<string, string>) => void;
  setGoogleAdsConnected: (connected: boolean) => void;
  setSerperConnected: (connected: boolean) => void;
  setGoogleTokenExpiry: (expiry: Date | null) => void;

  // 搜索選項設置
  setUseAlphabet: (use: boolean) => void;
  setUseSymbols: (use: boolean) => void;
  setFilterZeroVolume: (filter: boolean) => void;
  setMaxResults: (max: number) => void;
  // Add persona model action
  setPersonaModel: (model: PersonaModelType) => void;
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
  regions: {},
  isGoogleAdsConnected: false,
  isSerperConnected: false,
  googleTokenExpiry: null,

  // 搜索選項默認值
  useAlphabet: false,
  useSymbols: false,
  filterZeroVolume: false,
  maxResults: 40,
  // Add default persona model
  personaModel: 'gpt-o3-mini'
};

// 創建store工廠函數
const createSettingsStore = (initState: SettingsState = defaultSettings) => {
  return createStore<SettingsStore>()(set => ({
    state: {
      ...initState
    },

    actions: {
      setLanguage: language =>
        set(store => ({
          state: {
            ...store.state,
            language
          }
        })),

      setRegion: region =>
        set(store => ({
          state: {
            ...store.state,
            region
          }
        })),

      setLanguages: languages =>
        set(store => ({
          state: {
            ...store.state,
            languages
          }
        })),

      setRegions: regions =>
        set(store => ({
          state: {
            ...store.state,
            regions
          }
        })),

      setGoogleAdsConnected: isGoogleAdsConnected =>
        set(store => ({
          state: {
            ...store.state,
            isGoogleAdsConnected
          }
        })),

      setSerperConnected: isSerperConnected =>
        set(store => ({
          state: {
            ...store.state,
            isSerperConnected
          }
        })),

      setGoogleTokenExpiry: googleTokenExpiry =>
        set(store => ({
          state: {
            ...store.state,
            googleTokenExpiry
          }
        })),

      setUseAlphabet: use =>
        set(store => ({
          state: {
            ...store.state,
            useAlphabet: use
          }
        })),

      setUseSymbols: use =>
        set(store => ({
          state: {
            ...store.state,
            useSymbols: use
          }
        })),

      setFilterZeroVolume: filter =>
        set(store => ({
          state: {
            ...store.state,
            filterZeroVolume: filter
          }
        })),

      setMaxResults: max =>
        set(store => ({
          state: {
            ...store.state,
            maxResults: max
          }
        })),

      // Implement setPersonaModel action
      setPersonaModel: model =>
        set(store => ({
          state: {
            ...store.state,
            personaModel: model
          }
        }))
    }
  }));
};

// 建立Context
export const SettingsStoreContext =
  createContext<StoreApi<SettingsStore> | null>(null);

// 提供Provider組件
export interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const storeRef = useRef<ReturnType<typeof createSettingsStore> | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSettingsStore(); // Initialize the store
  }

  // Use useEffect to set initial languages and regions
  useEffect(() => {
    if (storeRef.current) {
      const { setLanguages, setRegions } = storeRef.current.getState().actions;
      // Check if data is already loaded to prevent unnecessary updates
      if (
        Object.keys(storeRef.current.getState().state.languages).length === 0
      ) {
        console.log('[SettingsProvider] Setting initial languages...');
        setLanguages(LANGUAGES); // Use correct constant name
      }
      if (Object.keys(storeRef.current.getState().state.regions).length === 0) {
        console.log('[SettingsProvider] Setting initial regions...');
        // Need to flip REGIONS map for the UI { code: name }
        const regionsForUI = Object.entries(REGIONS).reduce(
          (acc, [name, code]) => {
            acc[code] = name;
            return acc;
          },
          {} as Record<string, string>
        );
        setRegions(regionsForUI); // Use correct constant name (after flipping)
      }
    }
  }, []); // Empty dependency array ensures this runs only once on mount

  return (
    <SettingsStoreContext.Provider value={storeRef.current}>
      {children}
    </SettingsStoreContext.Provider>
  );
}

// 自定義hook以使用store
export function useSettingsStore<T>(selector: (state: SettingsStore) => T): T {
  const settingsStore = useContext(SettingsStoreContext);
  if (!settingsStore) {
    throw new Error('useSettingsStore必須在SettingsProvider內部使用');
  }
  return useStore(settingsStore, selector);
}
