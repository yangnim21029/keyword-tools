"use client";

import type React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, CheckCircle2, ChevronRight, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Label } from "@/components/ui/label";

interface ResultDisplayProps {
  researchPrompt: string | null;
  generatedOutlineText: string | null;
  onCopyToClipboard: () => void;
  onStartOver: () => void;
  copied: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
  researchPrompt,
  generatedOutlineText,
  onCopyToClipboard,
  onStartOver,
  copied,
}) => {
  if (!researchPrompt) return null;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Label htmlFor="research-prompt-output" className="text-sm font-medium text-muted-foreground">Generated Prompt:</Label>
        <Textarea
          id="research-prompt-output"
          readOnly
          value={researchPrompt}
          className={cn(
            "min-h-[250px] font-mono text-sm leading-relaxed p-4 resize-none border mt-1",
            "bg-gray-50 dark:bg-neutral-950 border-gray-300 dark:border-neutral-800",
          )}
        />
        <Button
          onClick={onCopyToClipboard}
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "absolute top-1 right-1 flex items-center gap-1.5 px-2 py-1 text-xs font-mono",
            "text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-neutral-800",
          )}
        >
          {copied ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 justify-start">
        <Button
          onClick={onStartOver}
          variant="outline"
          size="sm"
          className="text-xs font-mono"
        >
          Start Over
        </Button>
      </div>

      {generatedOutlineText && (
        <details className="pt-2">
          <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            View Generated Outline (H2 List)
          </summary>
          <pre className="mt-2 p-3 text-xs bg-gray-100 dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700 overflow-auto max-h-60 whitespace-pre-wrap break-words">
            {generatedOutlineText}
          </pre>
        </details>
      )}
    </div>
  );
};
