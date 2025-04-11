// 從Provider導入hook和類型
import type {
  Language,
  PersonaModelType,
  SettingsState,
  SettingsStore
} from '@/providers/settings-provider';
import { useSettingsStore } from '@/providers/settings-provider';
import { createContext } from 'react';

// 重新導出所需的hook和類型
export { useSettingsStore };
export type { Language, PersonaModelType, SettingsState, SettingsStore };

export interface SettingsStoreState {
  // ... existing code ...
}

// This needs to be defined outside the store to avoid circular dependency
// if SettingsProvider needs to import from settingsStore
export const SettingsStoreContext =
  createContext<ReturnType<typeof useSettingsStore>>(null);
