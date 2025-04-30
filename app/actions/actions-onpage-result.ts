'use server';

import { extractArticleContentFromUrl } from '@/app/services/scrape.service';
import { addOnPageResult } from '@/app/services/firebase/data-on-page-result';
import { revalidateTag } from 'next/cache';

const ONPAGE_DATA_TAG = 'onPageData'; // Match tag used in data service

/**
 * Server Action: Scrapes a URL and saves the extracted content to Firestore.
 */
export async function submitCreateScrape({
  url
}: {
  url: string;
}): Promise<{ success: boolean; error?: string; id?: string }> {
  console.log(`[Action: Create Scrape] Received request for URL: ${url}`);

  // Basic URL validation (more robust validation might be needed)
  if (!url || !url.startsWith('http')) {
    return { success: false, error: 'Invalid URL provided.' };
  }

  try {
    // 1. Extract content using the scrape service
    const scrapedContent = await extractArticleContentFromUrl(url);

    if (!scrapedContent) {
      console.error(`[Action: Create Scrape] Failed to extract content from ${url}.`);
      return { success: false, error: 'Failed to extract content from the URL.' };
    }

    // 2. Save the result to Firestore
    const newDocId = await addOnPageResult(scrapedContent);

    if (!newDocId) {
      console.error(`[Action: Create Scrape] Failed to save scraped content for ${url} to Firestore.`);
      return { success: false, error: 'Failed to save scraped content.' };
    }

    console.log(`[Action: Create Scrape] Successfully scraped and saved content for ${url}. New ID: ${newDocId}`);

    // 3. Revalidate cache for the list page
    revalidateTag(ONPAGE_DATA_TAG);

    // 4. Return success
    return { success: true, id: newDocId };

  } catch (error) {
    console.error(`[Action: Create Scrape] Unexpected error processing ${url}:`, error);
    return {
      success: false,
      error: `An unexpected error occurred: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

// Future Actions for On-Page AI Analysis could go here, similar to actions-ai-serp-result.ts
// e.g., export async function submitAiAnalysisOnPage(...) { ... } 