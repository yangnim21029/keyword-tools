"use client"

import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/LoadingButton";
import { useQueryStore } from "@/providers/QueryProvider";
import { useSettingsStore } from "@/store/settingsStore";
import { FileText, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";

export default function KeywordToolLandingPage() {
  // --- Hooks ---
  const router = useRouter();
  const settingsState = useSettingsStore((store) => store.state);
  const {
    queryInput,
    isLoading,
    loadingMessage
  } = useQueryStore((store) => store.state);
  const {
    setQueryInput,
    handleQuerySubmit
  } = useQueryStore((store) => store.actions);

  // --- Logic --- 
  // Function to handle search submission (moved from layout)
  const triggerQuery = useCallback(async () => {
    if (!queryInput.trim()) return;

    const newResearchId = await handleQuerySubmit({
      region: settingsState.region,
      language: settingsState.language,
      useAlphabet: settingsState.useAlphabet,
      useSymbols: settingsState.useSymbols,
    });

    if (newResearchId) {
      router.push(`/tools/keyword/${newResearchId}`);
    }
  }, [queryInput, handleQuerySubmit, settingsState, router]);

  // Keyboard shortcut (Enter in input field)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isLoading) {
      triggerQuery();
    }
  };

  // Optional: Global shortcut (Cmd/Ctrl+Enter) - might be less necessary now
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isLoading) {
        // Ensure the focus isn't already on an input to avoid double submission
        if (!(document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement)) {
          triggerQuery();
        }
      }
    }
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => window.removeEventListener("keydown", handleGlobalKeyDown)
  }, [triggerQuery, isLoading]) // Add isLoading dependency

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
              className="h-10 shadow-sm rounded-md text-base pl-10 pr-4 w-full" // Increased padding left for icon
              disabled={isLoading}
            />
             </div>
          <LoadingButton
            onClick={triggerQuery}
            className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground px-4 sm:px-6 rounded-md transition-colors shadow-sm text-base"
            isLoading={isLoading}
            loadingText={loadingMessage || "處理中..."}
            disabled={isLoading || !queryInput.trim()} // Disable if loading or input is empty
          >
            搜索
             </LoadingButton>
        </div>
       </div>
     </div>
   );
}