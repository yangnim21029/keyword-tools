"use client";

import { Button } from "@/components/ui/button";
import { useRepeatActionOnHold } from "@/hooks/useRepeatActionOnHold";
import { useCallback } from "react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
}: PaginationControlsProps) {
  const handleNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  }, [currentPage, totalPages, onPageChange]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  }, [currentPage, onPageChange]);

  const nextPageHandlers = useRepeatActionOnHold({
    callback: handleNextPage,
    disabled: currentPage >= totalPages,
  });

  const prevPageHandlers = useRepeatActionOnHold({
    callback: handlePrevPage,
    disabled: currentPage <= 1,
  });

  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-muted-foreground">
        第 {currentPage} / {totalPages} 頁
      </span>
      <div className="space-x-2">
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage <= 1}
          {...prevPageHandlers}
        >
          上一頁
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={currentPage >= totalPages}
          {...nextPageHandlers}
        >
          下一頁
        </Button>
      </div>
    </div>
  );
}
