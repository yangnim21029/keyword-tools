"use client";

// Removed MEDIASITE_DATA import as mediaSiteName is fixed
// import { MEDIASITE_DATA } from "@/app/global-config";
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
// Removed useClientStorage import
// import { useClientStorage } from "@/components/hooks/use-client-storage";
import { Button } from "@/components/ui/button";
// Removed Label import (no longer needed for single keyword select)
// import { Label } from "@/components/ui/label";
// Removed Select imports
// import {
//   Select,
//   SelectContent,
//   SelectItem,
//   SelectTrigger,
//   SelectValue,
// } from "@/components/ui/select";
// Shadcn Table components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge"; // For status display
import { cn } from "@/lib/utils";
import {
  // Removed Check, ChevronsUpDown, Layers as they are no longer needed
  Loader2,
  // Removed Settings2 as fine-tune button is removed
  TerminalSquare,
  ClipboardCopy, // For copy button
  Trash2, // For potential future delete/reset
  Info, // For showing errors/results
} from "lucide-react";
// Removed Image import as media site selector is removed
import type React from "react";
import { useEffect, useState, useCallback } from "react"; // Added useCallback
import { toast } from "sonner";
// Removed unused display components
// import { ErrorDisplay } from "../components/error-display";
// import { ProgressChecklistDisplay } from "../components/progress-checklist-display";
// import { ResultDisplay } from "../components/result-display";
import { RevalidateButton } from "@/app/actions/actions-buttons";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"; // For showing full prompt/error

// --- Import Corrected Types from Schema ---
// Removed KeywordVolumeListItem and KeywordVolumeObject types as they are no longer used
// --- Import Server Actions ---
// Removed submitGetKeywordVolumeObj as detail fetching is removed
import { getSerpDataAction } from "@/app/actions/actions-ai-serp-result"; // SERP actions
// --- End Import ---

// --- Define New API Endpoints ---
// Keep API endpoints the same
const API_BASE_URL = "/api/writing";
const API_OUTLINE_URL = `${API_BASE_URL}/outline`;
const API_STEP1_FETCH_SERP_URL = `${API_BASE_URL}/1-fetch-serp`;
const API_STEP2_ANALYZE_CONTENT_TYPE_URL = `${API_BASE_URL}/2-analyze-content-type`;
const API_STEP3_ANALYZE_USER_INTENT_URL = `${API_BASE_URL}/3-analyze-user-intent`;
const API_STEP4_ANALYZE_TITLE_URL = `${API_BASE_URL}/4-analyze-title`;
const API_STEP5_ANALYZE_BETTER_HAVE_URL = `${API_BASE_URL}/5-analyze-better-have`;
const API_STEP6_GENERATE_ACTION_PLAN_URL = `${API_BASE_URL}/6-generate-action-plan`;
const API_STEP7_GENERATE_FINAL_PROMPT_URL = `${API_BASE_URL}/7-generate-final-prompt`;
// Removed API_KEYWORD_LIST_URL as list is hardcoded

// --- Define New Step IDs ---
// Keep Step IDs the same
const STEP_ID_FETCH_SERP = "fetch-serp";
const STEP_ID_ANALYZE_CONTENT_TYPE = "analyze-content-type";
const STEP_ID_ANALYZE_USER_INTENT = "analyze-user-intent";
const STEP_ID_ANALYZE_TITLE = "analyze-title";
const STEP_ID_ANALYZE_BETTER_HAVE = "analyze-better-have";
const STEP_ID_GENERATE_ACTION_PLAN = "generate-action-plan";
const STEP_ID_GENERATE_FINAL_PROMPT = "generate-final-prompt";

