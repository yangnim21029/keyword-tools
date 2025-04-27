'use server';

import { getKeywordVolumeList } from '@/app/services/firebase/data-keyword-volume';
import { NextResponse } from 'next/server';

// Function to handle GET requests for the keyword list
export async function GET(request: Request) {
  console.log('[API /writing/keyword-list] Received request');
  try {
    // Extract query parameters for pagination/filtering if needed (e.g., limit, offset)
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = limitParam ? parseInt(limitParam, 10) : 50; // Default limit
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0; // Default offset

    if (isNaN(limit) || limit <= 0) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      );
    }
    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter' },
        { status: 400 }
      );
    }

    console.log(
      `[API /writing/keyword-list] Fetching list with limit: ${limit}, offset: ${offset}`
    );
    const keywordList = await getKeywordVolumeList({ limit, offset });

    if (!keywordList) {
      // This might happen if db is not initialized or another server error occurs in getKeywordVolumeList
      console.error(
        '[API /writing/keyword-list] getKeywordVolumeList returned null'
      );
      return NextResponse.json(
        { error: 'Failed to fetch keyword list from the database' },
        { status: 500 }
      );
    }

    console.log(
      `[API /writing/keyword-list] Successfully fetched ${keywordList.length} items.`
    );
    return NextResponse.json(keywordList);
  } catch (error) {
    console.error(
      '[API /writing/keyword-list] Error fetching keyword list:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to fetch keyword list', details: errorMessage },
      { status: 500 }
    );
  }
}
