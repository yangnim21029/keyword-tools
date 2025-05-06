"use server";

import { revalidateTag } from "next/cache";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function revalidateKeywordVolumeList() {
  revalidateTag("getKeywordVolumeList");
  return { success: true };
}

export async function testAiLifecycle() {
  try {
    // Test OpenAI connection with a simple prompt
    const response = await generateText({
      model: openai("gpt-4.1-nano"),
      prompt: 'Hello, this is a test. Please respond with "AI is alive!"',
      maxTokens: 10,
    });

    if (!response.text) {
      throw new Error("No response from AI");
    }

    return {
      success: true,
      message: "AI is alive and responding!",
      response: response.text,
    };
  } catch (error) {
    console.error("AI test failed:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Unknown error occurred",
      response: null,
    };
  }
}