// --- Hardcoded Keyword List ---
const hardcodedKeywords: string[] = [
  "五指毛桃淮山茨實湯",
  "五指毛桃止咳湯",
  "五指毛桃黨參湯功效",
  "電湯煲",
  "水煮魚",
  "五指毛桃黨參湯食譜",
  "冬天湯水芳姐",
  "合桃湯",
  "葛菜水",
  "豬潤水",
  "五指毛桃湯",
  "雞煲",
  "五指毛桃功效",
  "金瓜",
  "粟米肉粒飯",
  "五指毛桃",
  "冬蟲夏草",
  "南瓜食譜",
  "胡羅白",
  "栗子蛋糕",
  "止咳",
  "涼薯",
  "橙樹化痰素",
  "感冒可以喝什麼湯",
  "清補涼材料",
  "煲湯",
  "白茯苓功效",
  "紅燒豆腐",
  "蟲草19",
  "肉骨茶功效",
  "痰咳",
  "玉竹功效",
  "一招止寒咳",
  "淮山",
  "簡單燉湯食譜",
  "羅漢果菜乾湯",
  "茯神",
  "淮山的功效",
  "五指毛桃黨參瘦肉湯",
  "化痰喝什麼",
  "燉湯",
  "五指毛桃牛大力土茯苓湯功效",
  "牛大力五指毛桃湯",
  "牛大力禁忌",
  "清補涼禁忌",
  "化痰藥",
  "快速化痰的方法",
  "茨實功效",
  "幸福化痰素",
  "中藥煲",
  "五指毛桃土茯苓薏米湯",
  "舒緩喉嚨痛",
  "菜蜜",
  "茯苓功效與用法",
  "prospan",
  "豬肉",
  "蒸南瓜",
  "頭啖湯",
  "魚治",
  "六健通",
  "洋蔥蘋果水",
  "九製陳皮",
  "提升免疫力",
  "牛膝的功效和副作用",
  "紅蘿蔔功效與禁忌",
  "鮮淮山湯",
  "壓力煲",
  "龜苓茶功效",
  "茯苓功效禁忌",
  "罐頭鮑魚食譜",
  "姬松茸功效",
  "炒菜心食譜",
  "炸豆腐",
  "海底椰止咳露",
  "日本南瓜",
  "桔仔",
  "草姬蟲草",
  "土茯苓功效禁忌",
  "一人燉湯食譜",
  "南乳齋",
  "南瓜可以炒什麼",
  "龜苓膏功效與禁忌",
  "鮮淮山功效禁忌",
  "蜜棗功效禁忌",
  "中左covid",
  "樂必治",
  "滋陰潤肺湯水",
  "陰虛火旺湯水",
  "粉葛五指毛桃湯功效",
  "粟米芯",
  "什麼人不能吃靈芝",
  "袪濕",
  "糯玉米",
  "滋潤湯水乾燥",
  "炒西洋菜",
  "南瓜 卡路里",
  "茯苓的功效和副作用",
  "肺熱",
  "松茸菇",
  "止咳化痰藥推薦",
  "赤小豆 功效",
  "杏甜品",
  "粟米汁",
  "茨實",
  "糖蓮藕",
  "氣管敏感止咳藥",
  "化痰",
  "養陰清肺湯",
  "車前子",
  "玉竹煲湯",
  "橘紅",
  "紅菜頭湯",
  "淮山粉",
  "白蘿蔔功效",
  "北芪黨參禁忌",
  "痛風藥",
  "助養兒童",
  "土茯苓禁忌",
  "南瓜蕃茄紅蘿蔔湯",
  "含鎂最多食物",
  "茯神功效",
  "臘鴨髀",
  "雲苓白朮",
  "豬肺湯功效",
  "雞下脾",
  "豆腐湯",
  "豬脷",
  "雞髀菇",
  "粟米煎肉餅",
  "杜仲功效和副作用",
  "感冒藥",
  "豬寸骨",
  "南瓜的功效與禁忌",
  "紅燒排骨做法",
  "老火湯",
  "長新冠後遺症",
  "茯神副作用",
  "海帶食譜",
  "養生壺邊隻好",
  "牛肺",
  "蟲草功效",
  "五指毛桃土茯苓赤小豆",
  "目清素功效",
  "感冒食雞",
  "椰撻",
  "素鴨",
  "phosphate作用",
  "粉葛土茯苓五指毛桃湯",
  "鮑魚煲湯",
  "椰菜濕熱",
  "中式湯食譜",
  "羅漢果蘋果雪梨水功效",
  "耳仔痛解決方法",
  "鮑魚 營養",
  "鮑魚營養",
  "港式老火湯食譜",
  "杏桃乾的營養功效與禁忌",
  "敏魚",
  "香港春天",
  "氣炸鍋牛扒",
  "橙樹化痰素副作用",
  "三多炸脾",
  "什麼人可以吃六味地黃丸",
  "軟膠水喉接駁",
  "黨參副作用",
  "枸杞豬潤湯功效",
  "湯飲",
  "茯苓安神湯",
  "減肥晚餐",
  "枸杞湯",
  "霧眉後遺症",
  "抵抗",
  "羅漢果菊花甘草",
  "薏米餅",
  "五指毛桃痛風",
  "五指毛桃日月魚湯",
  "牛筋 卡路里",
  "合掌瓜紅蘿蔔粟米栗子湯",
  "栗子雞湯",
  "化橘紅香港",
  "扁豆衣",
  "草姬腸道通",
  "百合功效與禁忌",
  "紅扁豆禁忌",
  "鎂鹽",
  "杜仲",
  "四神湯功效",
  "止咳藥",
  "白蘿蔔止咳湯",
  "牛骨湯麵",
  "茯神功效禁忌",
  "竹芋",
  "功效",
  "扁豆功效禁忌",
  "土伏苓牛大力五指毛桃湯",
  "焗陳皮水方法",
  "黃精",
  "五指毛桃土茯苓素湯",
  "湯意粉",
  "燉湯煲",
  "西洋菜蜜",
  "消炎藥哪裡買",
  "豬潤清洗方法",
  "養生湯",
  "茯苓茶",
  "病徵",
  "咳可以食咩生果",
  "發燒湯水",
  "牛七功效",
  "栗子卡路里",
  "gaffer tape",
  "豬脷食譜",
  "中湯",
  "南瓜排骨湯",
  "栗子南瓜",
  "五花腩食譜",
  "3 4歲兒童食譜",
  "素雞",
  "五指毛桃茯苓湯",
  "煲湯材料",
  "葡萄靈功效",
  "玉靈膏香港",
  "補中益氣湯功效與禁忌",
  "土茯苓的功效和副作用",
  "soup day",
  "土茯苓薏米湯",
  "湯煲",
  "補氣血湯水",
  "雪花秀潤燥精華",
  "簡湯",
  "例湯食譜",
  "高湯",
  "養生食譜",
  "食療食譜",
  "老人補血湯水",
];

