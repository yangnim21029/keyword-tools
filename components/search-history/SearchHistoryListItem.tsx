'use client';

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HistoryListItem } from '@/lib/schemas';
import { formatRelativeDate, formatTime } from '@/utils/dateUtils';
import { Search, Trash2 } from "lucide-react";
import React from 'react';

// 与 SearchHistory.tsx 保持一致的类型
/*
interface SearchHistoryItemData {
  id: string;
  mainKeyword: string;
  region: string;
  language: string;
  timestamp: Date;
  suggestionCount: number;
  resultsCount: number;
  clustersCount?: number;
}
*/

interface Props {
  item: HistoryListItem;
  isSelected: boolean;
  isDeleting: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string, event: React.MouseEvent) => void;
}

export function SearchHistoryListItem({ item, isSelected, isDeleting, onSelect, onDelete }: Props) {
  
  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(item.id, e);
  };

  return (
    <div
      className={`p-3 border border-transparent rounded-lg cursor-pointer group relative transition-colors duration-150 ease-in-out
        ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm'
            : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
        }
      `}
      onClick={() => onSelect(item.id)}
      role="button"
      tabIndex={0}
      aria-selected={isSelected}
    >
      {/* Delete Button */} 
      {!isDeleting && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 p-1 absolute top-2 right-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 transition-opacity z-10"
                onClick={handleDeleteClick}
                disabled={isDeleting}
                aria-label={`刪除記錄 ${item.mainKeyword}`}
              >
                {isDeleting ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-red-500 dark:border-red-400 border-t-transparent" />
                ) : (
                  <Trash2 className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="bg-gray-800 dark:bg-gray-900 text-white">
              <p className="text-xs">刪除此記錄</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Item Content */} 
      <div className="flex items-center gap-2">
        <Search className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
        <span className="font-medium text-sm truncate text-gray-800 dark:text-gray-200">{item.mainKeyword}</span>
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          <span className="inline-flex items-center text-[10px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
            {item.region}
          </span>
          <span className="inline-flex items-center text-[10px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded-full">
            {item.language}
          </span>
        </div>
        <span className="text-[11px] text-gray-500 dark:text-gray-500 flex-shrink-0 ml-2">
          {formatRelativeDate(item.timestamp)} {formatTime(item.timestamp)}
        </span>
      </div>

    </div>
  );
}