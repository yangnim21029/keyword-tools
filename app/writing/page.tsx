"use client";

import {
  LANGUAGE_FINE_TUNE_DATA,
  MEDIA_SITE_FINE_TUNE_DATA,
  THEME_FINE_TUNE_DATA,
} from "@/app/prompt/fine-tune";
import { useClientStorage } from "@/components/hooks/use-client-storage";
import type React from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  RevalidateButton,
  FineTuneButton,
} from "@/app/actions/actions-buttons";

import type {
  KeywordVolumeListItem,
  KeywordVolumeObject,
} from "@/app/services/firebase/schema";

import { PromptGeneratorForm } from "./components/prompt-generator-form";
import { PromptGenerationResult } from "./components/prompt-generation-result";
import { ArticleRefinementInput } from "./components/article-refinement-input";
import { FinalArticleGeneratorControls } from "./components/final-article-generator-controls";
import { FinalArticleDisplay } from "./components/final-article-display";
import Link from "next/link";
import { usePromptGeneration } from "./hooks/usePromptGeneration";
import { useArticleRefinement } from "./hooks/useArticleRefinement";

const API_KEYWORD_LIST_URL = `/api/writing/keyword-list`;

const allFineTuneNames = [
  ...THEME_FINE_TUNE_DATA.map((item) => item.name),
  ...MEDIA_SITE_FINE_TUNE_DATA.map((item) => item.name),
  ...LANGUAGE_FINE_TUNE_DATA.map((item) => item.name),
];

