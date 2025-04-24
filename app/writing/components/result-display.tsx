"use client"

import type React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Copy, CheckCircle2, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResultDisplayProps {
    researchPrompt: string | null;
    generatedOutlineText: string | null; // Added prop for outline
    onCopyToClipboard: () => void;
    onStartOver: () => void;
    copied: boolean;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({
    researchPrompt,
    generatedOutlineText,
    onCopyToClipboard,
    onStartOver,
    copied
}) => {
    if (!researchPrompt) return null; // Don't render if no prompt

    return (
        <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-green-500">
            {/* Header */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1"> {/* Window controls */}
                        <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                    </div>
                    <span className="text-xs font-mono text-green-600 dark:text-green-400 uppercase">PROMPT_GENERATED</span>
                </div>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
            </div>
            <div className="p-6">
                <div className="relative mb-4">
                    <Textarea
                        readOnly
                        value={researchPrompt}
                        className={cn(
                            "min-h-[300px] font-mono text-sm leading-relaxed p-5 resize-none border",
                            "bg-gray-50 dark:bg-neutral-950 border-gray-300 dark:border-neutral-800"
                        )}
                    />
                    <Button
                        onClick={onCopyToClipboard}
                        type="button"
                        className={cn(
                            "absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                        )}
                    >
                        {copied ? <><CheckCircle2 className="h-3.5 w-3.5 text-green-500" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                    </Button>
                </div>
                <div className="flex justify-between">
                    <Button
                        onClick={onStartOver} // Use the passed handler
                        className={cn(
                            "px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:bg-neutral-900"
                        )}
                    >
                        Start Over
                    </Button>
                    <Button
                        onClick={onCopyToClipboard} // Re-use copy handler for this button too
                        className={cn(
                            "flex items-center gap-1 px-3 py-1.5 text-xs font-mono transition-colors border",
                            "bg-gray-700 text-white border-gray-700 hover:bg-gray-600 dark:bg-primary dark:text-primary-foreground dark:border-primary dark:hover:bg-primary/90"
                        )}
                    >
                        Use This Prompt <ChevronRight className="h-3 w-3" />
                    </Button>
                </div>
                {/* Display the generated outline */}
                {generatedOutlineText && (
                    <details className="mt-4">
                        <summary className="cursor-pointer text-xs text-gray-500 dark:text-gray-400">View Generated Outline (H2 List)</summary>
                        <pre className="mt-2 p-3 text-xs bg-gray-100 dark:bg-neutral-800 rounded border border-gray-200 dark:border-neutral-700 overflow-auto max-h-60 whitespace-pre-wrap break-words">
                            {generatedOutlineText}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
};