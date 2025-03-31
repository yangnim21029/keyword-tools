'use client';

import { getRegions } from '@/app/actions';
import { Tabs } from "@/components/ui/tabs";
import type { SearchHistoryItem } from '@/lib/schemas';
import type { Language } from "@/providers/settings-provider";
import { useSettingsStore } from "@/store/settingsStore";
import { useTabStore } from '@/store/tabStore';
import { useEffect } from 'react';
import HeaderControls from './header-controls';
import HeaderSearchBar from './header-search-bar';
import RegionLanguageSelectors from './region-language-selectors';
import TabContents from './tab-contents';

// Assuming SearchHistoryItem includes 'type' 
interface ExtendedSearchHistoryItem extends SearchHistoryItem {
    type: 'keyword' | 'url' | 'serp';
    // Add other potential fields like url
    url?: string;
}

interface KeywordResearchDetailClientLayoutProps { // Renamed interface
  researchDetail: ExtendedSearchHistoryItem | null; // Renamed prop
  initialRegionsData: Awaited<ReturnType<typeof getRegions>>;
}

export default function KeywordResearchDetailClientLayout({ // Renamed component
  researchDetail, // Use renamed prop
  initialRegionsData 
}: KeywordResearchDetailClientLayoutProps) { // Use renamed interface
  const activeTab = useTabStore(state => state.state.activeTab);
  const setActiveTab = useTabStore(state => state.actions.setActiveTab);
  const settingsActions = useSettingsStore(store => store.actions);

  useEffect(() => {
    // Use researchDetail
    if (researchDetail?.type) {
      setActiveTab(researchDetail.type);
      if (researchDetail.region) {
        settingsActions.setRegion(researchDetail.region);
      }
      if (researchDetail.language) {
        settingsActions.setLanguage(researchDetail.language as Language);
      }
    }
  }, [researchDetail, setActiveTab, settingsActions]); // Use researchDetail dependency

  if (!researchDetail) {
    return <div>沒有找到關鍵詞研究詳情。</div>; // Updated text
  }

  const convertTabType = (tab: string): 'keyword' | 'url' | 'serp' | 'settings' => {
    if (tab === 'keyword' || tab === 'url' || tab === 'serp' || tab === 'settings') {
      return tab;
    }
    return researchDetail.type || 'keyword'; // Use researchDetail
  };

  return (
    <div className="w-full h-full overflow-auto">
      <Tabs 
        value={convertTabType(activeTab)} 
        onValueChange={(val) => setActiveTab(val as any)} 
        className="w-full h-full"
      >
        {/* Header Section */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-3 px-4 gap-2 shadow-sm">
          <RegionLanguageSelectors initialRegionsData={initialRegionsData} />
          <HeaderSearchBar />
          <HeaderControls />
        </div>
        
        {/* Tab Contents Section - Pass researchDetail */}
        <TabContents 
          activeTab={activeTab} 
          researchDetail={researchDetail} // Pass renamed prop
        />
      </Tabs>
    </div>
  );
} 