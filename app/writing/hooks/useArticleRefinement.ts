import { useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import {
  generateRevisionFromInputTextAndUrlGraph,
  generateGraphFromText,
  generateRefinedArticleDirectly,
} from "@/app/actions/actions-ai-graph";

interface UseArticleRefinementProps {
  initialInputText?: string; // Optional initial values if needed
  initialTargetUrl?: string;
  onGenerationStart?: () => void;
  onGenerationSuccess?: (article: string) => void;
  onGenerationError?: (error: string) => void;
  onGenerationFailure?: (error: string, type?: "scrape" | "ai") => void;
}

interface UseArticleRefinementReturn {
  isGeneratingArticle: boolean;
  articleError: string | null;
  generateArticle: (inputText: string, targetUrl: string) => Promise<void>;
  generateArticleFromPastedReference: (
    inputText: string,
    referencePastedText: string
  ) => Promise<void>;
  resetArticleRefinement: () => void;
  clearArticleError: () => void;
}

export function useArticleRefinement({
  onGenerationStart,
  onGenerationSuccess,
  onGenerationError,
  onGenerationFailure,
}: UseArticleRefinementProps = {}): UseArticleRefinementReturn {
  const [articleError, setArticleError] = useState<string | null>(null);
  const [isGeneratingArticle, startArticleGeneration] = useTransition();

  const resetArticleRefinement = useCallback(() => {
    setArticleError(null);
  }, []);

  const clearArticleError = useCallback(() => {
    setArticleError(null);
  }, []);

  const generateArticle = useCallback(
    async (inputText: string, targetUrl: string) => {
      if (!inputText && !targetUrl) {
        const errMsg =
          "Please provide either input text or a target URL for refinement.";
        setArticleError(errMsg);
        onGenerationError?.(errMsg);
        toast.error(errMsg);
        return;
      }
      if (
        targetUrl &&
        !targetUrl.startsWith("http://") &&
        !targetUrl.startsWith("https://")
      ) {
        const errMsg =
          "Target URL for refinement must start with http:// or https://";
        setArticleError(errMsg);
        onGenerationError?.(errMsg);
        toast.error(errMsg);
        return;
      }

      onGenerationStart?.();
      setArticleError(null);

      startArticleGeneration(async () => {
        console.log("--- [Article Refinement Hook] Starting Generation ---");
        console.log(
          "Input Text:",
          inputText ? inputText.substring(0, 100) + "..." : "(Not provided)"
        );
        console.log("Target URL:", targetUrl || "(Not provided)");

        try {
          const result = await generateRevisionFromInputTextAndUrlGraph({
            inputText: inputText || "",
            targetUrl: targetUrl || "",
          });

          if (result.success && result.refinedArticle) {
            onGenerationSuccess?.(result.refinedArticle);
            toast.success("Final article generated successfully!");
          } else {
            if (result.errorType === "scrape" && onGenerationFailure) {
              onGenerationFailure(result.error || "Scrape failed", "scrape");
            } else {
              const errorMsg =
                result.error ||
                "An unknown error occurred generating the final article.";
              setArticleError(errorMsg);
              onGenerationError?.(errorMsg);
              if (onGenerationFailure) {
                onGenerationFailure(errorMsg, "ai");
              }
              toast.error(`Article generation failed: ${errorMsg}`);
            }
          }
        } catch (err) {
          console.error(
            "[Article Refinement Hook] Error calling generateRevisionFromInputTextAndUrlGraph:",
            err
          );
          const message =
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.";
          setArticleError(`Error: ${message}`);
          onGenerationError?.(`Error: ${message}`);
          toast.error(`Article generation error: ${message}`);
        }
      });
    },
    [
      onGenerationStart,
      onGenerationSuccess,
      onGenerationError,
      onGenerationFailure,
      startArticleGeneration,
    ]
  );

  const generateArticleFromPastedReference = useCallback(
    async (inputText: string, referencePastedText: string) => {
      if (!inputText && !referencePastedText) {
        const errMsg =
          "Please provide your article draft and the reference article content.";
        setArticleError(errMsg);
        onGenerationFailure?.(errMsg, "ai");
        toast.error(errMsg);
        return;
      }
      if (!referencePastedText) {
        const errMsg = "Please provide the reference article content manually.";
        setArticleError(errMsg);
        onGenerationFailure?.(errMsg, "ai");
        toast.error(errMsg);
        return;
      }

      onGenerationStart?.();
      setArticleError(null);

      startArticleGeneration(async () => {
        console.log(
          "--- [Article Refinement Hook] Starting Generation with Pasted Reference ---"
        );
        try {
          const graphResult = await generateGraphFromText(referencePastedText);

          if (!graphResult.success || !graphResult.result) {
            const errorMsg =
              graphResult.error ||
              "Failed to process reference text into a graph.";
            setArticleError(errorMsg);
            onGenerationFailure?.(errorMsg, "ai");
            toast.error(`Reference processing failed: ${errorMsg}`);
            return;
          }

          const finalResult = await generateRefinedArticleDirectly({
            inputText: inputText || "",
            graphText: graphResult.result,
          });

          if (finalResult.success && finalResult.refinedArticle) {
            onGenerationSuccess?.(finalResult.refinedArticle);
            toast.success(
              "Final article generated successfully using manual reference!"
            );
          } else {
            const errorMsg =
              finalResult.error ||
              "An unknown error occurred generating the final article with manual reference.";
            setArticleError(errorMsg);
            onGenerationFailure?.(errorMsg, "ai");
            toast.error(`Article generation failed: ${errorMsg}`);
          }
        } catch (err) {
          console.error(
            "[Article Refinement Hook] Error with pasted reference flow:",
            err
          );
          const message =
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.";
          setArticleError(`Error: ${message}`);
          onGenerationFailure?.(`Error: ${message}`, "ai");
          toast.error(`Article generation error: ${message}`);
        }
      });
    },
    [
      onGenerationStart,
      onGenerationSuccess,
      onGenerationFailure,
      startArticleGeneration,
    ]
  );

  return {
    isGeneratingArticle,
    articleError,
    generateArticle,
    generateArticleFromPastedReference,
    resetArticleRefinement,
    clearArticleError,
  };
}
