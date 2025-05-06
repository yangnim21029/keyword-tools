"use client";

import React, { Dispatch, SetStateAction } from "react";
import { ErrorDisplay } from "@/app/writing/components/error-display";
import { GenerateArticleButton } from "@/app/actions/actions-buttons";

interface FinalArticleGeneratorControlsProps {
  handleGenerateFinalArticle: () => void;
  researchPrompt: string | null;
  isGeneratingArticle: boolean;
  isLoadingPrompt: boolean;
  articleError: string | null;
  setArticleError: Dispatch<SetStateAction<string | null>>;
}

export function FinalArticleGeneratorControls({
  handleGenerateFinalArticle,
  researchPrompt,
  isGeneratingArticle,
  isLoadingPrompt,
  articleError,
  setArticleError,
}: FinalArticleGeneratorControlsProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold leading-none tracking-tight mb-4">
        精修你的文章
      </h3>

      {articleError && (
        <ErrorDisplay
          error={articleError}
          onDismiss={() => setArticleError(null)}
        />
      )}

      <div className="flex justify-end pt-4">
        <GenerateArticleButton
          onClick={handleGenerateFinalArticle}
          isLoading={isGeneratingArticle}
          disabled={isLoadingPrompt || isGeneratingArticle || !researchPrompt}
        />
      </div>
    </div>
  );
}
