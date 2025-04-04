// 從Provider導入hook和類型
import type { ResearchStore } from '@/providers/keywordResearchProvider';
import { useResearchStore } from '@/providers/keywordResearchProvider';

// 重新導出所需的hook和類型
export { useResearchStore };
export type { ResearchStore };

// 不再提供單獨的 useHistoryActions 函數
// export const useHistoryActions = () => usePastResearchStore((state) => state.actions); 

// Optional: If you need separate access to actions, you can add:
// export const usePastResearchActions = () => usePastResearchStore((state) => state.actions); 