// Keep necessary SERVER-SIDE imports
import { getKeywordVolumeList } from '@/app/services/firebase/data-keyword-volume';
import type { KeywordVolumeListItem } from '@/app/services/firebase/schema';

// Import the Client Component wrapper for state
import { WritingProvider } from './context/writing-context';
// Import the component that uses the context
import { WritingFormAndResults } from './components/writing-form-and-results';

// --- Make the page component async and fetch data server-side ---
export default async function WritingPageServer() {
  // --- Fetch initial data on the server ---
  let initialKeywordList: KeywordVolumeListItem[] = [];
  let fetchError: string | null = null;
  try {
    // Fetch the list, providing the argument as an object
    const summaries = await getKeywordVolumeList({ limit: 50 });
    if (summaries && Array.isArray(summaries)) {
      initialKeywordList = summaries;
    } else {
      console.error(
        '[WritingPageServer] Invalid format from getKeywordVolumeList'
      );
      fetchError = 'Failed to fetch initial keywords: Invalid response format.';
    }
  } catch (error: any) {
    console.error(
      '[WritingPageServer] Failed to fetch keyword research list:',
      error
    );
    fetchError = error.message || 'Unknown error fetching initial keywords.';
  }

  return (
    <WritingProvider initialKeywordList={initialKeywordList}>
      <WritingFormAndResults />
    </WritingProvider>
  );
}
