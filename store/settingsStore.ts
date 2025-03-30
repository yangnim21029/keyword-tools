// 從Provider導入hook和類型
import type {
  Language,
  SettingsState,
  SettingsStore
} from '@/providers/settings-provider';
import { useSettingsStore } from '@/providers/settings-provider';

// 重新導出所需的hook和類型
export { useSettingsStore };
export type {
  Language, SettingsState, SettingsStore
};

