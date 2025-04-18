import { openai } from '@ai-sdk/openai';
import { fetchSerpByKeyword } from '../services/serp.service';
import { getContentTypeAnalysisPrompt, getUserIntentAnalysisPrompt } from '../prompt/serp-prompt-design';
import { generateText } from 'ai';
import { z } from 'zod';
import { MEDIASITE_DATA } from '../config/constants';
// Import fine-tune data
import { THEME_FINE_TUNE_DATA, MEDIA_SITE_FINE_TUNE_DATA, LANGUAGE_FINE_TUNE_DATA } from '../prompt/fine-tune';

  
const contentAngleReference = ''; // Corresponds to I4


// Define the prompt template as a constant string with proper formatting
async function getActionPlanPrompt(keyword: string, mediaSiteDataString: string, serp: string,serpTitleReport: string, serpContentReport: string, serpSearchIntentReport: string) {
    return `
don't search web, don't use canvas
, \n You are an SEO Project Manager with knowledge in consumer behavior theory, traditional marketing theory, and digital marketing theory. You will execute the following tasks:

1. **Keyword Theme Identification**: Identify the theme and subthemes of a user-provided keyword.
2. **Content Type Suggestion**: If a URL is provided by the user, use it solely for reference. Otherwise, search for related articles to determine the content type suggested by the keyword, described precisely in three English words using the ""A + B"" format.
3. **Action Plan Creation**: Craft a specific action plan for each subtheme, ensuring the content is bilingual (Chinese and English) with smooth language transition, using the provided example structure.

# Steps

1. **Identify Theme and Subthemes**:
    - Analyze the keyword to discern the main theme and potential subthemes.
2. **Determine Content Type**:
    - Rely on the provided URL if available, or conduct a search to propose content types.
3. **Create Action Plan**:
    - Formulate a detailed, bilingual action plan per subtheme.
    - Follow the provided sentence structure examples for coherence.

# Output Format

- Deliver a structured response with these sections:
    - **Keyword Theme and Subthemes**: Concise explanation of the themes and subthemes.
    - **Content Type Suggestion**: Suggestions in ""A + B"" format.
    - **Action Plan**:
        - Three variations tailored to different user interests:
            - **Subtheme**: Ethical production
            - **ActionPlan:**
Create in-depth recipes for each soup, highlighting traditional preparation methods.
為每種湯品創建深入的食譜，突顯傳統的製作方法。
    
    Develop content around the health benefits of key ingredients (e.g., 淮山, 茨實, 花膠).
    圍繞主要成分的健康益處開發內容（例如，淮山、茨實、花膠）。
    
    Produce video tutorials for complex recipes like 淮山茨實鱷魚肉湯, showcasing proper techniques.
    製作複雜食譜的視頻教程，如淮山茨實鱷魚肉湯，展示正確的技術。
    
    Write articles on the cultural significance of these soups in Hong Kong cuisine.
    撰寫有關這些湯品在香港料理中文化意義的文章。
            - **Version 2**: Version 2 of the action plan.
            - **Version 3**: Version 3 of the action plan.

# **Versions**

給我包含以下多個版本，針對不同網站的用戶想知道的訊息，進行 action plan 的調整，每一個都要不一樣。

Version 1:
${mediaSiteDataString}

"# Notes

- Ensure all outputs are detailed and aligned with user expectations.
- People won't consider location to choose anything if they are not in travel context.
- If Website won't mention the keyword, add notice to that version
- we don't produce video and image

---

- Keyword: ${keyword}
- Keyword Research Report: ${serpTitleReport} ${serpContentReport} ${serpSearchIntentReport}
- SERP (title / metadescription): ${serp}

---

write h2 Keyword Theme and Subthemes for ${keyword}
h3 Main Theme: xxx
h3 Subthemes
h3 Content Type Suggestion 
h4 top3
h2 SEO
h3 user intent
h3 keyword mapping suggestion
h2 Action Plan
h3 [version] {website full title}
h4 Subtheme:
h4 Suggest Title:
h4 Tricks to match top3 content type(..):
h4 List
`;
}


async function generateActionPlan(keyword: string, serpTitleReport: string, serpContentReport: string, serpSearchIntentReport: string, serp: string, mediaSiteDataString: string) {
    const prompt = await getActionPlanPrompt(keyword, mediaSiteDataString, serp, serpTitleReport, serpContentReport, serpSearchIntentReport);
    const { text: actionPlanText } = await generateText({
        model: openai('gpt-4.1-mini'),
        prompt: prompt,
    });
    console.log('[Research Action - Step 2] Generated Action Plan.');
    return actionPlanText;
}

