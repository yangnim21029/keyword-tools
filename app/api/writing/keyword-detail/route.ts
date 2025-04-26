import { getKeywordVolumeObj } from '@/app/services/firebase/data-keyword-volume';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { researchId } = body;

    if (!researchId || typeof researchId !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid researchId' },
        { status: 400 }
      );
    }

    console.log(`[API Keyword Detail] Fetching details for ID: ${researchId}`);
    const keywordDetail = await getKeywordVolumeObj({ researchId });

    if (!keywordDetail) {
      console.warn(
        `[API Keyword Detail] No details found for ID: ${researchId}`
      );
      // Return 404 or an empty object/null?
      // Let's return null for consistency with how the context might handle it.
      return NextResponse.json(null);
      // Or return 404:
      // return NextResponse.json({ error: 'Keyword details not found' }, { status: 404 });
    }

    console.log(
      `[API Keyword Detail] Details fetched successfully for ID: ${researchId}`
    );
    return NextResponse.json(keywordDetail);
  } catch (error) {
    console.error(
      '[API Keyword Detail] Error fetching keyword details:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch keyword details', details: errorMessage },
      { status: 500 }
    );
  }
}