export default function WritingPage() {
  const [keyword, setKeyword] = useClientStorage("writing:keyword", "");
  const [mediaSiteName, setMediaSiteName] = useClientStorage(
    "writing:mediaSiteName",
    ""
  );
  const [selectedFineTunes, setSelectedFineTunes] = useClientStorage<string[]>(
    "writing:selectedFineTunes",
    []
  );
  const [selectedKeywordReport, setSelectedKeywordReport] =
    useClientStorage<KeywordVolumeObject | null>(
      "writing:selectedKeywordReport",
      null
    );
  const [selectedClusterName, setSelectedClusterName] =
    useState<string>("__ALL_CLUSTERS__");
  const [displayedPersona, setDisplayedPersona] = useState<string | null>(null);
  const [realKeywordList, setRealKeywordList] = useState<
    KeywordVolumeListItem[]
  >([]);
  const [isListLoading, setIsListLoading] = useState(true);
  const [listFetchError, setListFetchError] = useState<string | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [generationAttempted, setGenerationAttempted] = useClientStorage(
    "writing:generationAttempted",
    false
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showMediaSiteOptions, setShowMediaSiteOptions] = useState(false);
  const [showFineTuneOptions, setShowFineTuneOptions] = useState(false);
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [generatedOutlineText, setGeneratedOutlineText] = useClientStorage<
    string | null
  >("writing:generatedOutlineText", null);

  const [inputText, setInputText] = useClientStorage<string>(
    "writing:inputText",
    ""
  );
  const [targetUrl, setTargetUrl] = useClientStorage<string>(
    "writing:targetUrl",
    ""
  );
  const [referenceArticleTextManual, setReferenceArticleTextManual] =
    useClientStorage<string>("writing:referenceArticleTextManual", "");
  const [scrapeFailedForReferenceUrl, setScrapeFailedForReferenceUrl] =
    useState(false);
  const [targetUrlError, setTargetUrlError] = useState<string | null>(null);

  const [researchPrompt, setResearchPrompt] = useClientStorage<string | null>(
    "writing:researchPrompt",
    null
  );
  const [finalArticle, setFinalArticle] = useClientStorage<string | null>(
    "writing:finalArticle",
    null
  );

  const {
    steps,
    isLoading: isLoadingPrompt,
    error: promptError,
    generatePrompt,
    resetPromptGeneration,
    clearError: clearPromptError,
  } = usePromptGeneration({
    keyword,
    mediaSiteName,
    selectedKeywordReport,
    selectedClusterName,
    generatedOutlineText,
    selectedFineTunes,
    onGenerationStart: () => {
      setGenerationAttempted(true);
      resetArticleRefinement();
      setFinalArticle(null);
    },
    onGenerationSuccess: (prompt: string) => {
      console.log("[UI] Hook reported prompt generation success.");
      setResearchPrompt(prompt);
    },
    onGenerationError: (error: string) => {
      console.error("[UI] Hook reported prompt generation error:", error);
    },
    onReset: () => {
      setGenerationAttempted(false);
      resetArticleRefinement();
      setResearchPrompt(null);
      setFinalArticle(null);
    },
  });

  const {
    isGeneratingArticle,
    articleError,
    generateArticle,
    generateArticleFromPastedReference,
    resetArticleRefinement,
    clearArticleError,
  } = useArticleRefinement({
    onGenerationSuccess: (article: string) => {
      console.log("[UI] Article generation succeeded.");
      setFinalArticle(article);
      setScrapeFailedForReferenceUrl(false);
      setTargetUrlError(null);
    },
    onGenerationFailure: (error: string, type?: "scrape" | "ai") => {
      if (type === "scrape") {
        setScrapeFailedForReferenceUrl(true);
        setTargetUrlError(error);
        toast.error(
          `Reference URL Error: ${error}. Please paste content manually.`
        );
      }
    },
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    const loadKeywordsFromApi = async () => {
      setIsListLoading(true);
      setListFetchError(null);
      try {
        const response = await fetch(API_KEYWORD_LIST_URL, { method: "GET" });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `Failed to fetch keywords: ${response.statusText || response.status} - ${errorText}`
          );
        }
        const summaries = await response.json();
        if (!Array.isArray(summaries)) {
          throw new Error("Failed to fetch keywords: Invalid response format.");
        }
        setRealKeywordList(summaries);
      } catch (error: any) {
        setListFetchError(error.message || "Unknown error");
      } finally {
        setIsListLoading(false);
      }
    };
    loadKeywordsFromApi();
  }, []);

  useEffect(() => {
    setSelectedClusterName("__ALL_CLUSTERS__");
  }, [selectedKeywordReport]);

  useEffect(() => {
    if (
      selectedClusterName === "__ALL_CLUSTERS__" ||
      !selectedKeywordReport?.clustersWithVolume
    ) {
      setDisplayedPersona(null);
      return;
    }
    const foundCluster = selectedKeywordReport.clustersWithVolume.find(
      (c: any) => c.clusterName === selectedClusterName
    );
    setDisplayedPersona(foundCluster?.personaDescription || null);
    if (
      selectedClusterName !== "__ALL_CLUSTERS__" &&
      !foundCluster?.personaDescription
    ) {
      console.warn(
        `Persona description not found for cluster: ${selectedClusterName}`
      );
    }
  }, [selectedClusterName, selectedKeywordReport]);

  const hasClusters =
    (selectedKeywordReport?.clustersWithVolume ?? []).length > 0;

  const handleCopyToClipboard = async (textToCopy: string | null) => {
    if (textToCopy) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        toast.success("Copied to clipboard!");
        if (textToCopy === researchPrompt) {
          setCopiedPrompt(true);
          setTimeout(() => setCopiedPrompt(false), 2000);
        }
      } catch (err) {
        toast.error("Failed to copy.");
      }
    }
  };

  const handleFineTuneChange = (checked: boolean | string, name: string) => {
    setSelectedFineTunes((prev) =>
      checked === true ? [...prev, name] : prev.filter((item) => item !== name)
    );
  };

  const handleSubmitPrompt = async (
    event?: React.FormEvent<HTMLFormElement>
  ) => {
    event?.preventDefault();
    await generatePrompt();
  };

  const handleGenerateFinalArticle = async () => {
    clearArticleError();
    if (targetUrl.trim() !== "" && !scrapeFailedForReferenceUrl) {
      setTargetUrlError(null);
    }

    if (!researchPrompt) {
      toast.error("Please generate a research prompt first.");
      return;
    }

    if (targetUrl.trim() !== "" && !scrapeFailedForReferenceUrl) {
      console.log(
        "[UI] Attempting article generation with Target URL:",
        targetUrl
      );
      setScrapeFailedForReferenceUrl(false);
      setTargetUrlError(null);
      await generateArticle(inputText, targetUrl);
    } else if (referenceArticleTextManual.trim() !== "") {
      console.log(
        "[UI] Attempting article generation with Manual Reference Text."
      );
      if (!inputText.trim()) {
        toast.info(
          "Please also provide your article draft in 'Paste Your Article' to refine."
        );
      }
      await generateArticleFromPastedReference(
        inputText,
        referenceArticleTextManual
      );
    } else {
      if (scrapeFailedForReferenceUrl) {
        toast.error(
          "Reference URL failed. Please paste the reference article content manually above, then try generating again."
        );
      } else if (
        targetUrl.trim() === "" &&
        referenceArticleTextManual.trim() === ""
      ) {
        toast.error(
          "Please provide a Reference Article URL, or paste its content manually."
        );
      }
      if (!inputText.trim()) {
        toast.info(
          "Please also provide your article draft in 'Paste Your Article'."
        );
      }
    }
  };

  const handleStartOver = () => {
    setKeyword("");
    setMediaSiteName("");
    setSelectedFineTunes([]);
    setSelectedKeywordReport(null);
    setSelectedClusterName("__ALL_CLUSTERS__");
    setDisplayedPersona(null);
    setGeneratedOutlineText(null);
    setInputText("");
    setTargetUrl("");
    setCopiedPrompt(false);
    setResearchPrompt(null);
    setFinalArticle(null);
    setReferenceArticleTextManual("");
    setScrapeFailedForReferenceUrl(false);
    setTargetUrlError(null);

    resetPromptGeneration();
    resetArticleRefinement();
  };

  // Group props for PromptGeneratorForm
  const keywordConfig = {
    keyword,
    setKeyword,
    selectedKeywordReport,
    setSelectedKeywordReport,
    realKeywordList,
  };

  const mediaSiteConfig = {
    mediaSiteName,
    setMediaSiteName,
    showMediaSiteOptions,
    setShowMediaSiteOptions,
  };

  const fineTuneConfig = {
    selectedFineTunes,
    handleFineTuneChange,
    allFineTuneNames,
    showFineTuneOptions,
  };

  const clusterConfig = {
    selectedClusterName,
    setSelectedClusterName,
    displayedPersona,
    hasClusters,
  };

  const loadingState = {
    isListLoading,
    listFetchError,
    isDetailLoading,
    setIsDetailLoading,
    isLoadingPrompt,
    isGeneratingArticle,
  };

  const uiState = {
    isMounted,
    comboboxOpen,
    setComboboxOpen,
  };

  const handlers = {
    handleSubmitPrompt,
  };

  if (!isMounted) return null;

  return (
    <div className="min-h-screen dark:from-neutral-950 dark:to-black">
      <div className="container mx-auto px-4 py-16 sm:px-6 lg:px-8 max-w-7xl">
        <div className="mb-8 text-center md:text-right">
          <Link
            href="/writing/recipe"
            className="text-sm font-medium text-primary hover:underline"
          >
            前往食譜專區 (Go to Recipe Section) &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
          <div className="space-y-6 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-red-400 dark:bg-red-500"></div>
                  <div className="w-2 h-2 rounded-full bg-yellow-400 dark:bg-yellow-500"></div>
                  <div className="w-2 h-2 rounded-full bg-green-400 dark:bg-green-500"></div>
                </div>
                <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                  PROMPT_GENERATION
                </span>
              </div>
              <div className="flex items-center gap-4">
                <FineTuneButton
                  disabled={
                    isLoadingPrompt || isGeneratingArticle || isDetailLoading
                  }
                  onClick={() => setShowFineTuneOptions(!showFineTuneOptions)}
                  count={selectedFineTunes.length}
                />
                <RevalidateButton size="sm" variant="ghost" />
              </div>
            </div>
            <PromptGeneratorForm
              keywordConfig={keywordConfig}
              mediaSiteConfig={mediaSiteConfig}
              fineTuneConfig={fineTuneConfig}
              clusterConfig={clusterConfig}
              loadingState={loadingState}
              uiState={uiState}
              handlers={handlers}
            />

            {generationAttempted && (
              <div className="mt-6 pt-6 border-t border-dashed dark:border-neutral-700">
                <PromptGenerationResult
                  generationAttempted={generationAttempted}
                  steps={steps}
                  isLoadingPrompt={isLoadingPrompt}
                  promptError={promptError}
                  researchPrompt={researchPrompt}
                  generatedOutlineText={generatedOutlineText}
                  handleCopyToClipboard={handleCopyToClipboard}
                  handleStartOver={handleStartOver}
                  copiedPrompt={copiedPrompt}
                  clearPromptError={clearPromptError}
                />
              </div>
            )}
          </div>

          <div className="space-y-8 p-6 bg-white dark:bg-neutral-900 rounded-lg shadow-md overflow-hidden">
            <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-neutral-700">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-400 dark:bg-blue-500"></div>
                <div className="w-2 h-2 rounded-full bg-orange-400 dark:bg-orange-500"></div>
                <div className="w-2 h-2 rounded-full bg-purple-400 dark:bg-purple-500"></div>
              </div>
              <span className="text-xs font-mono text-gray-500 dark:text-gray-400 uppercase">
                ARTICLE_REFINEMENT & GENERATION
              </span>
            </div>

            <ArticleRefinementInput
              inputText={inputText}
              setInputText={setInputText}
              targetUrl={targetUrl}
              setTargetUrl={setTargetUrl}
              isGeneratingArticle={isGeneratingArticle}
              isLoadingPrompt={isLoadingPrompt}
              scrapeFailedForReferenceUrl={scrapeFailedForReferenceUrl}
              referenceArticleTextManual={referenceArticleTextManual}
              setReferenceArticleTextManual={setReferenceArticleTextManual}
              targetUrlError={targetUrlError}
            />

            <div className="pt-6 border-t border-dashed dark:border-neutral-700">
              <FinalArticleGeneratorControls
                handleGenerateFinalArticle={handleGenerateFinalArticle}
                researchPrompt={researchPrompt}
                isGeneratingArticle={isGeneratingArticle}
                isLoadingPrompt={isLoadingPrompt}
                articleError={articleError}
                clearArticleError={clearArticleError}
              />
            </div>

            <FinalArticleDisplay
              finalArticle={finalArticle}
              isGeneratingArticle={isGeneratingArticle}
              handleStartOver={handleStartOver}
              handleCopyToClipboard={handleCopyToClipboard}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
