"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

interface ArticleRefinementInputProps {
  inputText: string;
  setInputText: (value: string) => void;
  targetUrl: string;
  setTargetUrl: (value: string) => void;
  isGeneratingArticle: boolean;
  isLoadingPrompt: boolean;
  scrapeFailedForReferenceUrl?: boolean;
  referenceArticleTextManual?: string;
  setReferenceArticleTextManual?: (value: string) => void;
  targetUrlError?: string | null;
}

export const ArticleRefinementInput: React.FC<ArticleRefinementInputProps> = ({
  inputText,
  setInputText,
  targetUrl,
  setTargetUrl,
  isGeneratingArticle,
  isLoadingPrompt,
  scrapeFailedForReferenceUrl = false,
  referenceArticleTextManual = "",
  setReferenceArticleTextManual,
  targetUrlError,
}) => {
  const handleReferenceTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    if (setReferenceArticleTextManual) {
      setReferenceArticleTextManual(e.target.value);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="inputText" className="text-base font-medium">
          貼上你的文章 (Paste Your Article)
        </Label>
        <Textarea
          id="inputText"
          placeholder="Paste the article draft here if you want the AI to refine it based on the prompt and the target URL below..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="min-h-[250px] font-mono text-sm mt-2"
          disabled={isGeneratingArticle || isLoadingPrompt}
        />
      </div>
      <div>
        <Label htmlFor="targetUrl" className="text-base font-medium">
          參考文章 URL (Reference Article URL)
        </Label>
        <p className="text-xs text-muted-foreground mb-2">
          Provide a URL for the AI to analyze and draw suggestions from for
          refining your text.
        </p>
        <Input
          id="targetUrl"
          type="url"
          placeholder="https://example.com/reference-article"
          value={targetUrl}
          onChange={(e) => setTargetUrl(e.target.value)}
          className="h-10 text-sm"
          disabled={isGeneratingArticle || isLoadingPrompt}
        />
        {targetUrlError && (
          <Alert variant="destructive" className="mt-3 text-xs">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>URL Error</AlertTitle>
            <AlertDescription>{targetUrlError}</AlertDescription>
          </Alert>
        )}
      </div>

      {scrapeFailedForReferenceUrl && setReferenceArticleTextManual && (
        <div className="pt-4 border-t border-dashed dark:border-neutral-700">
          <Label
            htmlFor="referenceArticleTextManual"
            className="text-base font-medium text-orange-600 dark:text-orange-500"
          >
            參考文章內容 (Manual Reference Content)
          </Label>
          <p className="text-xs text-muted-foreground mb-2">
            The URL above failed to load. You can paste the content of the
            reference article here instead.
          </p>
          <Textarea
            id="referenceArticleTextManual"
            placeholder="Paste the content of the reference article here..."
            value={referenceArticleTextManual}
            onChange={handleReferenceTextChange}
            className="min-h-[200px] font-mono text-sm mt-2 border-orange-500 focus:ring-orange-500"
            disabled={isGeneratingArticle || isLoadingPrompt}
          />
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground pt-4 border-t border-dashed dark:border-neutral-700">
        ✨ 精修你的文章 (Refine Your Article) - Use the fields above to provide
        context for refinement.
      </div>
    </div>
  );
};
