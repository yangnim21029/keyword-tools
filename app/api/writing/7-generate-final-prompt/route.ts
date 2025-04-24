import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
// Import the specific step function from actions
import { generateFinalPromptStep } from '@/app/actions/writing-actions';

// Input schema should match the expected input for generateFinalPromptStep
const inputSchema = z.object({
    keyword: z.string().min(1),
    actionPlan: z.string(),
    mediaSiteName: z.string().min(1), // Needed by action step
    contentTypeReportText: z.string(),
    userIntentReportText: z.string(),
    betterHaveRecommendationText: z.string().optional().nullable(),
    keywordReport: z.any().optional().nullable(),
    selectedClusterName: z.string().optional().nullable(),
    outlineRefName: z.string().optional().default(''),
    contentMarketingSuggestion: z.string().optional().default(''),
    fineTuneNames: z.array(z.string()).optional(),
    betterHaveAnalysisJson: z.any().optional().nullable(), // Included as action step uses it
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/7-generate-final-prompt] Received request');
   try {
    const body = await request.json();
    // TEMPORARY: Log the raw body before parsing
    console.log('[API /writing/7] Raw request body:', body);
    const validation = inputSchema.safeParse(body);

     if (!validation.success) {
       console.error('[API /writing/7-generate-final-prompt] Invalid input:', validation.error.errors);
       return NextResponse.json({ error: 'Invalid input', details: validation.error.format() }, { status: 400 });
     }

    const inputData = validation.data;
    console.log(`[API /writing/7-generate-final-prompt] Calling action step for Keyword: ${inputData.keyword}`);

    // Call the imported action function
    const result = await generateFinalPromptStep(inputData);

    console.log(`[API /writing/7-generate-final-prompt] Action step complete for Keyword: ${inputData.keyword}`);
    // Return the result from the action step { finalPrompt: string }
    return NextResponse.json(result, { status: 200 });

  } catch (error) {
    console.error('[API /writing/7-generate-final-prompt] Error calling action step:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed during final prompt generation step', details: errorMessage }, { status: 500 });
  }
} 