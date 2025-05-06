"use client";

import { MEDIASITE_DATA } from "@/app/global-config";
import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
import { useClientStorage } from "@/components/hooks/use-client-storage";
import { Button } from "@/components/ui/button";
// Removed Checkbox import as it's no longer used for fine-tunes
// Removed Command imports as combobox is replaced
import { Label } from "@/components/ui/label";
// Removed Popover imports as combobox is replaced
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  // Removed Check, ChevronsUpDown, Layers as they are no longer needed
  Loader2,
  // Removed Settings2 as fine-tune button is removed
  TerminalSquare,
} from "lucide-react";
// Removed Image import as media site selector is removed
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
// Adjusted import paths relative to the new file location if needed (assuming they are correct)
import { ErrorDisplay } from "../components/error-display";
import { ProgressChecklistDisplay } from "../components/progress-checklist-display";
import { ResultDisplay } from "../components/result-display";
import { RevalidateButton } from "@/app/actions/actions-buttons";

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

// --- UPDATED: Step Checklist Component ---
interface Step {
  id: string;
  name: string;
  status: "pending" | "loading" | "completed" | "error";
  durationMs?: number; // Add optional duration
}

// --- RENAMED Component ---
export default function WritingRecipePage() {
  // Use useClientStorage for keyword and report state
  const [keyword, setKeyword] = useClientStorage("writingRecipe:keyword", ""); // Use different key for recipe page
  // Removed selectedKeywordReport state
  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    "writingRecipe:researchPrompt", // Use different key
    null
  );
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    "writingRecipe:generationAttempted", // Use different key
    false
  );
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >("writingRecipe:generatedOutlineText", null); // Use different key

  // --- FIXED State for Media Site and Fine-tunes ---
  const [mediaSiteName, setMediaSiteName] = useState<string>("urbanlife"); // Fixed value
  const [selectedFineTunes, setSelectedFineTunes] =
    useState<string[]>(allFineTuneNames); // Pre-selected all

  // --- State for loading/UI ---
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // --- State for hydration fix ---
  const [isMounted, setIsMounted] = useState(false);

  // --- State for steps ---
  const initialSteps: Step[] = [
    { id: STEP_ID_FETCH_SERP, name: "Step 1: Fetch SERP", status: "pending" },
    {
      id: STEP_ID_ANALYZE_CONTENT_TYPE,
      name: "Step 2: Analyze Content Type",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_USER_INTENT,
      name: "Step 3: Analyze User Intent",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_TITLE,
      name: "Step 4: Analyze Title",
      status: "pending",
    },
    {
      id: STEP_ID_ANALYZE_BETTER_HAVE,
      name: "Step 5: Analyze Better Have",
      status: "pending",
    },
    {
      id: STEP_ID_GENERATE_ACTION_PLAN,
      name: "Step 6: Generate Action Plan",
      status: "pending",
    },
    {
      id: STEP_ID_GENERATE_FINAL_PROMPT,
      name: "Step 7: Generate Final Prompt",
      status: "pending",
    },
  ];
  const [steps, setSteps] = useState<Step[]>(initialSteps);

  // --- Effects ---
  useEffect(() => {
    setIsMounted(true);
    // No need to set mediaSiteName or selectedFineTunes here, initialized above
  }, []);

  // Removed useEffect for loading keywords from API
  // Removed useEffect for syncing selectedClusterName with selectedKeywordReport
  // Removed useEffect for syncing persona with selectedClusterName
  // Removed hasClusters calculation

  if (!isMounted) {
    return null;
  }

  // --- Handlers ---
  const handleCopyToClipboard = async () => {
    // ... (copy logic remains the same) ...
    if (researchPrompt) {
      try {
        await navigator.clipboard.writeText(researchPrompt);
        setCopied(true);
        toast.success("Prompt copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text: ", err);
        toast.error("Failed to copy prompt.");
        setCopied(false);
      }
    }
  };

  // Removed handleFineTuneChange

  const updateStepStatus = (
    stepId: string,
    status: Step["status"],
    durationMs?: number
  ) => {
    setSteps((prevSteps) =>
      prevSteps.map((step) =>
        step.id === stepId ? { ...step, status, durationMs } : step
      )
    );
  };

  // --- API Call Helpers (remain the same) ---
  const callApi = async <T,>(
    stepId: string,
    url: string,
    payload: any
  ): Promise<T> => {
    updateStepStatus(stepId, "loading");
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
        let errorDetails = `API Error (${stepId}): ${response.statusText}`;
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
      updateStepStatus(stepId, "completed", durationMs);
      return result as T;
    } catch (error) {
      updateStepStatus(stepId, "error");
      throw error; // Re-throw
    }
  };

  // Specific API call functions (callFetchSerpApi, etc.) remain the same

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

  // --- handleSubmit (Updated for fixed values) ---
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setGenerationAttempted(true);
    setError(null);
    setResearchPrompt(null);
    // setGeneratedOutlineText(null); // Keep outline? Or reset? Let's reset for now.
    setGeneratedOutlineText(null);
    setSteps(initialSteps);

    // Use the fixed mediaSiteName directly
    if (!keyword) {
      setError("Please select a keyword."); // Updated error message
      setIsLoading(false);
      return;
    }

    const firstKeyword = keyword.split(",")[0].trim();
    if (!firstKeyword) {
      setError("Please provide a valid keyword.");
      setIsLoading(false);
      return;
    }

    // No need to find mediaSite, use fixed value
    // const mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
    // if (!mediaSite) { ... } // This check is less critical now

    const outlineTemplate =
      generatedOutlineText || "<!-- Default Outline/Template -->";

    console.log(
      `Submitting Recipe: Keyword=${firstKeyword}, MediaSiteName=${mediaSiteName} (Fixed), FineTunes=All (${selectedFineTunes.length}) (Fixed)` // Removed TargetCluster log
    );

    try {
      // --- Execute Steps Sequentially (logic remains mostly the same) ---

      // Step 1: Fetch SERP
      const serpInfo = await callFetchSerpApi(firstKeyword, mediaSiteName); // Use fixed mediaSiteName
      const serpId = serpInfo.id;
      const serpKeyword = serpInfo.originalKeyword;

      // Steps 2-5: Analysis
      const contentTypeResult = await callAnalyzeContentTypeApi(serpId);
      const userIntentResult = await callAnalyzeUserIntentApi(serpId);
      const titleResult = await callAnalyzeTitleApi(serpId);
      const betterHaveResult = await callAnalyzeBetterHaveApi(serpId);

      // Fetch Updated SERP Data
      updateStepStatus("fetch-updated-serp", "loading");
      const updatedSerpData = await getSerpDataAction(serpId);
      if (!updatedSerpData) {
        updateStepStatus("fetch-updated-serp", "error");
        throw new Error("Failed to retrieve updated SERP data after analysis.");
      }
      updateStepStatus("fetch-updated-serp", "completed");

      // Step 6: Generate Action Plan
      const actionPlanResult = await callGenerateActionPlanApi(
        serpKeyword,
        mediaSiteName, // Use fixed mediaSiteName
        updatedSerpData.contentTypeRecommendationText ?? "",
        updatedSerpData.userIntentRecommendationText ?? "",
        updatedSerpData.titleRecommendationText ?? "",
        updatedSerpData.betterHaveRecommendationText ?? ""
      );

      // Step 7: Generate Final Prompt
      const finalPromptResult = await callGenerateFinalPromptApi(
        serpKeyword,
        actionPlanResult.actionPlanText,
        mediaSiteName, // Use fixed mediaSiteName
        updatedSerpData.contentTypeRecommendationText ?? "",
        updatedSerpData.userIntentRecommendationText ?? "",
        updatedSerpData.betterHaveRecommendationText ?? null,
        outlineTemplate,
        null,
        selectedFineTunes // Use fixed selectedFineTunes
      );

      setResearchPrompt(finalPromptResult.finalPrompt);
      console.log("[UI] Recipe Process Complete. Final Prompt Generated.");
    } catch (err) {
      console.error("[UI Debug] Error in recipe handleSubmit:", err);
      setError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred during recipe generation."
      );
    } finally {
      setIsLoading(false);
    }
  };

  // --- handleStartOver (Updated) ---
  const handleStartOver = () => {
    setResearchPrompt(null);
    // Don't reset mediaSiteName or selectedFineTunes
    setKeyword(""); // Reset keyword as well
    setSteps(initialSteps);
    setGenerationAttempted(false);
    setGeneratedOutlineText(null); // Reset outline
    setError(null);
    setCopied(false);
  };

  // --- Render ---
  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-4xl">
        {/* --- Add a title for the recipe page --- */}
        <h1 className="text-2xl font-semibold mb-6 text-center text-gray-800 dark:text-gray-200">
          Writing Recipe: UrbanLife Special
        </h1>
        <div className="space-y-8">
          <div className="border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-md overflow-hidden">
            {/* Header - Simplified */}
            <div className="px-4 py-2 bg-gray-100 dark:bg-neutral-800 border-b border-gray-300 dark:border-neutral-700 flex justify-between items-center">
              <div className="flex items-center gap-2">
                {/* Window controls */}
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                  URBANLIFE_RECIPE_INPUT
                </span>
              </div>
              {/* Right side controls - Removed Fine-Tune button */}
              <div className="flex items-center gap-4">
                {/* Optionally show fixed site/fine-tune count here if needed */}
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                  Site: urbanlife | Fine-Tunes: {selectedFineTunes.length} (All)
                </span>
                <RevalidateButton size="sm" variant="ghost" />
              </div>
            </div>
            {/* Form Content Area */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Keyword Input Section (Updated to use Select) */}
                <div className="space-y-2">
                  <Label
                    htmlFor="keyword-select" // Changed htmlFor
                    className="text-base font-medium"
                  >
                    Keyword
                  </Label>
                  <div className="relative">
                    {/* Replaced Popover/Command with Select */}
                    <Select
                      value={keyword}
                      onValueChange={(value) => {
                        setKeyword(value === "__PLACEHOLDER__" ? "" : value);
                        // Clear dependent states if needed (though report/cluster are removed)
                      }}
                      disabled={isLoading}
                    >
                      <SelectTrigger
                        id="keyword-select" // Changed id
                        disabled={isLoading}
                        className="w-full h-12 text-base bg-gray-50 dark:bg-neutral-900 border-gray-300 dark:border-neutral-700 focus-visible:ring-primary hover:bg-gray-100 dark:hover:bg-neutral-800 pr-28" // Adjusted padding right
                      >
                        <SelectValue placeholder="Select a keyword..." />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Add placeholder if no keyword is selected initially */}
                        {/* <SelectItem value="__PLACEHOLDER__" disabled>Select a keyword...</SelectItem> */}
                        {hardcodedKeywords.map((kw) => (
                          <SelectItem key={kw} value={kw}>
                            {kw}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Action Buttons - Simplified */}
                    <div className="absolute right-2 top-2 h-8 flex items-center gap-2">
                      <Button
                        type="submit"
                        disabled={isLoading || !keyword} // Disable if loading or no keyword selected
                        className={cn(
                          "flex items-center gap-1.5 px-3 text-xs font-mono transition-colors border h-full",
                          "bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100 dark:bg-neutral-800 dark:text-gray-300 dark:border-neutral-700 dark:hover:bg-neutral-700",
                          (isLoading || !keyword) &&
                            "opacity-50 cursor-not-allowed" // Updated disabled style check
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <TerminalSquare className="h-3.5 w-3.5" />
                        )}
                        Generate
                      </Button>
                      {/* Removed Media Site Button */}
                    </div>
                  </div>
                </div>

                {/* Cluster Selection Dropdown (Removed) */}
                {/* {isMounted && hasClusters && ( ... )} */}

                {/* Removed Media Site and Fine-Tune Selection Areas */}

                {/* Progress Checklist */}
                {generationAttempted && (
                  <ProgressChecklistDisplay steps={steps} />
                )}

                {/* Error Display */}
                {!isLoading && (
                  <ErrorDisplay
                    error={error}
                    onDismiss={() => setError(null)}
                  />
                )}

                {/* Result Display */}
                {!isLoading && researchPrompt && (
                  <ResultDisplay
                    researchPrompt={researchPrompt}
                    generatedOutlineText={generatedOutlineText}
                    onCopyToClipboard={handleCopyToClipboard}
                    onStartOver={handleStartOver}
                    copied={copied}
                  />
                )}
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
