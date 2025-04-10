'use client';

import {
  type Keyword,
  type KeywordResearchItem,
  type KeywordResearchListItem,
  type UpdateClustersInput,
  type UpdatePersonasInput
} from '@/app/types';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { toast } from 'sonner';
import { create, useStore } from 'zustand';

import {
  deleteKeywordResearch,
  fetchKeywordResearchDetail,
  fetchKeywordResearchList,
  updateKeywordResearchClusters,
  updateKeywordResearchKeywords,
  updateKeywordResearchPersonas
} from '@/app/actions';

// 精简状态定义，只保留必要字段
interface ResearchState {
  researches: KeywordResearchListItem[];
  loading: boolean;
  error: string | null;
  selectedResearchId: string | null;
  selectedResearchDetail: KeywordResearchItem | null;
  loadingDetail: boolean;
  serpAnalysisRequest: { keyword: string; region: string; language: string } | null;
}

interface ResearchActions {
  setSelectedResearchId: (id: string | null) => Promise<void>;
  clearSelectedResearchDetail: () => void;
  fetchResearches: (forceRefresh?: boolean) => Promise<void>;
  saveClusters: (researchId: string, input: UpdateClustersInput) => Promise<void>;
  savePersonas: (researchId: string, input: UpdatePersonasInput) => Promise<void>;
  saveKeywords: (researchId: string, keywords: Keyword[]) => Promise<void>;
  deleteResearch: (id: string) => Promise<void>;
  _handleResearchSavedOrUpdated: (research: KeywordResearchItem) => void;
  requestSerpAnalysis: (payload: { keyword: string; region: string; language: string }) => void;
  clearSerpAnalysisRequest: () => void;
}

export type ResearchStore = {
  state: ResearchState;
  actions: ResearchActions;
};

// 默认状态
export const defaultResearchState: ResearchState = {
  researches: [],
  loading: false,
  error: null,
  selectedResearchId: null,
  selectedResearchDetail: null,
  loadingDetail: false,
  serpAnalysisRequest: null,
};

