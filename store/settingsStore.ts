// 從Provider導入hook和類型
import type {
  Language,
  PersonaModelType,
  SettingsState,
  SettingsStore
} from '@/providers/SettingsProvider';
import { useSettingsStore } from '@/providers/SettingsProvider';

// 重新導出所需的hook和類型
export { useSettingsStore };
export type { Language, PersonaModelType, SettingsState, SettingsStore };
