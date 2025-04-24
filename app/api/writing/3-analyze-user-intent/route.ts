import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { analyzeUserIntentStep } from '@/app/actions/writing-actions';

// Input schema should match the expected input for analyzeUserIntentStep
const inputSchema = z.object({
    serpDocId: z.string().min(1),
    keyword: z.string().min(1),
    organicResults: z.array(z.any()).optional().nullable(),
    relatedQueries: z.array(z.any()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/3-analyze-user-intent] Received request');
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

     if (!validation.success) {
      console.error('[API /writing/3-analyze-user-intent] Invalid input:', validation.error.errors);
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
    }

    const inputData = validation.data;
    console.log(`[API /writing/3-analyze-user-intent] Calling action step for Doc ID: ${inputData.serpDocId}`);

    // Call the imported action function
    const result = await analyzeUserIntentStep(inputData);

    console.log(`[API /writing/3-analyze-user-intent] Action step complete for Doc ID: ${inputData.serpDocId}`);
    // Return the result from the action step { analysisText: string }
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /writing/3-analyze-user-intent] Error calling action step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed during user intent analysis step', details: errorMessage }, { status: 500 });
  }
} 