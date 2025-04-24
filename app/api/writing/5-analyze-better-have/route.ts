import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { analyzeBetterHaveStep } from '@/app/actions/writing-actions';

// Input schema should match the expected input for analyzeBetterHaveStep
const inputSchema = z.object({
    serpDocId: z.string().min(1),
    keyword: z.string().min(1),
    organicResults: z.array(z.any()).optional().nullable(),
    peopleAlsoAsk: z.array(z.any()).optional().nullable(),
    relatedQueries: z.array(z.any()).optional().nullable(),
    aiOverview: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/5-analyze-better-have] Received request');
   try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

     if (!validation.success) {
       console.error('[API /writing/5-analyze-better-have] Invalid input:', validation.error.errors);
       return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
     }

    const inputData = validation.data;
    console.log(`[API /writing/5-analyze-better-have] Calling action step for Doc ID: ${inputData.serpDocId}`);

    // Call the imported action function
    const result = await analyzeBetterHaveStep(inputData);

    console.log(`[API /writing/5-analyze-better-have] Action step complete for Doc ID: ${inputData.serpDocId}`);
    // Return the result from the action step { analysisJson: ..., recommendationText: ... }
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /writing/5-analyze-better-have] Error calling action step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed during Better Have analysis step', details: errorMessage }, { status: 500 });
  }
} 