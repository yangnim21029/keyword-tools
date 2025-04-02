// 從Provider導入hook和類型
import type { TabStore, TabType } from '@/providers/TabProvider';
import { useTabStore } from '@/providers/TabProvider';

// 重新導出所需的hook和類型
export { useTabStore };
export type {
    TabStore,
    TabType
};

