"use client"

import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { processAndSaveKeywordQuery } from "@/app/actions";

export default function KeywordSearchForm() {
  // --- Hooks ---
  const router = useRouter();
  const searchParams = useSearchParams();
  const settingsState = useSettingsStore((store) => store.state);

  // --- Local State ---
  const [queryInput, setQueryInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Logic ---

  // Effect to initialize input from URL parameter
  useEffect(() => {
    const initialQueryFromUrl = searchParams.get('q');
    // Only set if local state is empty and param exists
    if (initialQueryFromUrl && !queryInput) {
      setQueryInput(decodeURIComponent(initialQueryFromUrl));
    }
    // Dependency array includes queryInput to prevent overriding user input
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, queryInput]); // Ensure queryInput is a dependency if we only set when empty

  // Function to handle search submission - Refactored
  const triggerQuery = useCallback(async () => {
    if (!queryInput.trim() || isLoading) return; // Prevent double submission

    setIsLoading(true);
    setLoadingMessage('正在處理請求...');
    setError(null); // Clear previous errors

    try {
      const result = await processAndSaveKeywordQuery({
        query: queryInput,
        region: settingsState.region,
        language: settingsState.language,
        useAlphabet: settingsState.useAlphabet,
        useSymbols: settingsState.useSymbols,
      });

      if (result.success && result.researchId) {
        toast.success(`研究記錄已創建 (ID: ${result.researchId})`);
        // Navigate first
        router.push(`/tools/keyword/${result.researchId}`);
        // Refresh data after navigation (optional, push might be enough)
        // router.refresh(); 
      } else {
        // Handle server action failure
        const errorMsg = result.error || '創建研究記錄失敗，請稍後再試。';
        setError(errorMsg);
        toast.error(errorMsg);
         if (result.researchId) {
             // This case might occur if record created but keyword update failed
             toast.info(`研究記錄可能已部分創建 (ID: ${result.researchId})，但後續步驟失敗。`);
             // Optionally navigate anyway?
             // router.push(`/tools/keyword/${result.researchId}`);
         }
      }
    } catch (err) {
      // Handle unexpected errors during the action call
      console.error("[KeywordToolPage] Error calling server action:", err);
      const message = err instanceof Error ? err.message : '處理請求時發生意外錯誤。';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [queryInput, settingsState, router, isLoading]); // Added isLoading dependency

  // Keyboard shortcut (Enter in input field)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      triggerQuery();
    }
  };

  // Optional: Global shortcut (Cmd/Ctrl+Enter)
  // useEffect(() => {
  //   const handleGlobalKeyDown = (e: KeyboardEvent) => {
  //     if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isLoading) {
  //       if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
  //         triggerQuery();
  //       }
  //     }
  //   }
  //   window.addEventListener("keydown", handleGlobalKeyDown)
  //   return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  // }, [triggerQuery, isLoading])

  // --- Render --- 
  return (
    <div className="flex flex-col items-center justify-center h-full pt-10 md:pt-20 px-4">
      <div className="w-full max-w-2xl text-center">
        {/* Icon and Title */}
        <FileText className="h-12 w-12 mx-auto mb-4 text-blue-500" />
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          關鍵詞研究工具
        </h1>
        <p className="text-muted-foreground mb-8">
          輸入關鍵詞或網址開始分析，獲取建議、搜索量、分群和用戶畫像。
        </p>

        {/* Search Input Group */}
        <div className="flex items-center w-full gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="輸入關鍵詞或網址..."
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 shadow-sm rounded-md text-base pl-10 pr-4 w-full"
              disabled={isLoading}
            />
          </div>
          <LoadingButton
            onClick={triggerQuery}
            className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground px-4 sm:px-6 rounded-md transition-colors shadow-sm text-base"
            isLoading={isLoading}
            loadingText={loadingMessage || "處理中..."}
            disabled={isLoading || !queryInput.trim()}
          >
            搜索
          </LoadingButton>
        </div>

        {/* Error Display Area */}
        {error && (
          <p className="mt-4 text-sm text-destructive">
            錯誤：{error}
          </p>
        )}
       </div>
     </div>
   );
} 