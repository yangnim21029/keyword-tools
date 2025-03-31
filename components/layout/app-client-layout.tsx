'use client';

import { Tabs } from "@/components/ui/tabs";
import { useSettingsStore } from '@/store/settingsStore';
import { useTabStore } from '@/store/tabStore';
// Remove useState and related imports if no longer needed
// Remove history-related types and server actions
// import { deleteSearchHistoryRecord, fetchSearchHistory, getHistoryDetail, getRegions } from '@/app/actions';
import { getRegions } from '@/app/actions'; // Keep getRegions
// Remove SearchHistoryItem type extension
// import type { SearchHistoryItem as OriginalSearchHistoryItem } from '@/lib/schemas';
// interface SearchHistoryItem extends OriginalSearchHistoryItem {
//   type: 'keyword' | 'url' | 'serp';
// }

// Import the sub-components
import HeaderControls from './header-controls';
import HeaderSearchBar from './header-search-bar';
import RegionLanguageSelectors from './region-language-selectors';
import TabContents from './tab-contents';

// Update props interface to remove history data
interface AppClientLayoutProps {
  initialRegionsData: Awaited<ReturnType<typeof getRegions>>;
  // Remove initialHistoryData
}

export default function AppClientLayout({
  initialRegionsData,
  // Remove initialHistoryData from destructuring
}: AppClientLayoutProps) {
  // Tab and Settings state remain
  const activeTab = useTabStore(state => state.state.activeTab);
  const setActiveTab = useTabStore(state => state.actions.setActiveTab);
  const settingsActions = useSettingsStore(store => store.actions);

  // --- Remove Local State for History --- 
  // const [histories, setHistories] = useState<SearchHistoryItem[]>(...);
  // const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  // const [selectedHistoryDetail, setSelectedHistoryDetail] = useState<SearchHistoryItem | null>(null);
  // const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  // const [isDeleting, setIsDeleting] = useState(false);
  
  // --- Remove Event Handlers & Actions for History --- 
  // const handleSelectHistory = async (historyId: string | null) => { ... };
  // const handleDeleteHistory = async (idToDelete: string) => { ... };

  // Helper to convert tab type remains the same
  const convertTabType = (tab: string): 'keyword' | 'url' | 'serp' | 'settings' => {
    if (tab === 'keyword' || tab === 'url' || tab === 'serp' || tab === 'settings') {
      return tab;
    }
    return 'keyword';
  };

  // --- JSX Structure --- 
  return (
    <div className="w-full h-full overflow-auto">
      <Tabs 
        value={convertTabType(activeTab)}
        onValueChange={(val) => setActiveTab(val as any)} 
        className="w-full h-full"
      >
        {/* Header remains the same */}
        <div className="flex items-center border-b border-gray-200 dark:border-gray-800 py-3 px-4 gap-2 shadow-sm">
          <RegionLanguageSelectors initialRegionsData={initialRegionsData} />
          <HeaderSearchBar />
          <HeaderControls />
        </div>
        
        {/* Remove history-related props from TabContents */}
        <TabContents 
          activeTab={activeTab} 
          // Remove histories, selectedHistoryDetail, isLoadingDetail, isDeleting, onSelectHistory, onDeleteHistory
        />

      </Tabs>
    </div>
  );
}