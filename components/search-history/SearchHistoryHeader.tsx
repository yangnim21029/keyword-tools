'use client';

import { Loader2 } from "lucide-react";

interface SearchHistoryHeaderProps {
  isLoading: boolean;
  onRefresh?: () => void;
}

export function SearchHistoryHeader({ isLoading }: SearchHistoryHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-800">
      <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300">搜索歷史</h2>
      {isLoading && <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />}
    </div>
  );
} 