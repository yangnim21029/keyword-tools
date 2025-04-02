// New file content placeholder
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { NextRequest } from 'next/server';
import { z } from 'zod';

// 允许响应最多30秒
export const maxDuration = 30;

// 定义分群结果的 schema
const clusterSchema = z.object({
  clusters: z.record(z.string(), z.array(z.string()))
    .describe('主題名稱映射到關鍵詞數組的分群結果'),
});

export async function POST(req: NextRequest) {
  console.log('[API] 收到語意分群請求');
  
  try {
    // Parse JSON body from the request
    const body = await req.json();
    const { keywords, historyId, model = 'gpt-4o-mini' } = body;
    
    console.log(`[API] 分群請求詳情: 模型=${model}, 關鍵詞數量=${keywords?.length || 0}, 歷史ID=${historyId?.substring(0, 6) || 'none'}`);
    
    // Validate input
    if (!keywords || !Array.isArray(keywords) || keywords.length < 5) {
      console.log(`[API] 輸入無效: ${!keywords ? '沒有關鍵詞' : !Array.isArray(keywords) ? '不是數組' : '關鍵詞太少'}`);
      return new Response(
        JSON.stringify({ 
          error: 'At least 5 keywords are required for clustering',
          received: keywords?.length || 0
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
    if (limitedKeywords.length < keywords.length) {
      console.log(`[API] 關鍵詞數量已限制: ${keywords.length} → ${limitedKeywords.length}`);
    }
    
    console.log(`[API] 前幾個關鍵詞: "${limitedKeywords.slice(0, 3).join('", "')}", ...`);
    
    // 使用更明確的提示
    const prompt = `你是一個專業的關鍵詞分群專家。請根據以下關鍵詞進行語意分群，將相關的關鍵詞歸類到合適的主題中。

語意辨識的方法是根據能否放到同一篇文章作為列表文章(listicle)的依據，不是以 SEO 為主。避免使用"基本知識"這種過於概括的詞分群。

關鍵詞列表：
${limitedKeywords.join(', ')}

請將關鍵詞分群並返回一個 JSON 對象，格式如下：
{
  "clusters": {
    "主題名稱1": ["關鍵詞1", "關鍵詞2", ...],
    "主題名稱2": ["關鍵詞3", "關鍵詞4", ...]
  }
}

注意事項：
1. 每個主題名稱應該簡潔明確
2. 每個分群至少包含 2 個關鍵詞
3. 確保返回的是有效的 JSON 格式
4. 不要添加任何額外的說明文字，只返回 JSON 對象`;

    // 驗證模型名稱是否有效
    const validModels = ['gpt-4o', 'gpt-4o-mini'];
    const actualModel = validModels.includes(model) ? model : 'gpt-4o-mini';

    if (actualModel !== model) {
      console.log(`[API] 模型 '${model}' 無效，使用默認模型: ${actualModel}`);
    } else {
      console.log(`[API] 使用模型: ${actualModel}`);
    }
    
    console.log(`[API] 正在發送請求到 OpenAI，關鍵詞數量: ${limitedKeywords.length}`);
    
    // 使用 generateText 获取完整结果
    const { text } = await generateText({
      model: openai(actualModel),
      messages: [
        { role: "system", content: prompt }
      ]
    });
    
    console.log(`[API] 收到完整結果:`, text);
    
    try {
      // 尝试解析 JSON
      const result = JSON.parse(text);
      console.log(`[API] 解析後的結果:`, JSON.stringify(result, null, 2));
      
      // 验证结果格式
      const validatedResult = clusterSchema.parse(result);
      
      // 返回验证后的结果
      return new Response(
        JSON.stringify(validatedResult),
        { 
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache'
          } 
        }
      );
    } catch (parseError) {
      console.error('[API] JSON 解析錯誤:', parseError);
      throw new Error('無法解析 OpenAI 返回的 JSON 格式');
    }
  } catch (error) {
    console.error('[API] 語意分群API錯誤:', error);
    
    // Return error response
    return new Response(
      JSON.stringify({ 
        error: 'Error processing semantic clustering request', 
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}