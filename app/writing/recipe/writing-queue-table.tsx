"use client";

import type React from "react";
import { useEffect, useState, useCallback, useTransition } from "react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  TerminalSquare,
  ClipboardCopy,
  Trash2,
  Info,
  PlusCircle,
  FileText,
  Newspaper,
  Link,
  CheckSquare,
  PenLine,
  Link2,
  ExternalLink,
  Eye,
  Wand2,
} from "lucide-react";
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
import { getSerpDataAction } from "@/app/actions/actions-ai-serp-result";
import {
  createWritingQueueTaskAction,
  updateGeneratedArticleAction,
  updateRefineUrlAction,
  updatePostUrlAction,
  updateResultPromptAction,
  refineArticleAction,
} from "@/app/actions/actions-writing-queue";
import type { WritingQueueItem } from "@/app/services/firebase/data-ai-writing-queue";
import { RevalidateButton } from "@/app/actions/actions-buttons";
import { cn } from "@/lib/utils";

// --- Re-define Constants used by generation logic ---
// These could also be passed as props if they might change based on server context
const API_BASE_URL = "/api/writing";
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;

const STEP_ID_FETCH_SERP = "fetch-serp";
const STEP_ID_ANALYZE_CONTENT_TYPE = "analyze-content-type";
const STEP_ID_ANALYZE_USER_INTENT = "analyze-user-intent";
const STEP_ID_ANALYZE_TITLE = "analyze-title";
const STEP_ID_ANALYZE_BETTER_HAVE = "analyze-better-have";
const STEP_ID_GENERATE_ACTION_PLAN = "generate-action-plan";
const STEP_ID_GENERATE_FINAL_PROMPT = "generate-final-prompt";

