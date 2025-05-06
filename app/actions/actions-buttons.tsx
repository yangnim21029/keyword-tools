"use client";

import {
  ArrowUp,
  ListTree,
  Loader2,
  LucideIcon,
  Sparkles,
  Trash2,
  RefreshCw,
  TerminalSquare,
  Settings2,
} from "lucide-react"; // Add ArrowUp, Trash2, and ShieldAlert
import { useRouter } from "next/navigation"; // Import useRouter
import { useTransition } from "react";
import { toast } from "sonner";
import React from "react";
import { Button } from "@/components/ui/button"; // Ensure Button is imported

import { submitGeneratePersonaForCluster } from "@/app/actions/actions-ai-persona"; // Action for persona
import {
  submitCreateKeywordVolumeObj,
  submitDeleteKeywordVolumeObj,
} from "@/app/actions/actions-keyword-volume"; // Import the keyword research action, delete action, and new cleanup action
import { submitClustering } from "@/app/actions/actions-semantic-clustering"; // Action for clustering
import { LoadingButton } from "@/components/ui/LoadingButton";
import { cn } from "@/lib/utils";
import {
  revalidateKeywordVolumeList,
  testAiLifecycle,
} from "@/app/actions/actions-revalidate";
import {
  analyzeParagraphs,
  rephraseParagraph,
} from "./actions-paragraph-rephrase";
import {
  submitAiAnalysisSerpBetterHave,
  submitAiAnalysisSerpContentType,
  submitAiAnalysisSerpIntent,
  submitAiAnalysisSerpTitle,
  submitCreateSerp,
} from "./actions-ai-serp-result"; // Import the specific SERP analysis actions
import {
  submitAiAnalysisOnPageSummary,
  submitAiAnalysisOnPageRankingFactorV2,
  submitAiAnalysisOnPageRankingFactorRecommendation,
  generateSingleParagraphGraph,
  submitAiOrganizeTextContent,
} from "./actions-ai-onpage-result";

// === Cluster Analysis Button ===

