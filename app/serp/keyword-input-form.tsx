'use client';

import { LANGUAGES, REGIONS } from '@/app/global-config'; // Import existing constants
// Import the Server Action instead
import {
  deleteSerpAnalysisAction,
  findOrCreateSerpAnalysisAction
} from '@/app/actions/serp-action';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'; // Import Select components
import { Trash2 } from 'lucide-react'; // Import an icon for the delete button
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';

// Update props to accept {id, keyword} objects
type KeywordInputFormProps = {
  existingKeywords: { id: string; keyword: string }[];
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
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const router = useRouter();

  // Use transition for delete to handle pending state without blocking UI
  const [isDeleting, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setSubmitError('關鍵字不能為空。');
      return;
    }

    setIsSubmitLoading(true);

    try {
      console.log(
        `[Keyword Input] Calling findOrCreate action for: ${trimmedKeyword}`
      );
      // Call the Server Action to find or create
      const docId = await findOrCreateSerpAnalysisAction({
        originalKeyword: trimmedKeyword,
        region: selectedRegion,
        language: selectedLanguage
      });

      // Redirect using the returned ID (either existing or new)
      if (docId) {
        console.log(
          `[Keyword Input] Action returned ID: ${docId}. Redirecting...`
        );
        router.push(`/serp/${docId}`);
        // No need to set loading false here as navigation occurs
      } else {
        // Should not happen if action is implemented correctly, but handle defensively
        throw new Error('Server action did not return a valid document ID.');
      }
    } catch (e) {
      console.error('[Keyword Input] Error during submit:', e);
      setSubmitError(
        e instanceof Error ? e.message : '提交時發生錯誤，請重試。'
      );
      setIsSubmitLoading(false);
    }
    // No finally block needed as loading is handled
  };

  // --- Delete Handler ---
  const handleDelete = async (idToDelete: string, keywordToDelete: string) => {
    setDeleteError(null);
    // Optional: Add a confirmation dialog
    if (
      !confirm(
        `確定要刪除關鍵字 "${keywordToDelete}" 的分析結果嗎？此操作無法復原。`
      )
    ) {
      return;
    }

    startTransition(async () => {
      try {
        console.log(
          `[Keyword Input] Calling delete action for ID: ${idToDelete}`
        );
        const result = await deleteSerpAnalysisAction({ docId: idToDelete });
        if (result.success) {
          console.log(
            `[Keyword Input] Deletion successful for ID: ${idToDelete}. Refreshing...`
          );
          // Refresh the current route to reflect the deletion in the list
          router.refresh();
        } else {
          console.error(
            `[Keyword Input] Deletion failed for ID: ${idToDelete}:`,
            result.message
          );
          setDeleteError(result.message || '刪除時發生未知錯誤。');
        }
      } catch (e) {
        console.error(
          `[Keyword Input] Error during delete action for ID: ${idToDelete}:`,
          e
        );
        setDeleteError(
          e instanceof Error ? e.message : '刪除操作失敗，請重試。'
        );
      }
    });
  };
  // --- End Delete Handler ---

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
            disabled={isSubmitLoading || isDeleting}
            aria-label="Keyword for SERP analysis"
          />
          <Button
            type="submit"
            disabled={isSubmitLoading || !keyword.trim() || isDeleting}
          >
            {isSubmitLoading ? '查詢/分析中...' : '查詢或開始分析'}
          </Button>
        </div>

        {/* Region and Language Selectors */}
        <div className="flex w-full gap-4 mb-4">
          {/* Region Select */}
          <Select
            value={selectedRegion}
            onValueChange={setSelectedRegion}
            disabled={isSubmitLoading || isDeleting}
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
            disabled={isSubmitLoading || isDeleting}
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

        {submitError && (
          <p className="text-red-600 text-sm mt-2">{submitError}</p>
        )}
      </form>

      {/* Display the list of existing keywords with Delete buttons */}
      {existingKeywords && existingKeywords.length > 0 && (
        <div className="w-full border-t pt-6">
          <h2 className="text-lg font-semibold mb-4 text-center">
            已分析的關鍵字
          </h2>
          {/* Display delete error if any */}
          {deleteError && (
            <p className="text-red-600 text-sm mb-2 text-center">
              刪除錯誤: {deleteError}
            </p>
          )}
          <ul className="space-y-2 max-h-60 overflow-y-auto text-sm">
            {existingKeywords.map(({ id, keyword }) => (
              // Use flex layout for link and button
              <li
                key={id}
                className="flex justify-between items-center group px-2 py-1 rounded hover:bg-gray-100"
              >
                <Link
                  href={`/serp/${id}`}
                  className="text-blue-600 hover:underline hover:text-blue-800 break-all flex-grow mr-2"
                >
                  {keyword}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(id, keyword)} // Call delete handler
                  disabled={isDeleting} // Disable while deleting
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 p-1 h-auto" // Show on hover
                  aria-label={`刪除 ${keyword}`}
                >
                  {/* Add icon */}
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
