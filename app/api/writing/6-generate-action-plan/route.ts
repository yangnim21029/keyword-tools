import { generateActionPlanStep } from '@/app/actions/actions-ai-writing';
import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';

const inputSchema = z.object({
  keyword: z.string().min(1),
  mediaSiteName: z.string().min(1),
  contentTypeReportText: z.string().optional().nullable(),
  userIntentReportText: z.string().optional().nullable(),
  titleRecommendationText: z.string().optional().nullable(),
  betterHaveRecommendationText: z.string().optional().nullable(),
  keywordReport: z.any().optional().nullable(),
  selectedClusterName: z.string().optional().nullable()
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/6-generate-action-plan] Received request');
  try {
    const body = await request.json();
    const validation = inputSchema.safeParse(body);

    if (!validation.success) {
      console.error(
        '[API /writing/6-generate-action-plan] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }

    const inputData = validation.data;
    console.log(
      `[API /writing/6-generate-action-plan] Calling action step for Keyword: ${inputData.keyword}`
    );

    // Call the imported action function
    const result = await generateActionPlanStep(inputData);

    console.log(
      `[API /writing/6-generate-action-plan] Action step complete for Keyword: ${inputData.keyword}`
    );
    // Return the result from the action step { actionPlanText: string }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      '[API /writing/6-generate-action-plan] Error calling action step:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      {
        error: 'Failed during action plan generation step',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
