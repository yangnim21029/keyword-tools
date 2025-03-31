'use client';

import KeywordSearchTab from '@/components/keyword-tool/keyword-search-tab';
import SerpAnalysisTab from '@/components/serp-tool/serp-analysis-tab';
import SettingsTab from '@/components/settings-tool/settings-tab';
import { TabsContent } from "@/components/ui/tabs";
import UrlAnalysisTab from '@/components/url-tool/url-analysis-tab';
// Remove history store import if no longer used
// import { useHistoryStore } from '@/store/historyStore';
import type { Language } from '@/providers/settings-provider';
import { useSearchStore } from '@/store/searchStore';
import { useSettingsStore } from '@/store/settingsStore';
// Re-introduce SearchHistoryItem import and assume it includes 'type'
import type { SearchHistoryItem } from '@/lib/schemas';

// Assuming SearchHistoryItem includes 'type' and potentially 'url'
interface ExtendedSearchHistoryItem extends SearchHistoryItem {
    type: 'keyword' | 'url' | 'serp';
    url?: string;
    // Add other fields if needed by specific tabs based on researchDetail
    serpResults?: any; // Example
}

// Update props interface: historyDetail -> researchDetail
interface TabContentsProps {
  activeTab: string;
  researchDetail: ExtendedSearchHistoryItem | null; // Use renamed prop
}

export default function TabContents({ 
  activeTab, 
  researchDetail // Use renamed prop
}: TabContentsProps) {
  // Get necessary state/actions for passing down to individual tabs
  const settingsState = useSettingsStore(store => store.state);
  const settingsActions = useSettingsStore(store => store.actions);
  const searchState = useSearchStore(store => store.state); 

  const convertTabType = (tab: string): 'keyword' | 'url' | 'serp' | 'settings' => {
    if (tab === 'keyword' || tab === 'url' || tab === 'serp' || tab === 'settings') {
      return tab;
    }
    return researchDetail?.type || 'keyword'; // Use researchDetail type as fallback
  };

  return (
    <div className="px-6 pt-4 overflow-auto h-[calc(100vh-theme(space.14)-1px)]"> {/* Adjust height as needed */}
      <TabsContent value="keyword" className="mt-0 h-full">
         <KeywordSearchTab 
            // Pass down researchDetail instead of historyDetail
            researchDetail={researchDetail?.type === 'keyword' ? researchDetail : null}
            activeTab={convertTabType(activeTab)}
            region={settingsState.region} 
            language={settingsState.language}
            regions={settingsState.regions} 
            languages={settingsState.languages} 
            onRegionChange={settingsActions.setRegion}
            onLanguageChange={(val) => settingsActions.setLanguage(val as Language)}
            filterZeroVolume={settingsState.filterZeroVolume}
            maxResults={settingsState.maxResults}
            globalSearchInput={searchState.searchInput} 
            useAlphabet={settingsState.useAlphabet}
            useSymbols={settingsState.useSymbols}
         />
      </TabsContent>
      <TabsContent value="url" className="mt-0 h-full">
         <UrlAnalysisTab 
            // Pass down researchDetail instead of historyDetail
            researchDetail={researchDetail?.type === 'url' ? researchDetail : null}
            activeTab={convertTabType(activeTab)}
            region={settingsState.region}
            language={settingsState.language}
            regions={settingsState.regions} 
            languages={settingsState.languages} 
            onRegionChange={settingsActions.setRegion}
            onLanguageChange={(val: string) => settingsActions.setLanguage(val as Language)}
            filterZeroVolume={settingsState.filterZeroVolume}
            maxResults={settingsState.maxResults}
            globalSearchInput={searchState.searchInput}
         />
      </TabsContent>
      <TabsContent value="serp" className="mt-0 h-full">
         <SerpAnalysisTab 
            // Pass down researchDetail only if SERP is part of keyword research flow
            // If SERP is completely separate, this might be null or removed
            researchDetail={researchDetail?.type === 'serp' ? researchDetail : null}
            activeTab={convertTabType(activeTab)}
            region={settingsState.region}
            language={settingsState.language}
            regions={settingsState.regions} 
            languages={settingsState.languages} 
            onRegionChange={settingsActions.setRegion}
            onLanguageChange={(val: string) => settingsActions.setLanguage(val as Language)}
            globalSearchInput={searchState.searchInput} 
         />
      </TabsContent>
      <TabsContent value="settings" className="mt-0 h-full">
        <SettingsTab />
      </TabsContent>
    </div>
  );
}
