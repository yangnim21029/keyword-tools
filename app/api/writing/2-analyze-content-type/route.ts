import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { analyzeContentTypeStep } from '@/app/actions/writing-actions';

// Input schema should match the expected input for analyzeContentTypeStep
const inputSchema = z.object({
  serpDocId: z.string().min(1),
  keyword: z.string().min(1),
  // Pass the raw organic results as expected by the action step
  organicResults: z.array(z.any()).optional().nullable(),
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/2-analyze-content-type] Received request');
   try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error('[API /writing/2-analyze-content-type] Invalid input:', validation.error.errors);
      return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
    }

    // Input is already validated and typed according to inputSchema
    const inputData = validation.data;
    console.log(`[API /writing/2-analyze-content-type] Calling action step for Doc ID: ${inputData.serpDocId}`);

    // Call the imported action function
    const result = await analyzeContentTypeStep(inputData);

    console.log(`[API /writing/2-analyze-content-type] Action step completed for Doc ID: ${inputData.serpDocId}`);
    // Return the result from the action step
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /writing/2-analyze-content-type] Error calling action step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    // Provide more specific error message if possible
    return NextResponse.json({ error: 'Failed during content type analysis step', details: errorMessage }, { status: 500 });
  }
} 