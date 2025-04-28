import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

import { submitAiAnalysisSerpTitle } from '@/app/actions/actions-ai-serp-result';

// --- Define Input Schema ---
const inputSchema = z.object({
  serpDocId: z.string().min(1, 'serpDocId is required')
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/4-analyze-title] Received request');
  try {
    const body = await request.json();
    // --- Validate Input ---
    const validation = inputSchema.safeParse(body);
    if (!validation.success) {
      console.error(
        '[API /writing/4-analyze-title] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }
    // --- End Validation ---

    const { serpDocId } = validation.data; // Get validated ID
    const result = await submitAiAnalysisSerpTitle({ docId: serpDocId }); // Pass only ID
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      '[API /writing/4-analyze-title] Error calling action step:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Failed during title analysis step', details: errorMessage },
      { status: 500 }
    );
  }
}