// Helper function to get fine-tune data as string
function getFineTuneDataStrings(names?: string[]): string {
    if (!names || names.length === 0) {
        return "";
    }

    const allData = [
        ...THEME_FINE_TUNE_DATA,
        ...MEDIA_SITE_FINE_TUNE_DATA,
        ...LANGUAGE_FINE_TUNE_DATA
    ];

    const filteredData = allData.filter(item => names.includes(item.name));

    if (filteredData.length === 0) {
        return "";
    }

    return `\n\n--- Fine-Tune Data ---\n${JSON.stringify(filteredData, null, 2)}`;
}


export function getResearchPrompt(keyword: string, actionPlan: string, mediaSiteDataString: string, serp: string, contentTypeReportText: string, userIntentReportText: string) {
    // Base prompt string
    const basePrompt = `
forget all previous instructions, do not repeat yourself, do not self reference, do not explain what you are doing, do not write any code, do not analyze this, do not explain.

**🔑 重點項目（須提供）：**

- 🎯 文章類型需求與規則：${actionPlan}
- **目標關鍵字**（必填）：${keyword}
- **寫作風格**：${mediaSiteDataString}
- **內容類型分析**：${contentTypeReportText}

--------
1. **搜尋意圖分析：**
- 請依據目標關鍵字判定主要搜尋意圖，並確保文章符合此搜尋意圖。
- 自動分析 Google SERP 頁面，確保文章內容完整符合使用者需求。
${userIntentReportText}
2. **競爭對手內容分析：**
${serp}
- 在本文中包含競爭者提及，但缺乏的議題、獨特觀點或深入資訊，確保產出內容更具價值與競爭力。
3. **SEO 內容撰寫指南**
- 撰寫前請確認閱讀 Google Helpful Content Guideline
<Google Helpful Content Guideline>
### 自我評估內容 
根據這些問題評估自己的內容，可以協助您評估自己製作的內容是否實用且可靠。除了向自己提出上述問題外，您也可以考慮請您信任、但與網站沒有關聯的人對網頁進行誠實的評估。
另外，您也可考慮對搜尋成效下滑情形進行稽核，例如找出哪些網頁受到的影響最大，或是哪類搜尋查詢對網頁的成效影響最大。請仔細分析這些資訊，以便與此處部分問題的評估結果互相比較。
內容及品質相關問題
內容是否提供原創的資訊、報表、研究或分析資料？
內容是否針對主題提供充實、完整或詳盡的說明？
內容是否提供深入分析見解，或是值得注意的資訊？
如果內容借鑒了其他來源，是否力圖避免單純複製或是改寫來源內容，而是設法提供具有原創性及大量附加價值的內容？
主要標題或網頁標題是否提供了敘述清晰的實用內容摘要？
主要標題或網頁標題是否力圖避免使用誇飾或聳動的敘述？
您會想要將這類網頁加入書籤、分享給朋友或推薦給他人嗎？
您覺得紙本雜誌、百科全書或書籍有沒有可能採用或引用這項內容？
比起搜尋結果中的其他頁面，這項內容是否提供了更高的價值？
內容中是否有任何錯字或是樣式問題？
內容製作品質是否良好？呈現出來的樣貌是否讓人覺得草率或是急就章？
內容是否為源自許多創作者的大量生產內容、外包給大量創作者，或者遍布於網路上的眾多網站，導致個別網頁或網站無法獲得足夠的關注？
#### 專業度相關問題
內容呈現資訊的方式是否讓人覺得信服？舉例來說，內容是否提供了清楚的資訊來源、具備專業知識的證據、作者或文章發布網站的背景資訊 (例如作者介紹頁面或網站簡介頁面的連結)？
在有人探索了製作這項內容的網站後，他們是否覺得就這個網站的主題而言，網站提供的資訊十分值得信賴，或是廣受相關權威人士的認可？
這項內容是否由專業人士或明顯瞭解這個主題的專家或愛好者撰寫或審查？
內容中是否有任何顯而易見的錯誤資訊？
提供良好的網頁體驗
Google 的核心排名系統旨在獎勵提供良好網頁體驗的內容。網站擁有者如果希望透過此系統取得優秀排名，則不該只注重網頁體驗的一兩個層面，相對的，應該確認自己是否在各方面都提供了整體上良好的網頁體驗。如需更多建議，請參閱「瞭解 Google 搜尋結果中的網頁體驗」一文。
#### 專注於使用者優先的內容
使用者優先的內容是指專為大眾製作，而非以操控搜尋引擎排名為目標的內容。如何評估您製作的內容是否屬於使用者優先內容？如果您針對下列問題回答「是」，表示您可能正採用使用者優先的方法：
您的業務或網站是否有既有或預期的目標對象，且這些目標對象如果直接閱讀您的內容，會覺得內容很實用？
您的內容是否清楚呈現第一手專業知識及具有深度的知識 (例如因實際使用產品/服務或造訪某個地點所獲得的專業知識)？
您的網站是否有主要目的或重點？
使用者在閱讀完您的內容後，是否覺得他們對某個主題有足夠的瞭解，可協助他們達成目標？
使用者在閱讀完您的內容後，是否覺得滿意？
避免建立以搜尋引擎為優先的內容
我們建議您將重點放在製作以使用者為優先的內容，藉此在 Google 搜尋中取得理想排名，而非製作以搜尋引擎優先的內容，試圖提高搜尋引擎中的排名。 如果您針對部分或所有問題回答「是」，表示這是一種警告跡象，意味著您應該重新評估自己建立內容的方式：
#### 內容是否主要是為了吸引來自搜尋引擎的造訪？
您是否針對不同主題建立大量內容，希望部分內容在搜尋結果中獲得良好成效？
您是否大規模運用自動化功能，針對許多主題建立內容？
您主要是匯總其他人說話的內容，但其實並沒有帶來太多的價值？
您之所以撰寫內容，只是因為這些內容似乎很熱門，而非為您既有的目標對象而撰寫？
您的內容是否會讓讀者覺得他們需要再次搜尋，才能從其他來源取得更完善的資訊？
您是否因為聽說或讀到 Google 對於撰寫的內容有偏好的字數，所以您才撰寫一定字數的內容？(不，我們沒有這種偏好)。
您是否在沒有真正專業知識的情況下，決定進入某個小眾主題領域，但其實主要是因為您認為自己會獲得搜尋流量？
您的內容是否承諾可以回答實際上沒有答案的問題，例如在日期未經確認的情況下，表示知道產品、電影或電視節目的推出日期？
您是否變更網頁日期，想營造看起來很新的假象，但其實內容並沒有什麼更新？
您之所以會加入大量新內容，或是移除大量較舊的內容，是因為您認為這樣會讓網站看起來「更新鮮」而提升網站整體搜尋排名嗎？(這麼做其實沒有效果)
</Google Helpful Content Guideline>

4. **SEO 回覆格式要求：**
- 請直接輸出完整SEO文章（無須提供大綱或分析過程）。
- 文章長度需介於1,500至3,000字間，並具高度相關性。
- 使用繁體中文，適合香港、台灣讀者，不使用地區專屬詞彙。
- 使用適當的H1、H2、H3結構，提升搜尋引擎友好度。
- 無需提供大綱或分析過程，直接輸出完整文章。
- 不需要內部連結
- 將參考資料/url連結置於文章最下方，不算在字數內
1. **排版與可讀性：**
- 使用清晰易讀的短段落（50-100字內）。
- 必要時以列表（Bullet Points）、數據、案例研究輔助提高可讀性。
1. **常見問題 (FAQs)：**
- 提供1至3個與主要關鍵字及搜尋意圖高度相關的常見問題，每項50字內，可以帶內部或是外部連結。有助讀者快速理解核心內容，並提高SEO表現。
1. 輸出格式：僅輸出文章內容，SEO 分析的過程不要放入文章中
1. 文章長段落內文，根據語意自動換行分段
1. 文章中不需要放入連結及來源參考資料等欄位
`;
    return basePrompt; // Fine-tune data will be appended in generateReaseachPrompt step 4
}

