// 從Provider導入hook和類型
import type {
    TabStore,
    TabType
} from '@/providers/tab-provider';
import { useTabStore } from '@/providers/tab-provider';

// 重新導出所需的hook和類型
export { useTabStore };
export type {
    TabStore,
    TabType
};

