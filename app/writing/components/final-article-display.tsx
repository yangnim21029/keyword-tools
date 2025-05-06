"use client";

import React from 'react';
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface FinalArticleDisplayProps {
  finalArticle: string | null;
  isGeneratingArticle: boolean;
  handleStartOver: () => void;
  handleCopyToClipboard: (text: string | null) => void;
}

export const FinalArticleDisplay: React.FC<FinalArticleDisplayProps> = ({
  finalArticle,
  isGeneratingArticle,
  handleStartOver,
  handleCopyToClipboard,
}) => {
  if (isGeneratingArticle || !finalArticle) {
    return null;
  }

  return (
    <div className="border-t border-dashed dark:border-neutral-700 pt-6">
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed bg-gray-50 dark:bg-neutral-900 p-4 rounded-md border dark:border-neutral-800 max-h-[60vh] overflow-y-auto">
        {finalArticle}
      </pre>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleStartOver}>Start Over</Button>
        <Button variant="secondary" size="sm" onClick={() => handleCopyToClipboard(finalArticle)}>
          Copy Article
        </Button>
      </div>
    </div>
  );
}; 