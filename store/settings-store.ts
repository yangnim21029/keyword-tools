// 從Provider導入hook和類型
import type {
  Language,
  PersonaModelType,
  SettingsStore
} from '@/providers/settings-provider';
import { useSettingsStore as useSettingsStoreFromProvider } from '@/providers/settings-provider';
import { createContext } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 重新導出所需的hook和類型
export { useSettingsStoreFromProvider };
export type { Language, PersonaModelType, SettingsStore };

/**
 * Settings state type (本地定義).
 */
export interface SettingsStoreState {
  filterZeroVolume: boolean;
  maxResults: number;
  useAlphabet: boolean;
  useSymbols: boolean;
  personaModel: PersonaModelType;
}

/**
 * Settings actions type (本地定義).
 */
export interface SettingsActions {
  setFilterZeroVolume: (value: boolean) => void;
  setMaxResults: (value: number) => void;
  setUseAlphabet: (checked: boolean | 'indeterminate') => void;
  setUseSymbols: (checked: boolean | 'indeterminate') => void;
  setPersonaModel: (model: PersonaModelType) => void;
}

/**
 * 組合 State 和 Actions 的類型
 */
export interface SettingsStoreInterface {
  state: SettingsStoreState;
  actions: SettingsActions;
}

// This needs to be defined outside the store to avoid circular dependency
// if SettingsProvider needs to import from settingsStore
export const SettingsStoreContext =
  createContext<ReturnType<typeof useSettingsStoreFromProvider>>(null);

// --- Zustand Store ---
export const useSettingsStore = create<SettingsStoreInterface>()(
  persist(
    set => ({
      state: {
        filterZeroVolume: false,
        maxResults: 30, // Default max results
        useAlphabet: false,
        useSymbols: false,
        personaModel: 'gpt-4o-mini' // Default model
      },
      actions: {
        setFilterZeroVolume: value =>
          set(state => ({
            state: { ...state.state, filterZeroVolume: value }
          })),
        setMaxResults: value =>
          set(state => ({ state: { ...state.state, maxResults: value } })),
        setUseAlphabet: checked =>
          set(state => ({
            state: { ...state.state, useAlphabet: Boolean(checked) }
          })),
        setUseSymbols: checked =>
          set(state => ({
            state: { ...state.state, useSymbols: Boolean(checked) }
          })),
        setPersonaModel: model =>
          set(state => ({ state: { ...state.state, personaModel: model } }))
      }
    }),
    { name: 'settings-store' }
  )
);