// Update function signature to accept optional region, language, and fineTuneNames
export async function generateReaseachPrompt(
    keyword: string,
    mediaSiteName: string,
    step: number = 1,
    intermediateData: any = null,
    fineTuneNames?: string[] // Optional array of fine-tune dataset names
): Promise<string | object> {

    let mediaSite: any;
    let region: string | undefined;
    let language: string | undefined;
    let mediaSiteDataString: string;
    let serpString: string;
    let contentTypeReportText: string;
    let userIntentReportText: string;
    let actionPlanText: string;
    let researchPromptBase: string; // To store the base prompt from step 3

    console.log(`[Research Action] Entering Step ${step} for keyword: ${keyword}, site: ${mediaSiteName}`);

    // --- Step 1: Fetch Site Data, SERP, and Initial Analysis ---
    if (step === 1) {
        mediaSite = MEDIASITE_DATA.find(site => site.name === mediaSiteName);
        if (!mediaSite) {
            console.error(`[Research Action - Step 1] Media site not found for name: ${mediaSiteName}`);
            throw new Error(`Media site not found for name: ${mediaSiteName}`);
        }
        region = mediaSite.region;
        language = mediaSite.language;
        mediaSiteDataString = JSON.stringify(mediaSite);

        console.log(`[Research Action - Step 1] Found site data. Region: ${region}, Language: ${language}`);

        const serp = await fetchSerpByKeyword(keyword, region, language);
        console.log('[Research Action - Step 1] Fetched SERP data.');

        if (!serp.organicResults) {
            console.error('[Research Action - Step 1] No organic results found for keyword:', keyword);
            throw new Error('No organic results found');
        }
        serpString = serp.organicResults.slice(0, 10).map(result => `${result.title} - ${result.description}`).join('\n');
        console.log(`[Research Action - Step 1] Processed SERP String.`);

        console.log(`[Research Action - Step 1] ==== Start AI Analysis ====`);
        const contentTypeReportPrompt = getContentTypeAnalysisPrompt(keyword, serpString);
        const contentTypeReport = await generateText({ model: openai('gpt-4.1-mini'), prompt: contentTypeReportPrompt });
        contentTypeReportText = contentTypeReport.text;
        console.log('[Research Action - Step 1] Generated Content Type Report.');

        const userIntentReportPrompt = getUserIntentAnalysisPrompt(keyword, serpString, '');
        const userIntentReport = await generateText({ model: openai('gpt-4.1-mini'), prompt: userIntentReportPrompt });
        userIntentReportText = userIntentReport.text;
        console.log('[Research Action - Step 1] Generated User Intent Report.');

        // Return intermediate data for the next step, including fineTuneNames
        return {
            keyword,
            mediaSiteName,
            mediaSiteDataString,
            serpString,
            contentTypeReportText,
            userIntentReportText,
            fineTuneNames // Pass fineTuneNames along
        };
    }

    // --- Step 2: Generate Action Plan ---
    if (step === 2) {
        if (!intermediateData) {
            throw new Error("[Research Action - Step 2] Intermediate data from Step 1 is required.");
        }
        // Extract data from the previous step
        mediaSiteDataString = intermediateData.mediaSiteDataString;
        serpString = intermediateData.serpString;
        contentTypeReportText = intermediateData.contentTypeReportText;
        userIntentReportText = intermediateData.userIntentReportText;
        // fineTuneNames is already in intermediateData, no need to extract separately unless used here

        // Generate Action Plan
        actionPlanText = await generateActionPlan(keyword, contentTypeReportText, userIntentReportText, '', serpString, mediaSiteDataString);

        // Return combined data for the next step
        return {
            ...intermediateData, // Pass all previous data, including fineTuneNames
            actionPlanText
        };
    }

    // --- Step 3: Generate Final Prompt String (includes fine-tuning) ---
    if (step === 3) {
        if (!intermediateData) {
            throw new Error("[Research Action - Step 3] Intermediate data from Step 2 is required.");
        }
        // Extract all necessary data
        mediaSiteDataString = intermediateData.mediaSiteDataString;
        serpString = intermediateData.serpString;
        contentTypeReportText = intermediateData.contentTypeReportText;
        userIntentReportText = intermediateData.userIntentReportText;
        actionPlanText = intermediateData.actionPlanText;
        const currentFineTuneNames = intermediateData.fineTuneNames; // Get names passed from step 1

        // Generate base prompt string
        researchPromptBase = getResearchPrompt(keyword, actionPlanText, mediaSiteDataString, serpString, contentTypeReportText, userIntentReportText);
        console.log('[Research Action - Step 3] Generated base Research Prompt.');

        // Get fine-tune data string
        const fineTuneDataString = getFineTuneDataStrings(currentFineTuneNames);

        // Append fine-tune data to the base prompt
        const finalPrompt: string = researchPromptBase + fineTuneDataString;

        console.log('[Research Action - Step 3] Appended fine-tune data. Final prompt generated.');
        return finalPrompt as string; // Return the final string directly from step 3
    }

    // Should not reach here if step is 1, 2, or 3
    throw new Error(`[Research Action] Invalid step number provided: ${step}. Valid steps are 1, 2, or 3.`);
}
