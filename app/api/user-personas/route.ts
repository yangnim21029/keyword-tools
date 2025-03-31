import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { NextRequest } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // Parse JSON body from the request
    const { keywords, model = 'gpt-4' } = await req.json();
    
    // Validate input
    if (!keywords || !Array.isArray(keywords) || keywords.length < 1) {
      return new Response(
        JSON.stringify({ 
          error: 'At least 1 keyword is required for persona creation' 
        }),
        { 
          status: 400, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Limit number of keywords to prevent large requests
    const MAX_KEYWORDS = 80;
    const limitedKeywords = keywords.slice(0, MAX_KEYWORDS);
    
    const prompt = `分析以下關鍵詞並創建不同的用戶畫像。每個畫像應該代表一個具有特定特徵、興趣、痛點和目標的用戶檔案。

關鍵詞：${limitedKeywords.join(', ')}

請創建最多 5 個不同的用戶畫像。對於每個畫像，請提供：
1. 描述性名稱
2. 詳細描述
3. 相關的關鍵詞（從輸入列表中選擇）
4. 主要特徵
5. 興趣和愛好
6. 痛點和挑戰
7. 目標和願望

請按照以下 JSON 格式返回結果：
{
  "personas": [
    {
      "name": "畫像名稱",
      "description": "詳細描述",
      "keywords": ["相關關鍵詞"],
      "characteristics": ["特徵1", "特徵2"],
      "interests": ["興趣1", "興趣2"],
      "painPoints": ["痛點1", "痛點2"],
      "goals": ["目標1", "目標2"]
    }
  ]
}

注意事項：
1. 畫像名稱應簡潔明了
2. 確保每個畫像都有獨特的用戶特徵
3. 關鍵詞應合理分配到各個畫像中
4. 確保返回的是有效的 JSON 格式`;
    
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
    console.error('Error in user personas API:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Error processing user personas request' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
} 