interface ClusterAnalysisButtonProps {
  researchId: string;
  buttonText?: string;
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function ClusterAnalysisButton({
  researchId,
  buttonText = "執行關鍵字分群",
  variant = "outline",
  size = "sm",
  className = "",
}: ClusterAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleClusterAnalysis = () => {
    startTransition(async () => {
      toast.info(`Starting keyword clustering for ${researchId}...`);
      const result = await submitClustering({
        keywordVolumeObjectId: researchId,
        // Add other options like model or maxKeywords if needed
      });
      if (result.success) {
        toast.success(
          `Keyword clustering completed successfully for ${researchId}!`,
        );
        // Revalidation should happen within the server action
      } else {
        toast.error(
          `Keyword clustering failed for ${researchId}: ${
            result.error ?? "Unknown error"
          }`,
        );
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleClusterAnalysis}
      isLoading={isPending}
      disabled={isPending}
      loadingIcon={<Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    >
      {!isPending && <ListTree className="h-4 w-4 mr-2" />}
      {buttonText}
    </LoadingButton>
  );
}

// === Generate Persona Button (Moved from keyword-volume/components) ===

interface GeneratePersonaButtonProps {
  researchId: string;
  clusterName: string;
  buttonText?: string;
  icon?: LucideIcon;
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function GeneratePersonaButton({
  researchId,
  clusterName,
  buttonText = "生成用戶畫像",
  icon: Icon = Sparkles, // Default to Sparkles icon
  variant = "outline",
  size = "sm",
  className = "w-full text-xs", // Keep original default class or adjust
}: GeneratePersonaButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await submitGeneratePersonaForCluster({
        keywordVolumeObjectId: researchId,
        clusterName: clusterName,
      });
      if (result.success) {
        toast.success(`用戶畫像 for "${clusterName}" generated successfully!`);
        // Revalidation should happen within the server action
      } else {
        toast.error(
          `Failed to generate persona for "${clusterName}": ${
            result.error ?? "Unknown error"
          }`,
        );
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleGenerate}
      isLoading={isPending}
      disabled={isPending}
      loadingIcon={<Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    >
      {!isPending && <Icon className="h-4 w-4 mr-2" />}
      {buttonText}
    </LoadingButton>
  );
}

// === Submit Keyword Research Button ===

interface SubmitKeywordResearchButtonProps {
  query: string;
  region: string;
  language: string;
  className?: string;
  disabled?: boolean;
}

export function SubmitKeywordResearchButton({
  query,
  region,
  language,
  className = "h-10 w-10 rounded-full bg-black hover:bg-gray-800 text-white flex items-center justify-center shadow-md transition-colors p-0", // Default style from original form
  disabled = false,
}: SubmitKeywordResearchButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = () => {
    if (!query.trim() || isPending) return;

    startTransition(async () => {
      toast.info("Starting new keyword research...");
      try {
        const result = await submitCreateKeywordVolumeObj({
          query: query,
          region: region,
          language: language,
          // Keep other options as default/fixed for now
          useAlphabet: false,
          useSymbols: true,
          filterZeroVolume: false,
        });

        if (result.success && result.researchId) {
          toast.success(`研究記錄已創建 (ID: ${result.researchId})`);
          router.push(`/keyword-volume/${result.researchId}`);
        } else {
          const errorMsg = result.error || "創建研究記錄失敗，請稍後再試。";
          toast.error(errorMsg);
          if (result.researchId) {
            toast.info(
              `研究記錄可能已部分創建 (ID: ${result.researchId})，但後續步驟失敗。`,
            );
          }
        }
      } catch (err) {
        console.error(
          "[SubmitKeywordResearchButton] Error calling server action:",
          err,
        );
        const message =
          err instanceof Error ? err.message : "處理請求時發生意外錯誤。";
        toast.error(message);
      }
    });
  };

  return (
    <LoadingButton
      className={className}
      onClick={handleSubmit}
      isLoading={isPending}
      disabled={disabled || isPending || !query.trim()} // Ensure button is disabled if query is empty
      aria-label="研究關鍵字"
      loadingText=""
      variant="default" // Using default variant, style handled by className mostly
    >
      {!isPending && <ArrowUp size={20} />}
      {/* Loader is handled internally by LoadingButton when isLoading is true */}
    </LoadingButton>
  );
}

// === Delete Keyword Volume Button ===

interface DeleteKeywordVolumeButtonProps {
  researchId: string;
  className?: string;
  // Allow only variants supported by the underlying Button/LoadingButton
  variant?: Extract<
    React.ComponentProps<typeof LoadingButton>["variant"],
    "default" | "outline" | "secondary" | "ghost" // Explicitly list supported variants
  >;
  // Allow only sizes supported by the underlying LoadingButton
  size?: Extract<
    React.ComponentProps<typeof LoadingButton>["size"],
    "default" | "sm" | "lg" // Explicitly list supported sizes
  >;
  ariaLabel?: string;
}

export function DeleteKeywordVolumeButton({
  researchId,
  className = "h-7 w-7 p-0",
  variant = "ghost", // Default to ghost
  size = "sm", // Default to sm
  ariaLabel,
}: DeleteKeywordVolumeButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleDelete = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent link navigation if inside a Link
    e.stopPropagation(); // Stop event bubbling

    if (!researchId || isPending) return;

    startTransition(async () => {
      toast.info(`Deleting research ${researchId}...`);
      const result = await submitDeleteKeywordVolumeObj({ researchId });
      if (result.success) {
        toast.success(`Research ${researchId} deleted.`);
      } else {
        toast.error(
          `Failed to delete ${researchId}: ${result.error ?? "Unknown error"}`,
        );
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={cn(
        "flex-shrink-0 text-muted-foreground hover:text-destructive",
        className,
      )}
      onClick={handleDelete}
      isLoading={isPending}
      disabled={isPending || !researchId}
      aria-label={ariaLabel || `Delete research ${researchId}`}
      loadingIcon={<Loader2 className="h-4 w-4 animate-spin" />}
    >
      {!isPending && <Trash2 className="h-4 w-4" />}
    </LoadingButton>
  );
}

// === SERP Analysis Buttons ===

interface BaseAnalysisButtonProps {
  docId: string;
  variant?: React.ComponentProps<typeof LoadingButton>["variant"];
  size?: React.ComponentProps<typeof LoadingButton>["size"];
  className?: string;
  disabled?: boolean;
  loadingText?: string;
  reAnalyzeLoadingText?: string;
}

// === Create New SERP Button ===
export function CreateNewSerpButton({
  query,
  region,
  language,
}: {
  query: string;
  region: string;
  language: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleCreate = () => {
    if (!query.trim() || isPending) {
      if (!query.trim()) {
        toast.warning("Please enter a search query.");
      }
      return;
    }

    startTransition(async () => {
      toast.info(`Fetching SERP for "${query}"...`);
      try {
        const result = await submitCreateSerp({ query, region, language });

        if (result.success) {
          toast.success(`SERP data created/fetched successfully!`);
          router.refresh(); // Refresh the list on the page
          // Optionally clear the form state here if needed, though state is in the parent
        } else {
          // Use the specific error from the action
          const errorMsg = result.error || "Failed to fetch/create SERP data.";
          toast.error(errorMsg);
          console.error("[CreateNewSerpButton] Action failed:", errorMsg);
        }
      } catch (err) {
        console.error(
          "[CreateNewSerpButton] Error calling server action:",
          err,
        );
        const message =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        toast.error(`Error: ${message}`);
      }
    });
  };

  return (
    <LoadingButton
      // Use props or defaults for styling
      variant="default" // Example: Use default variant
      size="sm" // Example: Use small size
      className="h-8 px-4" // Example custom class
      onClick={handleCreate}
      isLoading={isPending}
      disabled={isPending || !query.trim()}
      loadingIcon={<Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    >
      {/* Keep icon if desired */}
      <Sparkles className="h-4 w-4 mr-2" />
      Fetch SERP
    </LoadingButton>
  );
}

// === Analyze Content Type Button ===
export function AnalyzeContentTypeButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
}: BaseAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await submitAiAnalysisSerpContentType({ docId });
        if (result.success) {
          toast.success(`Content Type analysis complete.`);
        } else {
          toast.error(
            `Content Type analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Content Type analysis error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText="Analyzing..."
    >
      Analyze Content Type
    </LoadingButton>
  );
}

// === User Intent Analysis Button ===
export function AnalyzeUserIntentButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
}: BaseAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await submitAiAnalysisSerpIntent({ docId });
        if (result.success) {
          toast.success(`User Intent analysis complete.`);
        } else {
          toast.error(
            `User Intent analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`User Intent analysis error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText="Analyzing..."
    >
      Analyze User Intent
    </LoadingButton>
  );
}

// === Title Analysis Button ===
export function AnalyzeTitleButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
}: BaseAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await submitAiAnalysisSerpTitle({ docId });
        if (result.success) {
          toast.success(`Title analysis complete.`);
        } else {
          toast.error(
            `Title analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Title analysis error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText="Analyzing..."
    >
      Analyze Title
    </LoadingButton>
  );
}

// === Better Have Analysis Button ===
export function AnalyzeBetterHaveButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
}: BaseAnalysisButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await submitAiAnalysisSerpBetterHave({ docId });
        if (result.success) {
          toast.success(`Better Have analysis complete.`);
        } else {
          toast.error(
            `Better Have analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Better Have analysis error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText="Analyzing..."
    >
      Analyze Better Have
    </LoadingButton>
  );
}

// === On-Page Analysis Buttons ===

// --- Analyze Content Summary Button ---
interface AnalyzeContentSummaryButtonProps extends BaseAnalysisButtonProps {
  hasExistingResult?: boolean;
}

export function AnalyzeContentSummaryButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
  hasExistingResult = false,
}: AnalyzeContentSummaryButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await submitAiAnalysisOnPageSummary({ docId });
        if (result.success) {
          toast.success(`On-Page Content Summary analysis complete.`);
        } else {
          toast.error(
            `On-Page Content Summary analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`On-Page Content Summary analysis error: ${errorMsg}`);
      }
    });
  };

  const currentLoadingText = isPending
    ? hasExistingResult
      ? "Re-analyzing Summary..."
      : "Analyzing Summary..."
    : undefined;

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText={currentLoadingText}
    >
      {hasExistingResult ? "Re-Analyze Summary" : "Analyze Content Summary"}
    </LoadingButton>
  );
}

// === V2 Ranking Factor Analysis Button ===
interface AnalyzeRankingFactorsV2ButtonProps extends BaseAnalysisButtonProps {
  hasExistingResult?: boolean;
}

export function AnalyzeRankingFactorsV2Button({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
  hasExistingResult = false,
}: AnalyzeRankingFactorsV2ButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAnalysis = () => {
    startTransition(async () => {
      toast.info(
        hasExistingResult
          ? "Re-running V2 Ranking Factor analysis..."
          : "Starting V2 Ranking Factor analysis...",
      );
      try {
        const result = await submitAiAnalysisOnPageRankingFactorV2({ docId }); // Call the V2 action
        if (result.success) {
          toast.success(`V2 Ranking Factor analysis complete.`);
        } else {
          toast.error(
            `V2 Ranking Factor analysis failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`V2 Ranking Factor analysis error: ${errorMsg}`);
      }
    });
  };

  const currentLoadingText = isPending
    ? hasExistingResult
      ? "Re-analyzing Factors (V2)..."
      : "Analyzing Factors (V2)..."
    : undefined;

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending}
      loadingText={currentLoadingText}
    >
      {hasExistingResult
        ? "Re-Analyze Factors (V2)"
        : "Analyze Ranking Factors (V2)"}
    </LoadingButton>
  );
}

// === Recommendation Button ===
interface AnalyzeRankingFactorsRecommendationButtonProps
  extends BaseAnalysisButtonProps {
  hasExistingResult?: boolean;
  hasPrerequisite?: boolean; // To check if V2 analysis exists
}

export function AnalyzeRankingFactorsRecommendationButton({
  docId,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
  hasExistingResult = false,
  hasPrerequisite = false, // Default to false
}: AnalyzeRankingFactorsRecommendationButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleAnalysis = () => {
    startTransition(async () => {
      toast.info(
        hasExistingResult
          ? "Re-generating Recommendations..."
          : "Generating Recommendations...",
      );
      try {
        const result = await submitAiAnalysisOnPageRankingFactorRecommendation({
          docId,
        }); // Call the recommendation action
        if (result.success) {
          toast.success(`Recommendations generated successfully.`);
        } else {
          toast.error(
            `Recommendations generation failed: ${result.error ?? "Unknown error"}`,
          );
        }
        router.refresh();
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Recommendations generation error: ${errorMsg}`);
      }
    });
  };

  const currentLoadingText = isPending
    ? hasExistingResult
      ? "Re-generating Recommendations..."
      : "Generating Recommendations..."
    : undefined;
  const buttonText = hasExistingResult
    ? "Re-generate Recommendations"
    : "Generate Recommendations";

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      // Disable if prerequisite (V2 analysis) is missing OR if already loading
      disabled={disabled || isPending || !hasPrerequisite}
      loadingText={currentLoadingText}
      title={
        !hasPrerequisite ? "Run V2 Ranking Factor Analysis first" : undefined
      } // Tooltip if disabled
    >
      {buttonText}
    </LoadingButton>
  );
}

// === Revalidate Button ===
interface RevalidateButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function RevalidateButton({
  variant = "outline",
  size = "sm",
  className = "",
}: RevalidateButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRevalidate = () => {
    startTransition(async () => {
      try {
        const result = await revalidateKeywordVolumeList();
        if (result.success) {
          toast.success("Keyword volume list cache revalidated successfully!");
        } else {
          toast.error("Failed to revalidate cache");
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Failed to revalidate cache: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleRevalidate}
      isLoading={isPending}
      disabled={isPending}
      loadingIcon={<Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    >
      {!isPending && <RefreshCw className="h-4 w-4 mr-2" />}
      Revalidate Cache
    </LoadingButton>
  );
}

// === Test AI Button ===
interface TestAiButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function TestAiButton({
  variant = "outline",
  size = "sm",
  className = "",
}: TestAiButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleTest = () => {
    startTransition(async () => {
      try {
        const result = await testAiLifecycle();
        if (result.success) {
          toast.success(result.message);
          console.log("AI Response:", result.response);
        } else {
          toast.error(result.message);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`AI test failed: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleTest}
      isLoading={isPending}
      disabled={isPending}
      loadingIcon={<Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    >
      {!isPending && <TerminalSquare className="h-4 w-4 mr-2" />}
      Test AI Life
    </LoadingButton>
  );
}

// === Paragraph Rephrase Buttons ===

interface ParagraphRephraseButtonProps {
  aSections: string[];
  bSection: string;
  onResult: (result: string) => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}

export function AnalyzeParagraphsButton({
  aSections,
  bSection,
  onResult,
  variant = "default",
  size = "default",
  className = "",
  disabled = false,
}: ParagraphRephraseButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleAnalysis = () => {
    startTransition(async () => {
      try {
        const result = await analyzeParagraphs(aSections, bSection);
        if (result.success) {
          onResult(result.result);
          toast.success("Paragraph analysis complete.");
        } else {
          toast.error(`Analysis failed: ${result.error ?? "Unknown error"}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Analysis error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleAnalysis}
      isLoading={isPending}
      disabled={disabled || isPending || !aSections || !bSection}
      loadingText="Analyzing..."
    >
      Analyze (Step 1)
    </LoadingButton>
  );
}

interface RephraseButtonProps {
  step1Result: string;
  aSections: string[];
  bSection: string;
  onResult: (result: string) => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "primary";
  size?: "default" | "sm" | "lg";
  className?: string;
  disabled?: boolean;
}

export function RephraseButton({
  step1Result,
  aSections,
  bSection,
  onResult,
  variant = "secondary",
  size = "default",
  className = "",
  disabled = false,
}: RephraseButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRephrase = () => {
    startTransition(async () => {
      try {
        const result = await rephraseParagraph(
          step1Result,
          aSections,
          bSection,
        );
        if (result.success) {
          onResult(result.result);
          toast.success("Paragraph rephrased successfully.");
        } else {
          toast.error(`Rephrase failed: ${result.error ?? "Unknown error"}`);
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Rephrase error: ${errorMsg}`);
      }
    });
  };

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleRephrase}
      isLoading={isPending}
      disabled={disabled || isPending || !step1Result || !bSection}
      loadingText="Rephrasing..."
    >
      Rephrase (Step 2)
    </LoadingButton>
  );
}

// === Generate Graph Button ===

interface GenerateGraphButtonProps {
  docId: string;
  textContent: string | null | undefined; // Allow null/undefined
  hasExistingResult?: boolean;
  variant?: React.ComponentProps<typeof LoadingButton>["variant"];
  size?: React.ComponentProps<typeof LoadingButton>["size"];
  className?: string;
  disabled?: boolean;
}

export function GenerateGraphButton({
  docId,
  textContent,
  hasExistingResult = false,
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
}: GenerateGraphButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleGenerate = () => {
    if (!textContent || !docId || isPending) {
      if (!textContent) {
        toast.warning("No text content available to generate graph.");
      } else if (!docId) {
        toast.warning("Document ID is missing.");
      }
      return;
    }

    startTransition(async () => {
      toast.info(
        hasExistingResult
          ? "Re-generating paragraph graph..."
          : "Generating paragraph graph...",
      );
      try {
        const result = await generateSingleParagraphGraph({
          docId,
          textContent,
        });
        if (result.success) {
          toast.success("Paragraph graph generated.");
          router.refresh();
        } else {
          toast.error(
            `Graph generation failed: ${result.error ?? "Unknown error"}`,
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Graph generation error: ${errorMsg}`);
      }
    });
  };

  const currentLoadingText = isPending
    ? hasExistingResult
      ? "Re-generating Graph..."
      : "Generating Graph..."
    : undefined;
  const buttonText = hasExistingResult
    ? "Re-generate Paragraph Graph"
    : "Generate Paragraph Graph";

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleGenerate}
      isLoading={isPending}
      disabled={disabled || isPending || !textContent || !docId}
      loadingText={currentLoadingText}
    >
      {buttonText}
    </LoadingButton>
  );
}

// === Generate Article Button ===
interface GenerateArticleButtonProps {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
  className?: string;
  // Allow customizing text/icons if needed in the future, but provide defaults
  buttonText?: string;
  loadingText?: string;
  icon?: React.ReactNode;
}

export function GenerateArticleButton({
  onClick,
  isLoading,
  disabled = false,
  className = "",
  buttonText = "生成文章",
  loadingText = "生成中...",
  icon = <Sparkles className="mr-2 h-4 w-4" />,
}: GenerateArticleButtonProps) {
  return (
    <LoadingButton
      onClick={onClick}
      isLoading={isLoading}
      disabled={disabled || isLoading}
      variant="primary" // Apply the blue style
      loadingText={loadingText}
      className={cn("w-full md:w-auto", className)} // Default responsive width
      loadingIcon={<Loader2 className="h-4 w-4 animate-spin" />}
    >
      {!isLoading && icon} {/* Show icon only when not loading */} 
      {buttonText}
    </LoadingButton>
  );
}

// === Organize Text Content Button ===

interface OrganizeTextContentButtonProps extends BaseAnalysisButtonProps {
  hasTextContent?: boolean; // Check if there is text to organize
  hasOriginalTextContent?: boolean; // Check if text has been organized before
}

export function OrganizeTextContentButton({
  docId,
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
  hasTextContent = false,
  hasOriginalTextContent = false,
}: OrganizeTextContentButtonProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleOrganize = () => {
    if (!docId || isPending || !hasTextContent) {
      if (!hasTextContent) {
        toast.warning("No text content found to organize.");
      }
      return;
    }

    startTransition(async () => {
      const toastMessage = hasOriginalTextContent
        ? "Re-organizing text content..."
        : "Organizing text content...";
      toast.info(toastMessage);
      try {
        const result = await submitAiOrganizeTextContent({ docId });
        if (result.success) {
          toast.success(`Text content organized successfully.`);
          router.refresh(); // Refresh data on the page
        } else {
          toast.error(
            `Text content organization failed: ${result.error ?? "Unknown error"}`,
          );
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        toast.error(`Text content organization error: ${errorMsg}`);
      }
    });
  };

  const buttonText = hasOriginalTextContent
    ? "Re-organize Text"
    : "Organize Text Content";
  const currentLoadingText = isPending
    ? hasOriginalTextContent
      ? "Re-organizing..."
      : "Organizing..."
    : undefined;

  return (
    <LoadingButton
      variant={variant}
      size={size}
      className={className}
      onClick={handleOrganize}
      isLoading={isPending}
      disabled={disabled || isPending || !hasTextContent} // Disable if no text or pending
      loadingText={currentLoadingText}
      title={!hasTextContent ? "No text content available" : undefined}
    >
      {!isPending && <Sparkles className="h-4 w-4 mr-2" />} {/* Example icon */}
      {buttonText}
    </LoadingButton>
  );
}

// === Fine Tune Button ===
interface FineTuneButtonProps {
  onClick: () => void;
  disabled?: boolean;
  count: number; // Number of selected fine tunes
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  className?: string;
}

export function FineTuneButton({
  onClick,
  disabled = false,
  count,
  variant = "ghost", // Default style matches the original
  size = "sm",
  className = "text-xs font-mono text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-neutral-700 px-2 py-1 h-auto", // Original classes
}: FineTuneButtonProps) {
  return (
    <Button
      variant={variant}
      size={size}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      <Settings2 className="h-3.5 w-3.5 mr-1" />
      Fine-Tune ({count})
    </Button>
  );
}
