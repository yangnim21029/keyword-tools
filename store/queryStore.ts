// 從Provider導入hook和類型
import type { QueryStore } from '@/providers/QueryProvider';
import { useQueryStore } from '@/providers/QueryProvider';

// 重新導出所需的hook和類型
export { useQueryStore };
export type { QueryStore };
