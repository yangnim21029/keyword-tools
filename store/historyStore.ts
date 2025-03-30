// 從Provider導入hook和類型
import type { HistoryStore } from '@/providers/history-provider';
import { useHistoryStore } from '@/providers/history-provider';

// 重新導出所需的hook和類型
export { useHistoryStore };
export type { HistoryStore };

// 不再提供單獨的 useHistoryActions 函數
// export const useHistoryActions = () => useHistoryStore((state) => state.actions); 