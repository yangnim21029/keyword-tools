import { NextResponse, type NextRequest } from 'next/server';
// Import the specific step function from actions
import { submitAiAnalysisSerpBetterHave } from '@/app/actions/actions-ai-serp-result';
import { z } from 'zod'; // Import Zod

// --- Define Input Schema ---
const inputSchema = z.object({
  serpDocId: z.string().min(1, 'serpDocId is required')
});

export async function POST(request: NextRequest) {
  console.log('[API /writing/5-analyze-better-have] Received request');
  try {
    const body = await request.json();
    // --- Validate Input ---
    const validation = inputSchema.safeParse(body);
    if (!validation.success) {
      console.error(
        '[API /writing/5-analyze-better-have] Invalid input:',
        validation.error.errors
      );
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.format() },
        { status: 400 }
      );
    }
    // --- End Validation ---

    const { serpDocId } = validation.data; // Get validated ID
    const result = await submitAiAnalysisSerpBetterHave({ docId: serpDocId }); // Pass only ID
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error(
      '[API /writing/5-analyze-better-have] Error calling action step:',
      error
    );
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json(
      {
        error: 'Failed during Better Have analysis step',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}
