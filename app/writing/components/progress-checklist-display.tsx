"use client";

import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import type React from "react";
import type { Step } from "../types";

const StepChecklist = ({ steps }: { steps: Step[] }) => {
  const getIcon = (status: Step["status"]) => {
    switch (status) {
      case "loading":
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
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
              step.status === "error" && "text-red-600 dark:text-red-400"
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
  return <StepChecklist steps={steps} />;
};
