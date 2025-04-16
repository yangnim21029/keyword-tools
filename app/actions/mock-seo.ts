'use server'

/**
 * Mock server action for SEO-related functions
 * This is used as a placeholder until real implementations are created
 */
export async function mockSeoAction(input: any) {
  console.log("[Server Action] Received mock SEO action request:", input);
  return { 
    message: "This is a mock response. The actual server action is not implemented yet.",
    input: input
  };
} 