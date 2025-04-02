'use client';

import { LoadingButton } from "@/components/ui/LoadingButton";
import { useQueryStore } from "@/providers/QueryProvider";

interface SerpTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Optionally pass counts to display in badges
  resultsCount?: number;
  domainsCount?: number;
}

export function SerpTabs({ activeTab, onTabChange, resultsCount, domainsCount }: SerpTabsProps) {
  const tabs = [
    { id: 'results', label: '搜索結果', count: resultsCount },
    { id: 'domains', label: '網域分析', count: domainsCount },
    // Add more tabs here if needed
  ];

  // 使用全局加載狀態
  const isLoading = useQueryStore(store => store.state.isLoading);

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <nav className="-mb-px flex space-x-2" aria-label="Tabs">
        {tabs.map((tab) => (
          // Render only if count is provided and > 0, or if no count is provided
          (tab.count === undefined || tab.count > 0) && (
            <LoadingButton
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              isLoading={isLoading && activeTab === tab.id}
              variant={activeTab === tab.id ? "default" : "ghost"}
              className={`
                whitespace-nowrap py-1.5 px-4 text-sm font-medium transition-colors duration-150 ease-in-out
                focus:outline-none rounded-full h-auto
                ${
                  activeTab === tab.id
                    ? 'bg-pink-500 text-white shadow-sm'
                    : 'text-gray-800 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                }
              `}
              aria-current={activeTab === tab.id ? 'page' : undefined}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 inline-block py-0.5 px-1.5 rounded-full text-xs font-medium ${ 
                  activeTab === tab.id 
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </LoadingButton>
          )
        ))}
      </nav>
    </div>
  );
} 