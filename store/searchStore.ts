// 從Provider導入hook和類型
import type { SearchStore } from '@/providers/search-provider';
import { useSearchStore } from '@/providers/search-provider';

// 重新導出所需的hook和類型
export { useSearchStore };
export type { SearchStore };
