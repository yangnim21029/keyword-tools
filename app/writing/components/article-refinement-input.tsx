"use client";

import React from 'react';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface ArticleRefinementInputProps {
  inputText: string;
  setInputText: (value: string) => void;
  targetUrl: string;
  setTargetUrl: (value: string) => void;
  isGeneratingArticle: boolean;
  isLoadingPrompt: boolean;
}

export const ArticleRefinementInput: React.FC<ArticleRefinementInputProps> = ({
  inputText,
  setInputText,
  targetUrl,
  setTargetUrl,
  isGeneratingArticle,
  isLoadingPrompt,
}) => {
  return (
    <div className="space-y-6">
      <div>
        <Label htmlFor="inputText" className="text-base font-medium">貼上你的文章 (Paste Your Article)</Label>
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
        <Label htmlFor="targetUrl" className="text-base font-medium">參考文章 URL (Reference Article URL)</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Provide a URL for the AI to analyze and draw suggestions from for refining your text.
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
      </div>
      <div className="text-center text-sm text-muted-foreground pt-4 border-t border-dashed dark:border-neutral-700">
        ✨ 精修你的文章 (Refine Your Article) - Use the fields above to provide context for refinement.
      </div>
    </div>
  );
}; 