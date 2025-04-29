'use server';

import { generateText } from 'ai';
import { AI_MODELS } from '../global-config';

type ParagraphResponse = {
  success: boolean;
  result: string;
  error?: string;
};

type AnalysisResult = {
  graph: string;
  gaps: string;
};

export async function analyzeParagraphs(
  aSections: string[],
  bSection: string
): Promise<ParagraphResponse> {
  try {
    // Create a single prompt with all reference sections
    const prompt = `你將扮演 graph knowledge api，功能是將作者的寫作法，變成一個 graph knowledge 並可視化，並對比所有參考段落和目標段落進行詳細的比較分析。以下是段落，不使用 python，不使用 mermaid 格式，直接寫出圖表出來，注意每一句的字詞距離。請確保完整輸出所有部分，不要截斷任何內容。

參考段落（請視為沒有換行的段落）：
${aSections.map((section, index) => `\n參考段落 ${index + 1}:\n${section}`).join('\n')}

目標段落（請視為沒有換行的段落）：
${bSection}


請嚴格按照以下 H2 標題結構組織你的回覆：

## 參考段落 Graph Knowledge Visualization
${aSections.map((_, index) => `\n### 參考段落 ${index + 1} 的 Graph 結構
[在這裡寫出參考段落 ${index + 1} 的 graph 結構]`).join('\n')}

## 目標段落 Graph Knowledge Visualization
[在這裡寫出目標段落的 graph 結構]

## 比較分析
### 1. 群組結構比較
${aSections.map((_, index) => `\n#### 與參考段落 ${index + 1} 的群組比較
- 列出參考段落 ${index + 1} 的主要群組（用 () 標記的部分）
- 列出目標段落的主要群組
- 比較兩者的群組結構差異`).join('\n')}

### 2. 內容完整性分析
${aSections.map((_, index) => `\n#### 與參考段落 ${index + 1} 的內容比較
- 列出參考段落 ${index + 1} 中有但目標段落缺少的群組
- 列出參考段落 ${index + 1} 中有但目標段落缺少的細節（用【】標記的部分）
- 列出目標段落中過於詳細的部分`).join('\n')}

## 綜合建議
### 1. 群組優化建議
- 列出目標段落中可以合併的群組
- 列出目標段落中可以省略的群組
- 說明每個建議的原因

### 2. 結構優化建議
- 列出所有參考段落中結構良好的群組
- 說明這些群組如何幫助讀者理解
- 指出目標段落中缺少的類似結構

## 理想的目標段落 Graph 結構
[在這裡寫出基於所有參考段落分析後的理想目標段落 graph 結構]

---

\n\n 示範：
[葉海洋]──(身份)──>【中國網紅企業家】  
     └──(過去事件)──>【買上等精子、自己生混血寶寶】  
     └──(2024事件)──>【誕下雙胞胎男嬰】  
                              └──(結果)──>【組成五口之家】  
     └──(情感關係)──>【前女友】──(行為)──>【爆料】  
                              └──(影響)──>【形象翻車風波】  
     └──(目前反應)──>【尚未正面回應】  
     └──(引發)──>【社群熱議】  
                    └──(話題1)──>【家庭】  
                    └──(話題2)──>【國籍】  
                    └──(話題3)──>【情感】  
                    └──(話題4)──>【人設】`;

    // Single call to generateText
    const { text } = await generateText({
      model: AI_MODELS.BASE, // Consider using a more powerful model if needed
      prompt: prompt,
      maxTokens: 30000 // Keep maxTokens high for potentially long analysis
    });

    // Return the full text, assuming the AI follows the requested H2 structure
    return { success: true, result: text || '' };

  } catch (error) {
    console.error('Error in paragraph analysis:', error);
    return { 
      success: false, 
      result: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

export async function rephraseParagraph(
  step1Result: string,
  aSections: string[], // Keep for potential future use
  bSection: string
): Promise<ParagraphResponse> {
  try {
    // --- 1. Extract necessary sections from the analysis result --- 
    const idealGraphHeading = '## 理想的目標段落 Graph 結構';
    const comparisonHeading = '## 比較分析';
    const summaryHeading = '## 綜合建議';
    const finalResultHeading = '## 4. 最終修改後的段落'; // Added for extraction

    const idealGraphStartIndex = step1Result.indexOf(idealGraphHeading);
    const comparisonStartIndex = step1Result.indexOf(comparisonHeading);
    const summaryStartIndex = step1Result.indexOf(summaryHeading);

    if (idealGraphStartIndex === -1 || comparisonStartIndex === -1 || summaryStartIndex === -1) {
      const missing = [];
      if (idealGraphStartIndex === -1) missing.push('理想結構');
      if (comparisonStartIndex === -1) missing.push('比較分析');
      if (summaryStartIndex === -1) missing.push('綜合建議');
      const errorMsg = `${missing.join('、')}部分未在分析結果中找到，無法進行重寫。`;
      console.error(errorMsg, 'step1Result:', step1Result); // Log the problematic result
      return { success: false, result: '', error: errorMsg };
    }

    // Extract Comparison section
    let comparisonEndIndex = step1Result.indexOf('\n## ', comparisonStartIndex + comparisonHeading.length);
    if (comparisonEndIndex === -1) comparisonEndIndex = step1Result.length;
    const comparisonAnalysis = step1Result.substring(comparisonStartIndex + comparisonHeading.length, comparisonEndIndex).trim();

    // Extract Summary section
    let summaryEndIndex = step1Result.indexOf('\n## ', summaryStartIndex + summaryHeading.length);
    if (summaryEndIndex === -1) summaryEndIndex = step1Result.length;
    const summaryAdvice = step1Result.substring(summaryStartIndex + summaryHeading.length, summaryEndIndex).trim();

    // Extract Ideal Graph Structure section
    let idealGraphEndIndex = step1Result.indexOf('\n## ', idealGraphStartIndex + idealGraphHeading.length);
    if (idealGraphEndIndex === -1) idealGraphEndIndex = step1Result.length;
    const idealGraphStructure = step1Result.substring(idealGraphStartIndex + idealGraphHeading.length, idealGraphEndIndex).trim();

    if (!idealGraphStructure || !comparisonAnalysis || !summaryAdvice) {
        const empty = [];
        if (!idealGraphStructure) empty.push('理想結構');
        if (!comparisonAnalysis) empty.push('比較分析');
        if (!summaryAdvice) empty.push('綜合建議');
        const errorMsg = `${empty.join('、')}部分為空，無法進行重寫。`;
        console.error(errorMsg, 'step1Result:', step1Result); // Log the problematic result
        return { success: false, result: '', error: errorMsg };
    }

    // --- 2. Construct the new prompt for thinking and execution --- 
    const prompt = `你是一位專業的文字編輯，擅長在保留原文語氣的基礎上，根據分析建議和目標結構來優化文字。

以下是需要優化的【原始段落】：
${bSection}

以下是針對【原始段落】與參考段落的【比較分析】和【綜合建議】：
${comparisonAnalysis}

${summaryAdvice}

以下是【理想的目標段落 Graph 結構】：
${idealGraphStructure}

請嚴格按照以下步驟和 H2/H3 標題結構進行思考和操作：

## 1. 結構對比

### 1.1 原始段落的知識圖譜結構（推斷）
[在這裡根據【原始段落】推斷出其知識圖譜結構]

### 1.2 理想的知識圖譜結構（給定）
${idealGraphStructure}

## 2. 修改計劃

### 2.1 主要差異點
[根據【比較分析】、【綜合建議】以及步驟 1 的結構對比，列出【原始段落】最需要修改的關鍵差異點]

### 2.2 句子級別修改方案
[針對每個差異點，明確指出【原始段落】中的哪些句子或部分需要修改，以及具體如何修改（擴充/精簡/調整順序），並說明理由。]
範例：
- 句子 "X"：需要擴充，以包含理想結構中的 Y 信息點。
- 句子 "Z"：過於冗餘，可以精簡為...
- 段落部分 "A-B"：信息順序需要調整為 B-A，以符合理想結構...

## 3. 執行修改（保留原始語氣）
[根據步驟 2 的計劃，修改【原始段落】，確保保留原始語氣，並包含理想結構中的所有關鍵信息點。
**特別注意**：在填充理想結構中用【】標記的具體內容時，**不要過度精簡或抽象化**，應盡可能保留或適當補充細節，使其具有足夠的深度，同時與原始語氣保持一致。]

## 4. 最終修改後的段落
[在這裡只輸出最終修改後的完整段落文字。
**輸出要求**：
- **不要**包含任何 markdown 加粗符號（例如 **）。
- 在適當的地方加入換行，使段落易於閱讀。
- **不要**包含此標題（## 4. 最終修改後的段落）或任何其他說明文字。]

`; // Ensure the prompt ends here

    // --- 3. Call the AI --- 
    const { text } = await generateText({
      model: AI_MODELS.BASE, // Consider ADVANCED if BASE struggles with the complexity
      prompt: prompt,
      maxTokens: 30000 // Increased maxTokens
    });

    // --- 4. Extract the final result --- 
    // Find the heading for Step 3
    const step3Heading = '## 3. 執行修改（保留原始語氣）';
    const step3HeadingIndex = text.indexOf(step3Heading);

    let finalResultText = '';

    if (step3HeadingIndex !== -1) {
      // Find the start of the actual text after the heading and potential newlines
      const textAfterStep3Heading = text.substring(step3HeadingIndex + step3Heading.length);
      // Use a regex to find the first non-whitespace character after the heading
      const match = textAfterStep3Heading.match(/\S/);
      if (match && match.index !== undefined) {
          finalResultText = textAfterStep3Heading.substring(match.index).trim();
      } else {
          // If only whitespace follows the heading, treat as empty
          finalResultText = ''; 
      }
      // Clean up potentially included ## 4. heading if AI includes it unexpectedly
      finalResultText = finalResultText.replace(/^## 4\. 最終修改後的段落\s*/, '').trim();
      finalResultText = finalResultText.replace(/^\s*\n+|\n+\s*$/g, ''); 
    } else {
      // Fallback: try finding the original H4 heading just in case AI adds it sometimes
      const finalResultHeading = '## 4. 最終修改後的段落';
      const finalResultStartIndex = text.indexOf(finalResultHeading);
      if (finalResultStartIndex !== -1) {
         finalResultText = text.substring(finalResultStartIndex + finalResultHeading.length).trim();
         finalResultText = finalResultText.replace(/^\s*\n+|\n+\s*$/g, ''); 
      } else {
         console.error('Could not find Step 3 heading or final result heading in AI response:', text);
         return { 
           success: false, 
           result: '',
           error: 'AI 未能按預期格式輸出最終結果，無法提取。'
         };
      }
    }

    if (!finalResultText) {
       console.error('Final result section appears empty after extraction:', text);
       return { 
        success: false, 
        result: '',
        error: 'AI 輸出的最終結果提取後為空。'
      };
    }

    return { success: true, result: finalResultText };
  } catch (error) {
    console.error('Error in paragraph rephrase:', error);
    return { 
      success: false, 
      result: '',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
} 