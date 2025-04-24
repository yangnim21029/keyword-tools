"use client"

import type React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface ErrorDisplayProps {
    error: string | null;
    onDismiss: () => void;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ error, onDismiss }) => {
    if (!error) return null;

    return (
        <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden border-l-4 border-l-red-500">
            {/* Header */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1"> {/* Window controls */}
                        <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                        <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                        <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                    </div>
                    <span className="text-xs font-mono text-red-600 dark:text-red-400 uppercase">ERROR_OCCURRED</span>
                </div>
                <AlertTriangle className="h-4 w-4 text-red-500" />
            </div>
            <div className="p-6">
                <div className="bg-red-50 dark:bg-red-900/10 p-4 text-red-800 dark:text-red-300 text-sm mb-4">
                    {error}
                </div>
                <Button
                    onClick={onDismiss}
                    className={cn(
                        "px-3 py-1.5 text-xs font-mono transition-colors border",
                        "bg-gray-50 text-gray-700 border-gray-300 hover:border-red-400 hover:bg-red-50/50 dark:bg-neutral-950 dark:text-gray-300 dark:border-neutral-800 dark:hover:border-red-600 dark:hover:bg-red-900/20"
                    )}
                >
                    Dismiss
                </Button>
            </div>
        </div>
    );
}; 