"use server";

import { generateText } from "ai"; // Vercel AI SDK - Core
import { AI_MODELS } from "../global-config";

// Check for OpenAI API Key
if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "OPENAI_API_KEY environment variable is not set. AI calls will likely fail."
  );
}

interface GenerateContentSuggestionsParams {
  keyword: string;
}

/**
 * Generates structured content suggestions based on a keyword using an AI model
 * via Vercel AI SDK and returns them as a formatted string.
 */
export async function generateContentSuggestionsAction(
  params: GenerateContentSuggestionsParams
): Promise<string> {
  const { keyword } = params;

  if (!keyword) {
    throw new Error("Keyword is required.");
  }

  // --- Construct the AI Prompt (New Version) ---
  const prompt = `
あなたは経験豊富なコンテンツ戦略家です。
**最重要任務：** 與えられたキーワード「${keyword}」を分析し、**以下のリストから最も適したコンテンツタイプを1つだけ選択してください**。
*   比較記事 (Comparison Article)
*   リスト記事 (Listicle)
*   ハウツーガイド (How-to Guide)
*   事例紹介 (Case Study)
*   体験談 (Personal Experience Story)
*   レビュー記事 (Review Article)
*   解説記事 (Explanatory Article)

**選択したコンテンツタイプに基づいて**、そのタイプのコンテンツを作成する上で、読者のエンゲージメントを最大化するための、具体的で実行可能なライティング戦略**のみ**を提案してください。

**警告：提案内容は、選択したコンテンツタイプの作成方法に**完全に焦点を当てなければなりません**。キーワード「${keyword}」自体について言及したり、キーワードに関するアドバイスを提供したり**しないでください**。

--- 参考情報（アドバイスの質の参考であり、構造や内容を模倣するものではありません） ---
[ここに以前の「期待されるアドバイスの例」セクションの内容をそのまま挿入。ただし、説明文は上記のように変更]
--- 例1：比較記事 ---
*   比較記事を作成する場合、読者が比較対象（A、B）について予備知識を持っていると仮定しないでください。
*   まず、AとBがそれぞれ何であり、どのような特徴を持っているかを明確に説明します。
*   その上で、両者の違いを解説します。
*   読者は初心者であると想定して書くことで、より高い評価を得られます。

--- 例2：専門知識や経験が必要なテーマ ---
*   難易度の高いテーマ（例：受験、ダイエット）では、実体験に基づいた記事が検索上位表示されやすい傾向があります。
*   なぜ自分がその経験について語れるのか、具体的な理由を述べましょう。
*   いつ、どこでその経験をしたのかを明確にします。
*   時系列に沿って構成し、エピソードを交えながら語るように書くと効果的です。
*   結論に自身の感想を加えることも有効です。

--- 例3：多くの種類を紹介する記事 ---
*   複数の種類（例：〇〇の種類）を紹介する場合、記事内で各種（A、B、C...）を個別に解説します。これにより、記事タイトルだけでなく、紹介した各キーワードでの検索順位上昇も期待できます。
*   さらに、各種について掘り下げた個別のページを作成し、記事内からリンクを設定します。
*   これにより、元の記事とリンク先の両方のページの検索順位が向上しやすくなります。

--- 例4：成功事例・失敗事例の活用 ---
*   他者の成功事例は読者の興味を引きやすいテーマです。単に方法を説明するのではなく、成功・失敗事例を用いて紹介することで、記事が読みやすくなります。
*   **成功事例の場合：**
    1.  成功事例があることを伝える。
    2.  具体的な事例を紹介する。
    3.  成功した理由を分析する。
    4.  事例から学べる成功法則をまとめる。
    5.  他の成功事例を紹介するページへの内部リンクを貼る。
*   **失敗事例の場合：**
    1.  失敗事例があることを伝える。
    2.  具体的な事例を紹介する。
    3.  失敗した理由を分析する。
    4.  事例から学べる「失敗しないための法則」をまとめる。
    5.  他の失敗事例を紹介するページへの内部リンクを貼る。
---

**厳格な指示に従って応答してください：**

**出力形式：**
*   応答は、**必ず**以下のマークダウン形式に従ってください。
*   タイトル行にはキーワード「${keyword}」を**含めないでください**。
*   リスト項目には、**選択したコンテンツタイプを作成するための具体的な戦略のみ**を記述してください。キーワード「${keyword}」に**言及しないでください**。

\`\`\`
# xx 類型活用
1. [針對選擇的內容類型，1-2句簡潔建議1 - **關鍵字提及禁止**]
2. [針對選擇的內容類型，1-2句簡潔建議2 - **關鍵字提及禁止**]
3. [針對選擇的內容類型，1-2句簡潔建議3 - **關鍵字提及禁止**]
(如有需要，可增加第4、第5點建議。嚴格遵守總共3-5點建議)
\`\`\`

遵循示範的回覆特色：
以特點開頭，例如：成功的，失敗的，難易度高的，複數的。
接續動詞，例如，活用，介紹，分析，設定，描述，評價，說明。

**その他の指示：**
*   **フォーマット：** JSON形式ではなく、上記のマークダウンテキスト形式で直接出力してください。

給你反指標，不要回答類似以下這種籠統的建議
1.  選擇清晰的結構，將資訊組織成易於理解的章節，方便讀者快速瀏覽。
2.  使用引人入勝的標題和副標題，吸引讀者點擊並保持閱讀興趣。
3.  運用視覺元素，例如圖片、圖表或影片，豐富內容並提升讀者的參與度。
4.  在文章中穿插真實案例或故事，使內容更具體、更貼近生活，增加讀者的共鳴。

用字遣詞要精準，回答如同示範一樣，不要因為中文就很冗長，以下是反指標，不要回答這種籠統的建議：
1.  先明確定義案例的背景與目標，讓讀者快速了解案例的起點與期望達成的結果。
2.  詳細描述案例的執行過程，包括採用的方法、遇到的挑戰以及解決方案，使讀者能深入理解。
3.  量化案例的成果，使用具體的數據和指標來展示成功，讓讀者信服案例的價值。
4.  分析案例成功的關鍵因素，並提煉出可供借鑒的經驗，幫助讀者將知識應用到實際中。
5.  提供案例的相關資源或延伸閱讀，鼓勵讀者進一步探索，增加文章的深度與價值。

`;

  console.log(
    `Generating content suggestions for keyword: ${keyword} (Using new prompt)`
  );

  try {
    // --- Actual AI Call ---
    const { text } = await generateText({
      model: AI_MODELS.BASE,
      prompt: prompt,
    });
    console.log("Raw AI Response Text (Expected List):", text);

    // --- Removed JSON Parsing and Formatting ---
    // No need to parse JSON anymore.
    // The raw text is assumed to be the desired formatted list.

    return text; // RETURN THE RAW TEXT FROM AI
  } catch (error) {
    console.error("Error generating content suggestions:", error);
    const errorMessage =
      error instanceof Error
        ? error.message
        : "An unknown error occurred during AI suggestion generation.";
    throw new Error(
      `Failed to generate content suggestions for "${keyword}". Reason: ${errorMessage}`
    );
  }
}
