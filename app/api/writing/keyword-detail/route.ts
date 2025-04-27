'use server';

import { getKeywordVolumeObj } from '@/app/services/firebase/data-keyword-volume';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

// Input schema for validation
const inputSchema = z.object({
  researchId: z.string().min(1, 'researchId is required')
});

// Function to handle POST requests for keyword details
export async function POST(request: NextRequest) {
  console.log('[API /writing/keyword-detail] Received request');
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error(
        '[API /writing/keyword-detail] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const { researchId } = validation.data;

    console.log(
      `[API /writing/keyword-detail] Fetching details for ID: ${researchId}`
    );
    const keywordDetail = await getKeywordVolumeObj({ researchId });

    if (!keywordDetail) {
      console.warn(
        `[API /writing/keyword-detail] No details found for ID: ${researchId}`
      );
      // Return null as the client-side handler expects null if not found
      return NextResponse.json(null, { status: 404 });
    }

    console.log(
      `[API /writing/keyword-detail] Details fetched successfully for ID: ${researchId}`
    );
    // Return the fetched object
    return NextResponse.json(keywordDetail);
  } catch (error) {
    console.error(
      '[API /writing/keyword-detail] Error fetching keyword details:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown server error';
    return NextResponse.json(
      { error: 'Failed to fetch keyword details', details: errorMessage },
      { status: 500 }
    );
  }
}
