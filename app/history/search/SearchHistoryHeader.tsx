'use client';

import { Loader2, RefreshCw } from "lucide-react";

interface SearchHistoryHeaderProps {
  isLoading: boolean;
  onRefresh?: () => void;
}

export function SearchHistoryHeader({ isLoading, onRefresh }: SearchHistoryHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">搜索歷史</h2>
      <div className="flex items-center gap-2">
        {isLoading && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
        {onRefresh && (
          <button 
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
            title="刷新歷史記錄"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
} 