"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import type React from "react";

// Re-define Step interface here or import if shared
interface Step {
  id: string;
  name: string;
  status: "pending" | "loading" | "completed" | "error" | "skipped";
  durationMs?: number;
  errorMessage?: string | null;
}

// Re-define StepChecklist component here
const StepChecklist = ({ steps }: { steps: Step[] }) => {
  const getIcon = (status: Step["status"]) => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "skipped":
        return (
          <Circle className="h-4 w-4 text-gray-400 dark:text-gray-500 opacity-60" />
        );
      case "pending":
      default:
        return <Circle className="h-4 w-4 text-gray-300 dark:text-gray-600" />;
    }
  };

  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.id} className="flex items-center gap-3 text-sm">
          <div className="flex-shrink-0 w-4 h-4">{getIcon(step.status)}</div>
          <span
            className={cn(
              "font-medium",
              step.status === "pending" && "text-gray-400 dark:text-gray-500",
              step.status === "loading" && "text-blue-600 dark:text-blue-400",
              step.status === "completed" &&
                "text-green-700 dark:text-green-400",
              step.status === "error" && "text-red-600 dark:text-red-400",
              step.status === "skipped" &&
                "text-gray-400 dark:text-gray-500 italic opacity-70",
            )}
          >
            {step.name}
            {step.status === "completed" && step.durationMs != null && (
              <span className="text-xs text-gray-400 dark:text-gray-500 ml-1.5">
                ({(step.durationMs / 1000).toFixed(1)}s)
              </span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

interface ProgressChecklistDisplayProps {
  steps: Step[];
}

export const ProgressChecklistDisplay: React.FC<
  ProgressChecklistDisplayProps
> = ({ steps }) => {
  return (
    <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {" "}
            {/* Window controls */}
            <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
            <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
            <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
          </div>
          <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
            GENERATING_PROMPT
          </span>
        </div>
      </div>
      <div className="p-6">
        <StepChecklist steps={steps} />
      </div>
    </div>
  );
};
