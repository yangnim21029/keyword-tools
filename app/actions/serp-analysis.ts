'use server'

import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { z } from 'zod';
import { fetchKeywordData } from '../services/serp.service';

// Define input schema
const inputSchema = z.object({
  keyword: z.string().min(1, '請輸入關鍵字'),
  model: z.enum(['gpt-4o', 'gpt-4o-mini']).default('gpt-4o-mini').optional(),
});

// Define output schema
const analysisSchema = z.object({
  title: z.string().describe('SEO 優化標題'),
  analysis: z.string().describe('SERP 標題分析'),
  recommendations: z.array(z.string()).describe('SEO 標題建議'),
});

/**
 * Analyzes SERP data using AI to provide SEO insights
 * @param input Object containing keyword and optional model choice
 * @returns Analysis of SERP titles with recommendations
 */
export async function performSerpAnalysis(input: { 
  keyword: string, 
  model?: 'gpt-4o' | 'gpt-4o-mini' 
}) {
  try {
    // Validate input
    const validatedInput = inputSchema.safeParse(input);
    if (!validatedInput.success) {
      console.error('[Server Action] SERP 分析輸入驗證失敗:', validatedInput.error.flatten());
      throw new Error(validatedInput.error.errors[0]?.message || '輸入參數無效');
    }
    
    const { keyword, model } = validatedInput.data;
    const openaiModel = model ?? 'gpt-4o-mini';
    
    console.log(`[Server Action] 收到 SERP 分析請求: 模型=${openaiModel}, 關鍵字=${keyword}`);
    
    // Fetch SERP data using the service
    console.log(`[Server Action] 正在獲取 SERP 數據: ${keyword}`);
    const serpData = await fetchKeywordData(keyword);
    
    if (!serpData || serpData.includes('獲取關鍵字數據時發生錯誤')) {
      throw new Error(`無法獲取 SERP 數據: ${serpData}`);
    }
    
    // Limit to the top 20 results
    const serpResults = serpData.split('\n\n').slice(0, 20).join('\n\n');
    
    // Create the prompt for the AI analysis
    const prompt = `Please ignore all previous instructions. Do not repeat yourself. Do not self reference. Do not explain what you are doing. Do not write any code. Do not analyze this. Do not explain.

Please type the text "SEO Report: Analyze SERP Titles for [${keyword}]" in h2 heading

Please type "What this report does: The Analyze SERP Titles report looks at the top webpages ranking in Google on the first page for the search query and tries to find patterns in them. It explains what it finds and gives recommendations for the title and also suggests a title for your content". 

Please type "When to use this report: The Analyze SERP Titles report should be used before you start writing content, by creating the page title. Read the recommendations and feel free to ask for more suggested page titles.".

You are an SEO expert who is very good at understanding and analyzing SERPs.

I have obtained data for the websites ranking for the first page of a top search engine for the search query "${keyword}".

I am listing below the positions, titles, descriptions and URLs of the top pages. Can you analyze the titles and find what is common among all of them. Finally, also create a new title that has the best of everything that is common.

The positions, titles, descriptions and URLs are given below:

${serpResults}

When you mention any position, display the link of the URL and use the number of the position as the anchor text.

Respond with a JSON object with the following structure:
{
  "title": "Your suggested optimized title",
  "analysis": "Your detailed analysis of the SERP titles",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"]
}

Do not include any text outside of this JSON structure. Return valid JSON only.`;

    console.log(`[Server Action] 正在發送請求到 OpenAI，模型: ${openaiModel}`);
    
    // Generate the analysis using AI
    const { text } = await generateText({
      model: openai(openaiModel),
      messages: [
        { role: "system", content: prompt }
      ],
      temperature: 0.7
    });
    
    console.log(`[Server Action] 收到 OpenAI 結果`);
    
    // Clean the AI response by removing any markdown code block markers
    let cleanedText = text.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.substring(7).trim();
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.substring(3).trim();
    }
    if (cleanedText.endsWith("```")) {
      cleanedText = cleanedText.substring(0, cleanedText.length - 3).trim();
    }
    
    try {
      // Parse and validate the JSON response
      const result = JSON.parse(cleanedText);
      const validatedResult = analysisSchema.parse(result);
      console.log(`[Server Action] SERP 分析結果驗證成功`);
      
      return validatedResult;
    } catch (parseError) {
      console.error('[Server Action] JSON 解析錯誤:', parseError, '清理後的文本:', cleanedText);
      throw new Error('無法解析 AI 返回的 JSON 格式');
    }
  } catch (error) {
    console.error('[Server Action] SERP 分析錯誤:', error);
    if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('執行 SERP 分析時發生未知錯誤');
    }
  }
} 