// 從Provider導入hook和類型
import type { PastQueryStore } from '@/providers/PastQueryProvider';
import { usePastQueryStore } from '@/providers/PastQueryProvider';

// 重新導出所需的hook和類型
export { usePastQueryStore };
export type { PastQueryStore };

// 不再提供單獨的 useHistoryActions 函數
// export const useHistoryActions = () => usePastQueryStore((state) => state.actions); 

// Optional: If you need separate access to actions, you can add:
// export const usePastQueryActions = () => usePastQueryStore((state) => state.actions); 