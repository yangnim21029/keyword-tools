import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { analyzeTitleStep } from '@/app/actions/writing-actions';
import type { AiTitleAnalysisJson } from '@/app/services/firebase/schema'; // Import type for result

// Input schema should match the expected input for analyzeTitleStep
const inputSchema = z.object({
  serpDocId: z.string().min(1),
  keyword: z.string().min(1),
  organicResults: z.array(z.any()).optional().nullable()
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/4-analyze-title] Received request');
  try {
    const body = await request.json();
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

    const inputData = validation.data;
    console.log(
      `[API /writing/4-analyze-title] Calling action step for Doc ID: ${inputData.serpDocId}`
    );

    // Call the imported action function
    const result: {
      analysisJson: AiTitleAnalysisJson;
      recommendationText: string;
    } = await analyzeTitleStep(inputData);

    console.log(
      `[API /writing/4-analyze-title] Action step complete for Doc ID: ${inputData.serpDocId}`
    );
    // Return the result from the action step { analysisJson: ..., recommendationText: ... }
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