// Combine all fine-tune data names
const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map((item) => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map((item) => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map((item) => item.name),
];

// --- NEW: Interface for individual keyword task state ---
type TaskStatus = "pending" | "loading" | "completed" | "error";

interface KeywordTaskState {
  keyword: string;
  status: TaskStatus;
  resultPrompt: string | null;
  errorMessage: string | null;
  // Add other fields later if needed (e.g., generatedArticleText, editedArticleText, publishedUrl)
}

// --- RENAMED Component ---
export default function WritingQueuePage() {
  // --- State for Keyword Tasks ---
  const [keywordTasks, setKeywordTasks] = useState<KeywordTaskState[]>([]);

  // --- FIXED State for Media Site and Fine-tunes (used by generation logic) ---
  const [mediaSiteName] = useState<string>("urbanlife"); // Fixed value
  const [selectedFineTunes] = useState<string[]>(allFineTuneNames); // Pre-selected all

  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);

  // --- State for clipboard copy status (per keyword) ---
  const [copiedKeyword, setCopiedKeyword] = useState<string | null>(null);

  // --- REMOVED Unused Global State & Initial Steps ---

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    // Initialize keyword tasks from the hardcoded list
    setKeywordTasks(
      hardcodedKeywords.map((kw) => ({
        keyword: kw,
        status: "pending", // Initial status
        resultPrompt: null,
        errorMessage: null,
      }))
    );
    // No need to set mediaSiteName or selectedFineTunes here, initialized above
  }, []); // Empty dependency array ensures this runs only once on mount

  // Removed useEffect for loading keywords from API
  // Removed useEffect for syncing selectedClusterName with selectedKeywordReport
  // Removed useEffect for syncing persona with selectedClusterName
  // Removed hasClusters calculation

  // --- Handlers ---
  const handleCopyToClipboard = async (textToCopy: string, keyword: string) => {
    // Updated to accept text and keyword directly
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

  // Removed handleFineTuneChange

  // --- Utility Function to Update Task State ---
  const updateTaskState = useCallback(
    (targetKeyword: string, updates: Partial<KeywordTaskState>) => {
      setKeywordTasks((prevTasks) =>
        prevTasks.map((task) =>
          task.keyword === targetKeyword ? { ...task, ...updates } : task
        )
      );
    },
    [] // No dependencies needed for setKeywordTasks with functional update
  );

  // --- API Call Helpers (modified to not update global steps) ---
  // Note: The step tracking (`updateStepStatus`) is removed as it's not needed for the batch UI.
  const callApi = async <T,>(
    _stepId: string, // No longer used for global state update
    url: string,
    payload: any
  ): Promise<T> => {
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
  };

  // 1. Fetch SERP
  const callFetchSerpApi = async (
    keyword: string,
    mediaSiteName: string
  ): Promise<{ id: string; originalKeyword: string }> => {
    return await callApi<{ id: string; originalKeyword: string }>(
      STEP_ID_FETCH_SERP,
      API_STEP1_FETCH_SERP_URL,
      { keyword, mediaSiteName }
    );
  };

  // 2. Analyze Content Type
  const callAnalyzeContentTypeApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_CONTENT_TYPE,
      API_STEP2_ANALYZE_CONTENT_TYPE_URL,
      { serpDocId }
    );
  };

  // 3. Analyze User Intent
  const callAnalyzeUserIntentApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_USER_INTENT,
      API_STEP3_ANALYZE_USER_INTENT_URL,
      { serpDocId }
    );
  };

  // 4. Analyze Title
  const callAnalyzeTitleApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_TITLE,
      API_STEP4_ANALYZE_TITLE_URL,
      { serpDocId }
    );
  };

  // 5. Analyze Better Have
  const callAnalyzeBetterHaveApi = async (
    serpDocId: string
  ): Promise<{ recommendationText: string }> => {
    return await callApi<{ recommendationText: string }>(
      STEP_ID_ANALYZE_BETTER_HAVE,
      API_STEP5_ANALYZE_BETTER_HAVE_URL,
      { serpDocId }
    );
  };

  // 6. Generate Action Plan
  const callGenerateActionPlanApi = async (
    keyword: string,
    mediaSiteName: string,
    contentTypeReportText: string,
    userIntentReportText: string,
    titleRecommendationText: string,
    betterHaveRecommendationText: string
  ): Promise<{ actionPlanText: string }> => {
    return await callApi<{ actionPlanText: string }>(
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
  };

  // 7. Generate Final Prompt
  const callGenerateFinalPromptApi = async (
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
    return await callApi<{ finalPrompt: string }>(
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
  };

  // --- handleGenerate (Replaces handleSubmit) ---
  const handleGenerate = useCallback(
    async (targetKeyword: string) => {
      console.log(`[UI] Starting generation for keyword: ${targetKeyword}`);
      updateTaskState(targetKeyword, {
        status: "loading",
        errorMessage: null,
        resultPrompt: null,
      });
      // Use fixed mediaSiteName and selectedFineTunes from state

      // TODO: Define how outlineTemplate is obtained for each keyword if needed. Using default.
      const outlineTemplate = "<!-- Default Outline/Template -->";

      try {
        // --- Execute Steps Sequentially for the targetKeyword ---
        console.log(`[${targetKeyword}] Step 1: Fetching SERP...`);
        const serpInfo = await callFetchSerpApi(targetKeyword, mediaSiteName);
        const serpId = serpInfo.id;
        const serpKeyword = serpInfo.originalKeyword; // Use the keyword returned by SERP API
        console.log(`[${serpKeyword}] Step 1 Done (SERP ID: ${serpId}).`);

        console.log(`[${serpKeyword}] Steps 2-5: Analyzing SERP...`);
        // Run analysis steps (could potentially run in parallel if independent)
        await Promise.all([
          callAnalyzeContentTypeApi(serpId),
          callAnalyzeUserIntentApi(serpId),
          callAnalyzeTitleApi(serpId),
          callAnalyzeBetterHaveApi(serpId),
        ]);
        console.log(`[${serpKeyword}] Steps 2-5 Done.`);

        // Fetch Updated SERP Data after analysis
        console.log(`[${serpKeyword}] Fetching updated SERP data...`);
        // Ensure getSerpDataAction is correctly imported and used
        const updatedSerpData = await getSerpDataAction(serpId);
        if (!updatedSerpData) {
          throw new Error(
            "Failed to retrieve updated SERP data after analysis."
          );
        }
        console.log(`[${serpKeyword}] Fetched updated SERP data.`);

        // Step 6: Generate Action Plan
        console.log(`[${serpKeyword}] Step 6: Generating Action Plan...`);
        const actionPlanResult = await callGenerateActionPlanApi(
          serpKeyword,
          mediaSiteName,
          updatedSerpData.contentTypeRecommendationText ?? "",
          updatedSerpData.userIntentRecommendationText ?? "",
          updatedSerpData.titleRecommendationText ?? "",
          updatedSerpData.betterHaveRecommendationText ?? ""
        );
        console.log(`[${serpKeyword}] Step 6 Done.`);

        // Step 7: Generate Final Prompt
        console.log(`[${serpKeyword}] Step 7: Generating Final Prompt...`);
        const finalPromptResult = await callGenerateFinalPromptApi(
          serpKeyword,
          actionPlanResult.actionPlanText,
          mediaSiteName,
          updatedSerpData.contentTypeRecommendationText ?? "",
          updatedSerpData.userIntentRecommendationText ?? "",
          updatedSerpData.betterHaveRecommendationText ?? null,
          outlineTemplate,
          null, // No content marketing suggestion for now
          selectedFineTunes
        );
        console.log(`[${serpKeyword}] Step 7 Done.`);

        // --- Update Task State on Success ---
        updateTaskState(targetKeyword, {
          status: "completed",
          resultPrompt: finalPromptResult.finalPrompt,
          errorMessage: null,
        });
        toast.success(`Successfully generated prompt for "${targetKeyword}"`);
        console.log(`[UI] Generation complete for: ${targetKeyword}`);
      } catch (err) {
        console.error(
          `[UI Debug] Error during generation for ${targetKeyword}:`,
          err
        );
        const errorMessage =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        // --- Update Task State on Error ---
        updateTaskState(targetKeyword, {
          status: "error",
          errorMessage: errorMessage,
          resultPrompt: null,
        });
        toast.error(
          `Generation failed for "${targetKeyword}": ${errorMessage}`
        );
      }
    },
    [updateTaskState, mediaSiteName, selectedFineTunes]
  ); // Dependencies for useCallback

  // --- handleResetTask (Optional: For resetting a specific task) ---
  const handleResetTask = useCallback(
    (targetKeyword: string) => {
      updateTaskState(targetKeyword, {
        status: "pending",
        resultPrompt: null,
        errorMessage: null,
      });
      toast.info(`Task for "${targetKeyword}" reset.`);
    },
    [updateTaskState]
  ); // Dependency

  if (!isMounted) {
    return null;
  }

  // --- Render ---
  return (
    <TooltipProvider>
      {" "}
      {/* Needed for Tooltip components */}
      <div className="min-h-screen dark:from-neutral-950 dark:to-black">
        <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-6xl">
          {" "}
          {/* Increased max-width */}
          <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
            AI Writing Queue - UrbanLife {/* Updated Title */}
          </h1>
          <div className="space-y-8">
            <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden rounded-lg">
              {" "}
              {/* Added rounded-lg */}
              {/* Header */}
              <div className="px-4 py-3 bg-gray-50 dark:bg-neutral-800 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Keyword Tasks ({keywordTasks.length})
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    Site: {mediaSiteName} | Fine-Tunes:{" "}
                    {selectedFineTunes.length} (All)
                  </span>
                  <RevalidateButton size="sm" variant="ghost" />
                  {/* Maybe add a button to add new keywords later */}
                </div>
              </div>
              {/* Table Content Area */}
              <div className="p-0">
                {" "}
                {/* Remove padding for full-width table */}
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700/50">
                      <TableHead className="w-[40%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Keyword
                      </TableHead>
                      <TableHead className="w-[15%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-center">
                        Status
                      </TableHead>
                      <TableHead className="w-[30%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                        Result / Error
                      </TableHead>
                      <TableHead className="w-[15%] px-4 py-2 text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wider text-right">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {keywordTasks.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center text-gray-500 dark:text-gray-400 py-10"
                        >
                          No keyword tasks found. (Or initializing...)
                        </TableCell>
                      </TableRow>
                    ) : (
                      keywordTasks.map((task) => (
                        <TableRow
                          key={task.keyword}
                          className="hover:bg-gray-50 dark:hover:bg-neutral-800/50"
                        >
                          <TableCell className="px-4 py-3 font-medium text-sm text-gray-800 dark:text-gray-200 align-top">
                            {task.keyword}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-center align-top">
                            <Badge
                              variant={
                                task.status === "completed"
                                  ? "default"
                                  : task.status === "error"
                                    ? "destructive"
                                    : task.status === "loading"
                                      ? "outline"
                                      : "secondary"
                              }
                              className="text-xs capitalize"
                            >
                              {task.status === "loading" ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1 inline-block" />
                              ) : null}
                              {task.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 align-top">
                            {task.status === "completed" &&
                              task.resultPrompt && (
                                <div className="flex items-center gap-2">
                                  <span
                                    className="truncate flex-1"
                                    title={task.resultPrompt}
                                  >
                                    {" "}
                                    {/* Add title for full text on hover */}
                                    {task.resultPrompt}
                                  </span>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          handleCopyToClipboard(
                                            task.resultPrompt!,
                                            task.keyword
                                          )
                                        }
                                      >
                                        <ClipboardCopy
                                          className={`h-3.5 w-3.5 ${copiedKeyword === task.keyword ? "text-green-500" : ""}`}
                                        />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Copy Prompt</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            {task.status === "error" && task.errorMessage && (
                              <div className="flex items-center gap-2 text-red-600 dark:text-red-500">
                                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span
                                      className="truncate flex-1 cursor-help"
                                      title={task.errorMessage}
                                    >
                                      {/* Add title */}
                                      {task.errorMessage}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs break-words">
                                    <p>{task.errorMessage}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                            {(task.status === "pending" ||
                              task.status === "loading") && (
                              <span className="italic text-gray-400 dark:text-gray-600">
                                -
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right space-x-1 align-top">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2"
                                  onClick={() => handleGenerate(task.keyword)}
                                  disabled={
                                    task.status === "loading" ||
                                    task.status === "completed"
                                  }
                                >
                                  {task.status === "loading" ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <TerminalSquare className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>
                                  {task.status === "completed"
                                    ? "Generated"
                                    : "Generate"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                            {/* Optional Reset Button */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-gray-500 hover:text-red-500"
                                  onClick={() => handleResetTask(task.keyword)}
                                  disabled={
                                    task.status === "pending" ||
                                    task.status === "loading"
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