const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map((item) => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map((item) => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map((item) => item.name),
];

// Use the imported type directly if needed, or redefine locally if preferred
export type TaskStatus = WritingQueueItem["status"];
export type KeywordTaskState = WritingQueueItem; // Use the type from the service directly

interface WritingQueueTableProps {
  initialTasks: KeywordTaskState[] | null;
  initialError: string | null;
}

// Define types for the different dialogs we'll open
type ActiveDialog =
  | null
  | { type: "addKeywords" }
  | { type: "viewPrompt"; task: KeywordTaskState }
  | { type: "editArticle"; task: KeywordTaskState }
  | { type: "editRefineUrl"; task: KeywordTaskState }
  | { type: "editPostUrl"; task: KeywordTaskState }
  | { type: "viewRefinedArticle"; task: KeywordTaskState };

export function WritingQueueTable({
  initialTasks,
  initialError,
}: WritingQueueTableProps) {
  // Initialize state from props
  const [keywordTasks, setKeywordTasks] = useState<KeywordTaskState[]>(
    initialTasks ?? []
  );
  const [isLoadingTasks, setIsLoadingTasks] = useState(
    !initialTasks && !initialError
  ); // Loading only if no initial data/error
  const [fetchError, setFetchError] = useState<string | null>(initialError);

  // Other client-side state remains
  const [mediaSiteName] = useState<string>("UL");
  const [selectedFineTunes] = useState<string[]>(allFineTuneNames);
  const [isMounted, setIsMounted] = useState(false);
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);
  const [dialogInputValue, setDialogInputValue] = useState("");

  // Transitions for actions
  const [isAddingTask, startAddTaskTransition] = useTransition();
  const [isUpdatingTask, startUpdateTaskTransition] = useTransition();
  const [isRefiningTask, startRefineTaskTransition] = useTransition();
  const [isResettingTask, startResetTaskTransition] = useTransition();

  // State to track which task is currently being processed by row-specific actions
  const [refiningTaskId, setRefiningTaskId] = useState<string | null>(null);
  const [resettingTaskId, setResettingTaskId] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    // No need to fetch here, data comes from props
    // Update state if props change (e.g., after revalidation)
    if (initialTasks) {
      setKeywordTasks(initialTasks);
      setIsLoadingTasks(false);
      setFetchError(null);
    } else if (initialError) {
      setFetchError(initialError);
      setIsLoadingTasks(false);
      setKeywordTasks([]);
    }
  }, [initialTasks, initialError]);

  // --- Dialog Management ---
  const openDialog = (dialogState: ActiveDialog) => {
    if (!dialogState) return;
    // Pre-fill input for edit dialogs
    if (dialogState.type === "editArticle")
      setDialogInputValue(dialogState.task.generatedArticleText ?? "");
    else if (dialogState.type === "editRefineUrl")
      setDialogInputValue(dialogState.task.refineUrl ?? "");
    else if (dialogState.type === "editPostUrl")
      setDialogInputValue(dialogState.task.postUrl ?? "");
    else if (dialogState.type === "addKeywords") setDialogInputValue(""); // Clear for add
    setActiveDialog(dialogState);
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setDialogInputValue(""); // Clear input on close
  };

  // --- Handlers and API callers (Copy from previous page.tsx) ---
  const handleCopyToClipboard = async (textToCopy: string, keyword: string) => {
    if (!textToCopy) return;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKeyword(keyword);
      toast.success(`Prompt for "${keyword}" copied!`);
      setTimeout(() => setCopiedKeyword(null), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
      toast.error("Failed to copy prompt.");
      setCopiedKeyword(null);
    }
  };

  const updateTaskState = useCallback(
    // Use ID for updating now, as keyword might not be unique if user adds duplicates
    (targetId: string, updates: Partial<KeywordTaskState>) => {
      setKeywordTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.id === targetId ? { ...task, ...updates } : task
        )
      );
    },
    []
  );

  const callApi = useCallback(
    async <T,>(_stepId: string, url: string, payload: any): Promise<T> => {
      // ... (callApi implementation remains the same) ...
      const startTime = performance.now();
      let durationMs = 0;
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        durationMs = performance.now() - startTime;
        if (!response.ok) {
          let errorDetails = `API Error (${_stepId}): ${response.statusText}`;
          try {
            const errorBody = await response.json();
            errorDetails =
              errorBody.details || errorBody.error || JSON.stringify(errorBody);
          } catch {
            try {
              const textError = await response.text();
              if (textError) errorDetails += ` - ${textError}`;
            } catch {}
          }
          throw new Error(errorDetails);
        }
        const result = await response.json();
        return result as T;
      } catch (error) {
        throw error; // Re-throw
      }
    },
    []
  ); // Empty dependency array for callApi as it doesn't depend on component state directly

  // --- Specific API Call Wrappers ---
  const callFetchSerpApi = useCallback(
    async (
      keyword: string,
      mediaSiteName: string
    ): Promise<{ id: string; originalKeyword: string }> => {
      return callApi(STEP_ID_FETCH_SERP, API_STEP1_FETCH_SERP_URL, {
        keyword,
        mediaSiteName,
      });
    },
    [callApi]
  );

  const callAnalyzeContentTypeApi = useCallback(
    async (serpDocId: string): Promise<{ recommendationText: string }> => {
      return callApi(
        STEP_ID_ANALYZE_CONTENT_TYPE,
        API_STEP2_ANALYZE_CONTENT_TYPE_URL,
        { serpDocId }
      );
    },
    [callApi]
  );

  const callAnalyzeUserIntentApi = useCallback(
    async (serpDocId: string): Promise<{ recommendationText: string }> => {
      return callApi(
        STEP_ID_ANALYZE_USER_INTENT,
        API_STEP3_ANALYZE_USER_INTENT_URL,
        { serpDocId }
      );
    },
    [callApi]
  );

  const callAnalyzeTitleApi = useCallback(
    async (serpDocId: string): Promise<{ recommendationText: string }> => {
      return callApi(STEP_ID_ANALYZE_TITLE, API_STEP4_ANALYZE_TITLE_URL, {
        serpDocId,
      });
    },
    [callApi]
  );

  const callAnalyzeBetterHaveApi = useCallback(
    async (serpDocId: string): Promise<{ recommendationText: string }> => {
      return callApi(
        STEP_ID_ANALYZE_BETTER_HAVE,
        API_STEP5_ANALYZE_BETTER_HAVE_URL,
        { serpDocId }
      );
    },
    [callApi]
  );

  const callGenerateActionPlanApi = useCallback(
    async (
      keyword: string,
      mediaSiteName: string,
      contentTypeReportText: string,
      userIntentReportText: string,
      titleRecommendationText: string,
      betterHaveRecommendationText: string
    ): Promise<{ actionPlanText: string }> => {
      return callApi(
        STEP_ID_GENERATE_ACTION_PLAN,
        API_STEP6_GENERATE_ACTION_PLAN_URL,
        {
          keyword,
          mediaSiteName,
          contentTypeReportText,
          userIntentReportText,
          titleRecommendationText,
          betterHaveRecommendationText,
          keywordReport: null,
          selectedClusterName: null,
        }
      );
    },
    [callApi]
  );

  const callGenerateFinalPromptApi = useCallback(
    async (
      keyword: string,
      actionPlan: string,
      mediaSiteName: string,
      contentTypeReportText: string,
      userIntentReportText: string,
      betterHaveRecommendationText: string | null,
      articleTemplate: string,
      contentMarketingSuggestion: string | null,
      fineTuneNames: string[]
    ): Promise<{ finalPrompt: string }> => {
      return callApi(
        STEP_ID_GENERATE_FINAL_PROMPT,
        API_STEP7_GENERATE_FINAL_PROMPT_URL,
        {
          keyword,
          actionPlan,
          mediaSiteName,
          contentTypeReportText,
          userIntentReportText,
          betterHaveRecommendationText,
          keywordReport: null,
          selectedClusterName: null,
          articleTemplate,
          contentMarketingSuggestion: contentMarketingSuggestion || "",
          fineTuneNames,
        }
      );
    },
    [callApi]
  );

  // --- handleGenerate --- Adjusted to use task.id
  const handleGenerate = useCallback(
    async (task: KeywordTaskState) => {
      const targetId = task.id;
      const targetKeyword = task.keyword;
      console.log(
        `[UI] Starting generation for keyword: ${targetKeyword} (ID: ${targetId})`
      );
      // Update local state to processing immediately
      updateTaskState(targetId, {
        status: "processing",
        errorMessage: null,
        resultPrompt: null,
      });

      const outlineTemplate = "<!-- Default Outline/Template -->";

      try {
        const serpInfo = await callFetchSerpApi(targetKeyword, mediaSiteName);
        const serpId = serpInfo.id;
        const serpKeyword = serpInfo.originalKeyword;

        await Promise.all([
          callAnalyzeContentTypeApi(serpId),
          callAnalyzeUserIntentApi(serpId),
          callAnalyzeTitleApi(serpId),
          callAnalyzeBetterHaveApi(serpId),
        ]);

        const updatedSerpData = await getSerpDataAction(serpId);
        if (!updatedSerpData) {
          throw new Error(
            "Failed to retrieve updated SERP data after analysis."
          );
        }

        const actionPlanResult = await callGenerateActionPlanApi(
          serpKeyword,
          mediaSiteName,
          updatedSerpData.contentTypeRecommendationText ?? "",
          updatedSerpData.userIntentRecommendationText ?? "",
          updatedSerpData.titleRecommendationText ?? "",
          updatedSerpData.betterHaveRecommendationText ?? ""
        );

        const finalPromptResult = await callGenerateFinalPromptApi(
          serpKeyword,
          actionPlanResult.actionPlanText,
          mediaSiteName,
          updatedSerpData.contentTypeRecommendationText ?? "",
          updatedSerpData.userIntentRecommendationText ?? "",
          updatedSerpData.betterHaveRecommendationText ?? null,
          outlineTemplate,
          null,
          selectedFineTunes
        );

        // --- Update Task State on Success ---
        console.log(
          `[UI] Prompt generated for ${targetKeyword}. Saving to Firestore...`
        );

        // Call the server action to save the prompt and set status to completed
        const formData = new FormData();
        formData.append("taskId", targetId);
        formData.append("prompt", finalPromptResult.finalPrompt);
        const saveResult = await updateResultPromptAction(formData);

        if (saveResult.success) {
          toast.success(
            `Successfully generated and saved prompt for "${targetKeyword}"`
          );
          // Optionally update local state again if action modified data not reflected by revalidation
          // updateTaskState(targetId, { status: "completed", resultPrompt: finalPromptResult.finalPrompt });
          // Revalidation should handle the update, so direct state update might be redundant
        } else {
          // Prompt was generated, but saving failed. Keep local state as completed? Or revert?
          // Let's keep it completed locally but show an error toast.
          updateTaskState(targetId, {
            status: "completed", // Keep completed locally
            resultPrompt: finalPromptResult.finalPrompt,
            errorMessage: `Prompt generated but failed to save: ${saveResult.error}`, // Add error message
          });
          toast.error(
            `Prompt generated but failed to save: ${saveResult.error}`
          );
        }
      } catch (err) {
        console.error(
          `[UI Debug] Error during generation for ${targetKeyword} (ID: ${targetId}):`,
          err
        );
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        // Update local state on error
        updateTaskState(targetId, {
          status: "error",
          errorMessage: errorMessage,
          resultPrompt: null,
        });
        toast.error(
          `Generation failed for "${targetKeyword}": ${errorMessage}`
        );
      }
    },
    [
      updateTaskState,
      mediaSiteName,
      selectedFineTunes,
      callFetchSerpApi,
      callAnalyzeContentTypeApi,
      callAnalyzeUserIntentApi,
      callAnalyzeTitleApi,
      callAnalyzeBetterHaveApi,
      callGenerateActionPlanApi,
      callGenerateFinalPromptApi,
    ] // Add API callers to dependencies
  );

  // --- handleResetTask --- Wrap in transition and track ID
  const handleResetTask = useCallback(
    (taskId: string, taskKeyword: string) => {
      startResetTaskTransition(() => {
        setResettingTaskId(taskId); // Track which task is resetting
        updateTaskState(taskId, {
          status: "pending",
          resultPrompt: null,
          errorMessage: null,
          // Also clear other potentially generated fields if needed
          generatedArticleText: null,
          refinedArticleText: null,
          refineUrl: null,
          // Keep postUrl? Or clear? Let's clear for a full reset.
          postUrl: null,
        });
        toast.info(`Task for "${taskKeyword}" reset.`);
        // Simulate brief delay for visual feedback if desired, though not strictly necessary
        // await new Promise(resolve => setTimeout(resolve, 300));
        setResettingTaskId(null); // Clear tracking
      });
    },
    [updateTaskState]
  );

  // --- UPDATED: Centralized handler for submitting *update* dialogs ---
  const handleUpdateSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (
      !activeDialog ||
      activeDialog.type === "addKeywords" ||
      activeDialog.type === "viewPrompt"
    )
      return; // Should not happen

    const taskId = activeDialog.task.id;
    const currentValue = dialogInputValue; // Get value from dialog state
    let action: (
      formData: FormData
    ) => Promise<{ success: boolean; error?: string }>;
    let fieldName: string = "";
    let successMessage: string = "";

    const formData = new FormData();
    formData.append("taskId", taskId);

    switch (activeDialog.type) {
      case "editArticle":
        action = updateGeneratedArticleAction;
        formData.append("articleText", currentValue);
        fieldName = "Article";
        successMessage = `Article updated for task ${taskId}.`;
        break;
      case "editRefineUrl":
        action = updateRefineUrlAction;
        formData.append("url", currentValue);
        fieldName = "Refine URL";
        successMessage = `Refine URL updated for task ${taskId}.`;
        break;
      case "editPostUrl":
        action = updatePostUrlAction;
        formData.append("url", currentValue);
        fieldName = "Post URL";
        successMessage = `Post URL updated for task ${taskId}.`;
        break;
      default:
        toast.error("Invalid dialog type for update.");
        return;
    }

    startUpdateTaskTransition(async () => {
      const result = await action(formData);
      if (result.success) {
        toast.success(successMessage);
        closeDialog();
        // List updates via revalidation
      } else {
        toast.error(`Failed to update ${fieldName}: ${result.error}`);
      }
    });
  };

  // --- handleAddTaskSubmit --- (For the Add Keywords dialog - slight modification to use open/close state)
  const handleAddTaskSubmit = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();
    if (!dialogInputValue.trim() || isAddingTask) {
      // Use dialogInputValue now
      toast.warning("Please enter at least one keyword.");
      return;
    }
    startAddTaskTransition(async () => {
      const formData = new FormData();
      formData.append("keywords", dialogInputValue.trim()); // Use dialogInputValue
      const result = await createWritingQueueTaskAction(formData);
      // ... (toast feedback logic remains same) ...
      if (result.successCount > 0) {
        // toast logic ...
        closeDialog(); // Use closeDialog function
      } else {
        // toast logic ...
      }
    });
  };

  // --- handleRefineArticle --- Track ID during transition
  const handleRefineArticle = async (taskId: string, taskKeyword: string) => {
    if (!taskId || isRefiningTask) return;

    console.log(`[UI] Starting Refine Article for Task ID: ${taskId}`);
    toast.info(`Starting refinement for "${taskKeyword}"...`);
    setRefiningTaskId(taskId); // Track refining task
    startRefineTaskTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("taskId", taskId);
        const result = await refineArticleAction(formData);

        if (result.success) {
          toast.success(`Article successfully refined for "${taskKeyword}".`);
          if (result.error) {
            toast.warning(result.error);
          }
        } else {
          toast.error(`Article refinement failed: ${result.error}`);
        }
      } finally {
        setRefiningTaskId(null); // Clear tracking regardless of outcome
      }
    });
  };

  if (!isMounted) {
    // Optional: Render a skeleton or null during SSR/initial mount before hydration
    return null;
  }

  // --- Render --- (JSX structure remains largely the same)
  return (
    <TooltipProvider>
      <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden rounded-lg">
        {/* Header */}
        <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Keyword Tasks ({keywordTasks.length})
            </span>
            {/* Corrected Dialog Trigger Condition */}
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => openDialog({ type: "addKeywords" })}
            >
              <PlusCircle className="h-3.5 w-3.5 mr-1" />
              Add Keywords
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              Site: {mediaSiteName} | Fine-Tunes: {selectedFineTunes.length}{" "}
              (All)
            </span>
            {/* TODO: Check if RevalidateButton works correctly from client component */}
            {/* It might need to be passed down or triggered differently */}
            <RevalidateButton size="sm" variant="ghost" />
          </div>
        </div>
        {/* Table Content Area */}
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700/50">
                <TableHead className="w-[10%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </TableHead>
                <TableHead className="w-[30%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Keyword
                </TableHead>
                <TableHead className="w-[35%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Assets
                </TableHead>
                <TableHead className="w-[15%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                  Dates
                </TableHead>
                <TableHead className="w-[10%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTasks ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-gray-500 dark:text-gray-400 py-10"
                  >
                    <Loader2 className="h-6 w-6 animate-spin inline-block mr-2" />{" "}
                    Loading tasks...
                  </TableCell>
                </TableRow>
              ) : fetchError ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-red-600 dark:text-red-500 py-10"
                  >
                    Error loading tasks: {fetchError}
                  </TableCell>
                </TableRow>
              ) : keywordTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-gray-500 dark:text-gray-400 py-10"
                  >
                    No keyword tasks found. Add some using the button above.
                  </TableCell>
                </TableRow>
              ) : (
                keywordTasks.map((task) => (
                  <TableRow
                    key={task.id} // Use Firestore ID as key
                    className="hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                  >
                    {/* Status Column */}
                    <TableCell className="px-4 py-3 text-center align-top">
                      <Badge
                        variant={
                          task.status === "completed"
                            ? "default"
                            : task.status === "error"
                              ? "destructive"
                              : task.status === "processing"
                                ? "outline"
                                : "secondary"
                        }
                        className="text-xs capitalize"
                      >
                        {task.status === "processing" ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1 inline-block" />
                        ) : null}
                        {task.status}
                      </Badge>
                    </TableCell>
                    {/* Keyword Column */}
                    <TableCell className="px-4 py-3 font-medium text-sm text-gray-800 dark:text-gray-200 align-top">
                      {task.keyword}
                    </TableCell>
                    {/* Assets Column (REVISED) */}
                    <TableCell className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 align-top">
                      <div className="flex items-center gap-2">
                        {/* Error Icon */}
                        {task.status === "error" && task.errorMessage && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-red-500 cursor-help">
                                <Info className="h-4 w-4" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs break-words">
                              <p>{task.errorMessage}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {/* View Prompt Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                task.resultPrompt
                                  ? "text-blue-500"
                                  : "text-gray-400 opacity-50"
                              )}
                              onClick={() =>
                                openDialog({ type: "viewPrompt", task })
                              }
                              disabled={!task.resultPrompt}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {task.resultPrompt
                                ? "View Prompt"
                                : "Prompt not generated"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {/* Edit Article Button (Initial/Editable) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                task.generatedArticleText
                                  ? "text-green-500"
                                  : "text-gray-400 opacity-50"
                              )}
                              onClick={() =>
                                openDialog({ type: "editArticle", task })
                              }
                              disabled={task.status === "pending"}
                            >
                              <Newspaper className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {task.generatedArticleText
                                ? "Edit Initial Article"
                                : "Add Initial Article"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {/* View Refined Article Button (NEW) */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                task.refinedArticleText
                                  ? "text-cyan-500"
                                  : "text-gray-400 opacity-50"
                              )}
                              onClick={() =>
                                openDialog({
                                  type: "viewRefinedArticle",
                                  task,
                                })
                              }
                              disabled={!task.refinedArticleText}
                            >
                              <Wand2 className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {task.refinedArticleText
                                ? "View Refined Article"
                                : "Article not refined"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {/* Edit Refine URL Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                task.refineUrl
                                  ? "text-purple-500"
                                  : "text-gray-400 opacity-50"
                              )}
                              onClick={() =>
                                openDialog({ type: "editRefineUrl", task })
                              }
                              disabled={task.status === "pending"}
                            >
                              <Link className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {task.refineUrl
                                ? "Edit Refine URL"
                                : "Add Refine URL"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {/* Edit Post URL Button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={cn(
                                "h-6 w-6",
                                task.postUrl
                                  ? "text-teal-500"
                                  : "text-gray-400 opacity-50"
                              )}
                              onClick={() =>
                                openDialog({ type: "editPostUrl", task })
                              }
                              disabled={task.status === "pending"}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>
                              {task.postUrl ? "Edit Post URL" : "Add Post URL"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                        {/* Placeholder if no assets and no error */}
                        {task.status !== "error" &&
                          !task.resultPrompt &&
                          !task.generatedArticleText &&
                          !task.refinedArticleText &&
                          !task.refineUrl &&
                          !task.postUrl && (
                            <span className="italic text-gray-400 dark:text-gray-600">
                              -
                            </span>
                          )}
                      </div>
                    </TableCell>
                    {/* Dates Column */}
                    <TableCell className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 align-top">
                      <div>
                        Created:{" "}
                        {task.createdAt
                          ? new Date(task.createdAt).toLocaleString()
                          : "-"}
                      </div>
                      <div>
                        Updated:{" "}
                        {task.updatedAt
                          ? new Date(task.updatedAt).toLocaleString()
                          : "-"}
                      </div>
                    </TableCell>
                    {/* Actions Column (REVISED Loading States) */}
                    <TableCell className="px-4 py-3 text-right space-x-0.5 align-top">
                      {/* Generate Prompt Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleGenerate(task)}
                            disabled={task.status === "processing"}
                          >
                            {task.status === "processing" ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <TerminalSquare className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {task.status === "completed"
                              ? "Re-generate Prompt"
                              : "Generate Prompt"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Refine Article Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              handleRefineArticle(task.id, task.keyword)
                            }
                            disabled={
                              !task.generatedArticleText ||
                              !task.refineUrl ||
                              (isRefiningTask && refiningTaskId === task.id)
                            }
                          >
                            {isRefiningTask && refiningTaskId === task.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {task.refinedArticleText
                              ? "Re-refine Article"
                              : "Refine Article"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                      {/* Reset Task Button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-gray-500 hover:text-red-500"
                            onClick={() =>
                              handleResetTask(task.id, task.keyword)
                            }
                            disabled={
                              task.status === "pending" ||
                              task.status === "processing" ||
                              isResettingTask
                            }
                          >
                            {isResettingTask && resettingTaskId === task.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Reset Task</p>
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* --- DIALOG RENDERING --- */}
      <Dialog
        open={!!activeDialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) closeDialog();
        }}
      >
        <DialogContent
          className={cn(
            "sm:max-w-md",
            (activeDialog?.type === "editArticle" ||
              activeDialog?.type === "viewPrompt" ||
              activeDialog?.type === "viewRefinedArticle") &&
              "sm:max-w-2xl" // Wider for article/prompt
          )}
        >
          {/* Wrap conditional dialog forms in a Fragment */}
          <>
            {/* Add Keywords Dialog */}
            {activeDialog?.type === "addKeywords" && (
              <form onSubmit={handleAddTaskSubmit}>
                <DialogHeader>
                  <DialogTitle>Add New Keyword Tasks</DialogTitle>
                  <DialogDescription>
                    Paste keywords below, one per line. Empty lines will be
                    ignored.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="keywords-input-dialog" className="sr-only">
                    Keywords
                  </Label>
                  <Textarea
                    id="keywords-input-dialog"
                    value={dialogInputValue}
                    onChange={(e) => setDialogInputValue(e.target.value)}
                    className="min-h-[150px]"
                    placeholder="Paste keywords..."
                    required
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isAddingTask}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="submit"
                    disabled={isAddingTask || !dialogInputValue.trim()}
                  >
                    {isAddingTask ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}{" "}
                    Add Tasks
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* View Prompt Dialog */}
            {activeDialog?.type === "viewPrompt" && (
              <>
                {" "}
                {/* Fragment for non-form dialog content */}
                <DialogHeader>
                  <DialogTitle>View Generated Prompt</DialogTitle>
                  <DialogDescription>
                    Keyword: {activeDialog.task.keyword}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[60vh] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
                    {activeDialog.task.resultPrompt || "No prompt generated."}
                  </pre>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() =>
                      handleCopyToClipboard(
                        activeDialog.task.resultPrompt ?? "",
                        activeDialog.task.keyword
                      )
                    }
                    disabled={!activeDialog.task.resultPrompt}
                  >
                    <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Prompt
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </>
            )}

            {/* Edit Article Dialog */}
            {activeDialog?.type === "editArticle" && (
              <form onSubmit={handleUpdateSubmit}>
                <DialogHeader>
                  <DialogTitle>Add / Edit Generated Article</DialogTitle>
                  <DialogDescription>
                    Keyword: {activeDialog.task.keyword}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Label htmlFor="article-input-dialog" className="sr-only">
                    Article Text
                  </Label>
                  <Textarea
                    id="article-input-dialog"
                    value={dialogInputValue}
                    onChange={(e) => setDialogInputValue(e.target.value)}
                    className="min-h-[300px]"
                    placeholder="Paste generated article here..."
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isUpdatingTask}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingTask}>
                    {isUpdatingTask ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}{" "}
                    Save Article
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* Edit Refine URL Dialog */}
            {activeDialog?.type === "editRefineUrl" && (
              <form onSubmit={handleUpdateSubmit}>
                <DialogHeader>
                  <DialogTitle>Add / Edit Refine URL</DialogTitle>
                  <DialogDescription>
                    Keyword: {activeDialog.task.keyword}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Label htmlFor="refine-url-input-dialog">Refine URL</Label>
                  <Input
                    id="refine-url-input-dialog"
                    type="url"
                    value={dialogInputValue}
                    onChange={(e) => setDialogInputValue(e.target.value)}
                    placeholder="https://example.com/article-to-refine"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isUpdatingTask}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingTask}>
                    {isUpdatingTask ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}{" "}
                    Save Refine URL
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* Edit Post URL Dialog */}
            {activeDialog?.type === "editPostUrl" && (
              <form onSubmit={handleUpdateSubmit}>
                <DialogHeader>
                  <DialogTitle>Add / Edit Post URL</DialogTitle>
                  <DialogDescription>
                    Keyword: {activeDialog.task.keyword}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Label htmlFor="post-url-input-dialog">Post URL</Label>
                  <Input
                    id="post-url-input-dialog"
                    type="url"
                    value={dialogInputValue}
                    onChange={(e) => setDialogInputValue(e.target.value)}
                    placeholder="https://final-post-location.com/article"
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={isUpdatingTask}
                    >
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isUpdatingTask}>
                    {isUpdatingTask ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}{" "}
                    Save Post URL
                  </Button>
                </DialogFooter>
              </form>
            )}

            {/* NEW: View Refined Article Dialog */}
            {activeDialog?.type === "viewRefinedArticle" && (
              <>
                <DialogHeader>
                  <DialogTitle>View Refined Article</DialogTitle>
                  <DialogDescription>
                    Keyword: {activeDialog.task.keyword}
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4 max-h-[60vh] overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded-md">
                    {activeDialog.task.refinedArticleText ||
                      "Refined article not available."}
                  </pre>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    onClick={() =>
                      handleCopyToClipboard(
                        activeDialog.task.refinedArticleText ?? "",
                        activeDialog.task.keyword
                      )
                    }
                    disabled={!activeDialog.task.refinedArticleText}
                  >
                    <ClipboardCopy className="mr-2 h-4 w-4" /> Copy Refined
                    Article
                  </Button>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      Close
                    </Button>
                  </DialogClose>
                </DialogFooter>
              </>
            )}
          </>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
