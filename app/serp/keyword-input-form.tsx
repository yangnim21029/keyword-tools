'use client';

import { LANGUAGES, REGIONS } from '@/app/config/constants'; // Import existing constants
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'; // Import Select components
import { sanitizeKeywordForId } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';

// Props now contains sanitized IDs
type KeywordInputFormProps = {
  existingKeywords: string[]; // This list now contains SANITIZED IDs
};

export function KeywordInputForm({ existingKeywords }: KeywordInputFormProps) {
  const [keyword, setKeyword] = useState('');
  // Initialize region and language state, using default values from constants
  const [selectedRegion, setSelectedRegion] = useState<string>(
    REGIONS['台灣'] || Object.values(REGIONS)[0] || '' // Default to TW or first available
  );
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    Object.keys(LANGUAGES)[0] || '' // Default to first language code
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setError('關鍵字不能為空。');
      return;
    }

    setIsLoading(true);

    try {
      const sanitizedId = sanitizeKeywordForId(trimmedKeyword);
      if (!sanitizedId) {
        setError('無法處理此關鍵字以生成有效 ID。');
        setIsLoading(false);
        return;
      }

      const encodedOriginalKeyword = encodeURIComponent(trimmedKeyword);
      const encodedRegion = encodeURIComponent(selectedRegion);
      const encodedLanguage = encodeURIComponent(selectedLanguage);

      // Construct the target URL with sanitized ID and query params
      const targetUrl = `/serp/${sanitizedId}?q=${encodedOriginalKeyword}&region=${encodedRegion}&lang=${encodedLanguage}`;

      console.log(`[Keyword Input] Redirecting to: ${targetUrl}`);

      router.push(targetUrl);
    } catch (e) {
      console.error('[Keyword Input] Error during redirection:', e);
      setError('重定向時發生錯誤，請重試。');
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-lg flex flex-col items-center">
      <form
        onSubmit={handleSubmit}
        className="w-full flex flex-col items-center mb-8" // Add margin bottom to separate form and list
      >
        <div className="flex w-full items-center space-x-2 mb-4">
          <Input
            type="text"
            placeholder="例如：Next.js 教學"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            className="flex-grow"
            disabled={isLoading}
            aria-label="Keyword for SERP analysis"
          />
          <Button type="submit" disabled={isLoading || !keyword.trim()}>
            {isLoading ? '處理中...' : '分析 SERP'}
          </Button>
        </div>

        {/* Region and Language Selectors */}
        <div className="flex w-full gap-4 mb-4">
          {/* Region Select */}
          <Select
            value={selectedRegion}
            onValueChange={setSelectedRegion}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇地區" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(REGIONS).map(([name, code]) => (
                <SelectItem key={code} value={code}>
                  {name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Language Select */}
          <Select
            value={selectedLanguage}
            onValueChange={setSelectedLanguage}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="選擇語言" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LANGUAGES).map(([code, name]) => (
                <SelectItem key={code} value={code}>
                  {name} ({code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
      </form>

      {/* Display the list of existing SANITIZED IDs */}
      {existingKeywords && existingKeywords.length > 0 && (
        <div className="w-full border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 text-center">
            已分析的記錄 (ID)
          </h2>
          <ul className="space-y-2 max-h-60 overflow-y-auto text-center text-sm font-mono">
            {existingKeywords.map(sanitizedId => (
              <li key={sanitizedId}>
                <Link
                  href={`/serp/${sanitizedId}`}
                  className="text-blue-600 hover:underline hover:text-blue-800 break-all"
                >
                  {sanitizedId} {/* Display the sanitized ID */}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
