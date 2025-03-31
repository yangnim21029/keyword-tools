// New file content placeholder
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse JSON body from the request
    const { keywords, historyId, model = 'gpt-4' } = await req.json();
    
    // Validate input
    if (!keywords || !Array.isArray(keywords) || keywords.length < 5) {
      return new Response(
        JSON.stringify({ 
          error: 'At least 5 keywords are required for clustering' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Limit number of keywords to prevent large requests
    const MAX_CLUSTERING_KEYWORDS = 80;
    const limitedKeywords = keywords.slice(0, MAX_CLUSTERING_KEYWORDS);
    
    // 如果提供了歷史記錄ID，重新驗證對應的標籤
    if (historyId && typeof historyId === 'string') {
      revalidateTag('history');
      revalidateTag(`history-${historyId}`);
      console.log(`[API] 已重新驗證歷史記錄標籤: history-${historyId}`);
    }
    
    // Same prompt as the original function
    const prompt = `請根據以下關鍵詞進行語意分群。目標是將相關的關鍵詞歸類到主題中。

語意辨識的方法，是根據能否至放到同一篇文章，作為 listicle 為依據，不是以 SEO 為主，例如：不以基本知識這種概括詞分群
    
請按以下 JSON 格式返回結果：
{
  "clusters": {
    "主題名稱1": ["關鍵詞1", "關鍵詞2", ...],
    "主題名稱2": ["關鍵詞3", "關鍵詞4", ...],
    ...
  }
}

注意事項：
1. 主題名稱應簡潔明了
2. 盡量讓每個主題包含關聯性強的關鍵詞
3. 如果有關鍵詞難以歸類，可以放入"其他"類別
4. 不要遺漏任何關鍵詞
5. 確保返回的是有效的 JSON 格式

關鍵詞列表：
${limitedKeywords.join(', ')}`;
    
    // Use the streamText function from the ai package to create a streaming response
    const response = streamText({
      model: openai(model),
      messages: [
        { role: "system", content: prompt }
      ]
    });
    
    // Return the streaming response
    return response.toTextStreamResponse({
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
  } catch (error) {
    console.error('Error in semantic clustering API:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Error processing semantic clustering request' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}