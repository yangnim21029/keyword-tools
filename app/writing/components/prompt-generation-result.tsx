"use client";

import React from "react";
import { ProgressChecklistDisplay } from "./progress-checklist-display";
import { ErrorDisplay } from "./error-display";
import { ResultDisplay } from "./result-display";
import type { Step } from "../types"; // Update import to use types file

interface PromptGenerationResultProps {
  generationAttempted: boolean;
  steps: Step[];
  isLoadingPrompt: boolean;
  promptError: string | null;
  researchPrompt: string | null;
  generatedOutlineText: string | null;
  handleCopyToClipboard: (text: string | null) => void;
  handleStartOver: () => void;
  copiedPrompt: boolean;
  clearPromptError: () => void; // Add new prop for clearing the error
}

export const PromptGenerationResult: React.FC<PromptGenerationResultProps> = ({
  generationAttempted,
  steps,
  isLoadingPrompt,
  promptError,
  researchPrompt,
  generatedOutlineText,
  handleCopyToClipboard,
  handleStartOver,
  copiedPrompt,
  clearPromptError, // Destructure new prop
}) => {
  if (!generationAttempted) {
    return null; // Don't show anything if generation hasn't started
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
        Prompt Generation Progress:
      </h3>
      <ProgressChecklistDisplay steps={steps} />

      {/* Error Display (Prompt) */}
      {!isLoadingPrompt && promptError && (
        <ErrorDisplay
          error={promptError}
          onDismiss={clearPromptError} // Use the new prop here
        />
      )}

      {/* Result Display (Prompt) - Ensure conditional rendering is correct */}
      {!isLoadingPrompt && researchPrompt && (
        <div className="mt-6">
          {" "}
          {/* Add margin-top */}
          <ResultDisplay
            researchPrompt={researchPrompt}
            generatedOutlineText={generatedOutlineText}
            onCopyToClipboard={() => handleCopyToClipboard(researchPrompt)}
            onStartOver={handleStartOver}
            copied={copiedPrompt}
          />
        </div>
      )}
    </div>
  );
};
