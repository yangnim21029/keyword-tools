'use client';

import { processAndSaveKeywordQuery } from '@/app/actions';
import { LANGUAGES, REGIONS } from '@/app/config/constants'; // Import constants
import { Input } from '@/components/ui/input';
import { LoadingButton } from '@/components/ui/LoadingButton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Search } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

export default function KeywordSearchForm() {
  // --- Hooks ---
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Local State ---
  const [queryInput, setQueryInput] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Add local state for region and language selection
  const [selectedRegion, setSelectedRegion] = useState<string>(
    Object.values(REGIONS)[0] || ''
  ); // Default to first region value
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    Object.keys(LANGUAGES)[0] || ''
  ); // Default to first language code

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
      // Pass hardcoded values for settings now that store is removed
      const result = await processAndSaveKeywordQuery({
        query: queryInput,
        region: selectedRegion,
        language: selectedLanguage,
        useAlphabet: false, // Hardcoded
        useSymbols: true,  // Hardcoded
        filterZeroVolume: false // Hardcoded (previous default)
      });

      if (result.success && result.researchId) {
        toast.success(`研究記錄已創建 (ID: ${result.researchId})`);
        router.push(`/keyword-mapping/${result.researchId}`);
      } else {
        const errorMsg = result.error || '創建研究記錄失敗，請稍後再試。';
        setError(errorMsg);
        toast.error(errorMsg);
        if (result.researchId) {
          toast.info(
            `研究記錄可能已部分創建 (ID: ${result.researchId})，但後續步驟失敗。`
          );
        }
      }
    } catch (err) {
      console.error('[KeywordToolPage] Error calling server action:', err);
      const message =
        err instanceof Error ? err.message : '處理請求時發生意外錯誤。';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
      setLoadingMessage(null);
    }
  }, [
    queryInput,
    selectedRegion, 
    selectedLanguage, 
    router,
    isLoading,
  ]);

  // Keyboard shortcut (Enter in input field)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      triggerQuery();
    }
  };

  // --- Render ---
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-md px-4">
      <div className="w-full text-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 rounded-lg">
        <h1 className="text-xl sm:text-2xl font-bold mb-2">
          你的 SEO 主題是...
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4">
          輸入文字 / 網址，就會開始分析。
        </p>

        {/* Search Input Group */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="輸入關鍵字或網址..."
              value={queryInput}
              onChange={e => setQueryInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-10 rounded-md text-base pl-10 pr-4 w-full"
              disabled={isLoading}
            />
          </div>
          <LoadingButton
            onClick={triggerQuery}
            className="h-10 bg-primary hover:bg-primary/90 text-primary-foreground px-4 rounded-md transition-colors text-base"
            isLoading={isLoading}
            loadingText={loadingMessage || '處理中...'}
            disabled={isLoading || !queryInput.trim()}
          >
            搜索
          </LoadingButton>
        </div>

        {/* Region and Language Selection - Updated */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Region Select */}
          <Select value={selectedRegion} onValueChange={setSelectedRegion}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="選擇地區" />
            </SelectTrigger>
            <SelectContent>
              {/* Use REGIONS constant */}
              {Object.entries(REGIONS).map(([name, code]) => (
                <SelectItem key={code} value={code}>
                  {name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Language Select */}
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="選擇語言" />
            </SelectTrigger>
            <SelectContent>
              {/* Use LANGUAGES constant */}
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p className="mt-3 text-sm text-destructive">錯誤：{error}</p>
        )}
      </div>
    </div>
  );
}