// 使用简化的zustand store创建，避免过度嵌套
const useResearchStoreBase = create<ResearchStore>((set, get) => ({
  state: {
    ...defaultResearchState,
  },
  actions: {
    // 设置选中的研究ID并获取详情
    setSelectedResearchId: async (researchId: string | null) => {
      set((state) => ({
        state: {
          ...state.state,
          selectedResearchId: researchId,
          selectedResearchDetail: null,
          loadingDetail: !!researchId,
          error: null,
          serpAnalysisRequest: null,
        }
      }));

      if (!researchId) {
        set((state) => ({ 
          state: { 
            ...state.state, 
            loadingDetail: false 
          } 
        }));
        return;
      }

      try {
        const researchDetail = await fetchKeywordResearchDetail(researchId);
        
        set((state) => {
          // Only update if the selected ID hasn't changed
          if (state.state.selectedResearchId === researchId) {
            if (!researchDetail) {
              return {
                state: {
                  ...state.state,
                  selectedResearchDetail: null,
                  error: `Research with ID ${researchId} not found`,
                  loadingDetail: false,
                }
              };
            }
            
            return {
              state: {
                ...state.state,
                selectedResearchDetail: researchDetail,
                error: null,
                loadingDetail: false,
              }
            };
          }
          return state;
        });
        
        if (!researchDetail) {
          toast.error(`Research with ID ${researchId} not found`);
        }
      } catch (error) {
        console.error('[ResearchProvider] Error fetching detail:', error);
        const message = error instanceof Error ? error.message : 'Failed to load research details';
        
        set((state) => {
          if (state.state.selectedResearchId === researchId) {
            return {
              state: {
                ...state.state,
                selectedResearchDetail: null,
                error: message,
                loadingDetail: false,
              }
            };
          }
          return state;
        });
        
        toast.error(message);
      }
    },

    // 清除选中研究详情
    clearSelectedResearchDetail: () => set((state) => ({
      state: {
        ...state.state,
        selectedResearchId: null,
        selectedResearchDetail: null,
        serpAnalysisRequest: null,
      }
    })),

    // 获取研究列表
    fetchResearches: async (forceRefresh = false) => {
      const { state } = get();
      
      // 避免重复获取数据
      if (!forceRefresh && state.researches.length > 0 && !state.loading) {
        console.log('[ResearchProvider] Skipping fetch: already have data.');
        return;
      }
      
      set((state) => ({ 
        state: { 
          ...state.state, 
          loading: true, 
          error: null 
        } 
      }));
      
      console.log('[ResearchProvider] Fetching research list...');
      
      try {
        const result = await fetchKeywordResearchList(undefined, undefined, 50, forceRefresh);
        
        if (result.error || !result.data) {
          throw new Error(result.error || '從 Action 返回的數據無效');
        }
        
        set((state) => ({
          state: {
            ...state.state,
            researches: result.data,
            loading: false,
          }
        }));
      } catch (err) {
        console.error('[ResearchProvider] Error fetching list:', err);
        const message = err instanceof Error ? err.message : '獲取研究列表失敗';
        
        set((state) => ({
          state: {
            ...state.state,
            loading: false,
            error: message,
          }
        }));
        
        toast.error(message);
      }
    },

    // 保存聚类结果
    saveClusters: async (researchId: string, input: UpdateClustersInput) => {
      // 获取原始详情用于回滚
      const originalDetail = get().state.selectedResearchDetail 
        ? { ...get().state.selectedResearchDetail } 
        : null;
      
      // 乐观更新UI
      if (get().state.selectedResearchId === researchId && get().state.selectedResearchDetail) {
        set((state) => ({
          state: {
            ...state.state,
            selectedResearchDetail: state.state.selectedResearchDetail 
              ? { 
                ...state.state.selectedResearchDetail, 
                clusters: input.clusters 
              } 
              : null
          }
        }));
      }

      try {
        const result = await updateKeywordResearchClusters(researchId, input);
        if (!result.success) throw new Error(result.error || "保存分群結果失敗");
        toast.success("分群結果已成功保存");
      } catch (error) {
        console.error("Failed to save clusters:", error);
        const message = error instanceof Error ? error.message : "保存分群結果失敗";
        toast.error(message);
        
        // 回滚UI
        if (get().state.selectedResearchId === researchId) {
          set((state) => ({
            state: {
              ...state.state,
              selectedResearchDetail: originalDetail as KeywordResearchItem | null,
            }
          }));
        }
      }
    },

    // 保存画像数据
    savePersonas: async (researchId: string, input: UpdatePersonasInput) => {
      const originalDetail = get().state.selectedResearchDetail 
        ? { ...get().state.selectedResearchDetail } 
        : null;
      
      // 乐观更新
      if (get().state.selectedResearchId === researchId && get().state.selectedResearchDetail) {
        set((state) => ({
          state: {
            ...state.state,
            selectedResearchDetail: state.state.selectedResearchDetail 
              ? { 
                ...state.state.selectedResearchDetail, 
                personas: input.personas 
              } 
              : null
          }
        }));
      }

      try {
        const result = await updateKeywordResearchPersonas(researchId, input);
        if (!result.success) throw new Error(result.error || "儲存用戶畫像失敗");
        toast.success("用戶畫像已儲存");
      } catch (error) {
        console.error("儲存用戶畫像時出錯:", error);
        const message = error instanceof Error ? error.message : "儲存用戶畫像失敗";
        toast.error(message);
        
        // 回滚UI
        if (get().state.selectedResearchId === researchId) {
          set((state) => ({
            state: {
              ...state.state,
              selectedResearchDetail: originalDetail as KeywordResearchItem | null,
            }
          }));
        }
      }
    },

    // 保存关键词数据
    saveKeywords: async (researchId: string, keywords: Keyword[]) => {
      const originalDetail = get().state.selectedResearchDetail 
        ? { ...get().state.selectedResearchDetail } 
        : null;
      
      // 乐观更新
      if (get().state.selectedResearchId === researchId && get().state.selectedResearchDetail) {
        set((state) => ({
          state: {
            ...state.state,
            selectedResearchDetail: state.state.selectedResearchDetail 
              ? { 
                ...state.state.selectedResearchDetail, 
                keywords 
              } 
              : null
          }
        }));
      }

      try {
        const result = await updateKeywordResearchKeywords(researchId, keywords);
        if (!result.success) throw new Error(result.error || "儲存關鍵詞失敗");
        toast.success("關鍵詞已儲存");
      } catch (error) {
        console.error("儲存關鍵詞時出錯:", error);
        const message = error instanceof Error ? error.message : "儲存關鍵詞失敗";
        toast.error(message);
        
        // 回滚UI
        if (get().state.selectedResearchId === researchId) {
          set((state) => ({
            state: {
              ...state.state,
              selectedResearchDetail: originalDetail as KeywordResearchItem | null,
            }
          }));
        }
      }
    },

    // 删除研究记录
    deleteResearch: async (id: string) => {
      const originalResearches = [...get().state.researches];
      const originalSelectedId = get().state.selectedResearchId;
      const originalSelectedDetail = get().state.selectedResearchDetail;

      // 乐观UI更新
      set((state) => ({
        state: {
          ...state.state,
          researches: state.state.researches.filter((r) => r.id !== id),
          selectedResearchId: state.state.selectedResearchId === id ? null : state.state.selectedResearchId,
          selectedResearchDetail: state.state.selectedResearchId === id ? null : state.state.selectedResearchDetail,
        }
      }));

      try {
        const result = await deleteKeywordResearch(id);
        if (!result.success) throw new Error(result.error || "刪除失敗");
        toast.success("研究記錄已刪除");
      } catch (error) {
        console.error("刪除研究記錄時出錯:", error);
        const message = error instanceof Error ? error.message : "刪除研究記錄失敗";
        toast.error(message);
        
        // 回滚UI
        set((state) => ({
          state: {
            ...state.state,
            researches: originalResearches,
            selectedResearchId: originalSelectedId,
            selectedResearchDetail: originalSelectedDetail,
          }
        }));
      }
    },
    
    // 处理研究记录保存/更新后的操作
    _handleResearchSavedOrUpdated: (research: KeywordResearchItem) => {
      set((state) => {
        // 查找是否已存在
        const index = state.state.researches.findIndex(r => r.id === research.id);
        
        // 转换为列表项
        const listItem: KeywordResearchListItem = {
          id: research.id,
          query: research.query,
          userId: research.userId,
          createdAt: research.createdAt,
          updatedAt: research.updatedAt,
          location: research.location,
          language: research.language,
          searchEngine: research.searchEngine,
          device: research.device,
          isFavorite: research.isFavorite,
          tags: research.tags,
        };
        
        // 更新或添加到列表
        const newResearches = [...state.state.researches];
        if (index !== -1) {
          newResearches[index] = listItem;
        } else {
          newResearches.unshift(listItem);
        }
        
        return {
          state: {
            ...state.state,
            researches: newResearches,
            selectedResearchDetail: state.state.selectedResearchId === research.id 
              ? research 
              : state.state.selectedResearchDetail,
          }
        };
      });
    },

    // 请求SERP分析
    requestSerpAnalysis: (payload: { keyword: string; region: string; language: string }) => {
      console.log('[ResearchProvider] Setting SERP analysis request:', payload);
      set((state) => ({
        state: {
          ...state.state,
          serpAnalysisRequest: payload,
        }
      }));
    },

    // 清除SERP分析请求
    clearSerpAnalysisRequest: () => {
      console.log('[ResearchProvider] Clearing SERP analysis request');
      set((state) => ({
        state: {
          ...state.state,
          serpAnalysisRequest: null,
        }
      }));
    },
  }
}));

// Context设置
export const ResearchContext = createContext<typeof useResearchStoreBase | undefined>(undefined);

export interface ResearchProviderProps {
  children: ReactNode;
  initialResearches?: KeywordResearchListItem[];
}

// 简化后的Provider组件
export function ResearchProvider({ children, initialResearches }: ResearchProviderProps) {
  // 使用useMemo确保不重复创建store
  const store = useMemo(() => {
    // 如果提供了初始数据，更新store
    if (initialResearches?.length) {
      useResearchStoreBase.setState({
        state: {
          ...useResearchStoreBase.getState().state,
          researches: initialResearches,
        }
      });
    }
    return useResearchStoreBase;
  }, [initialResearches]);
  return (
    <ResearchContext.Provider value={store}>
      {children}
    </ResearchContext.Provider>
  );
}

// Hook使用简化
export function useResearchStore<T>(selector: (store: ResearchStore) => T): T {
  const store = useContext(ResearchContext);

  if (!store) {
    throw new Error('useResearchStore must be used within a ResearchProvider');
  }

  return useStore(store, selector);
} 