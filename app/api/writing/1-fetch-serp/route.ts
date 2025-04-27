import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { submitCreateSerp } from '@/app/actions/actions-serp-result';
import { MEDIASITE_DATA } from '@/app/global-config';
import { findSerpResultObjects } from '@/app/services/firebase/data-serp-result';
// Input schema should match the expected input for fetchSerpStep
const inputSchema = z.object({
  keyword: z.string().min(1, 'Keyword is required'),
  mediaSiteName: z.string().min(1, 'Media site name is required')
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/1-fetch-serp] Received request');
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error(
        '[API /writing/1-fetch-serp] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const inputData = validation.data;
    console.log(
      `[API /writing/1-fetch-serp] Calling action step for Keyword: "${inputData.keyword}", Site: "${inputData.mediaSiteName}"`
    );

    // Call the imported action function
    // 取得 MEDIATSITE 的語言和地區
    const selectedSite = MEDIASITE_DATA.find(
      site => site.name === inputData.mediaSiteName
    );
    const language = selectedSite?.language;
    const region = selectedSite?.region;
    if (!language || !region) {
      throw new Error('Language or region not found');
    }
    let result = null;
    result = await findSerpResultObjects({
      language,
      region,
      query: inputData.keyword
    });

    if (result) {
      console.log(
        `[API /writing/1-fetch-serp] Found existing SERP. Doc ID: ${result.id}`
      );
      // --- Return minimal data ---
      if (!result.id || !result.originalKeyword) {
        console.error(
          '[API /writing/1-fetch-serp] Found SERP missing id or originalKeyword',
          result
        );
        throw new Error('Found SERP document is missing required fields.');
      }
      return NextResponse.json(
        { id: result.id, originalKeyword: result.originalKeyword },
        { status: 200 }
      );
      // --- End Return minimal ---
    }

    // If not found, create a new one
    console.log(
      `[API /writing/1-fetch-serp] No existing SERP found. Creating new one...`
    );
    const createResult = await submitCreateSerp({
      query: inputData.keyword,
      region,
      language
    });

    if (createResult.success && createResult.id) {
      console.log(
        `[API /writing/1-fetch-serp] Successfully created SERP. New Doc ID: ${createResult.id}.`
      );
      // --- Return minimal data ---
      return NextResponse.json(
        { id: createResult.id, originalKeyword: inputData.keyword },
        { status: 200 }
      );
      // --- End Return minimal ---
    } else {
      // Handle case where creation succeeded according to the action but ID is missing, or creation failed
      console.error(
        '[API /writing/1-fetch-serp] Failed to create SERP',
        createResult
      );
      throw new Error('Failed to create SERP');
    }
  } catch (error) {
    console.error(
      '[API /writing/1-fetch-serp] Error calling action step:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed during fetch SERP step', details: errorMessage },
      { status: 500 }
    );
  }
}
