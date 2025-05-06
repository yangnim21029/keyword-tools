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
あなたは経験豊富なコンテンツエディターです。キーワード「${keyword}」に基づいて、読者のエンゲージメントを高める高品質なコンテンツを作成するための、具体的で実行可能なライティング戦略と構成案を提案してください。

以下に示す「期待されるアドバイスの例」は、質の高いアドバイスがどのようなものか（例えば、比較形式、経験談形式など）を示すための**参考**です。これらの例の**全ての種類や構造を回答に含める必要はありません**。

期待されるアドバイスの例：

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

上記の「期待されるアドバイスの例」を**参考に**、キーワード「${keyword}」について、読者のエンゲージメントを高める高品質なコンテンツを作成するための、最も効果的と思われる**核心的なアドバイス**を生成してください。

**嚴格遵守以下回覆格式：**
あなたの回答は、**必ず**以下の形式に従ってください。これ以外のテキストは含めないでください。

\`\`\`
# 關於「${keyword}」的內容寫作建議
1. [以動詞開頭的1-2句簡潔建議1]
2. [以動詞開頭的1-2句簡潔建議2]
3. [以動詞開頭的1-2句簡潔建議3]
(如有需要，可增加第4、第5點建議。嚴格遵守總共3-5點建議)
\`\`\`

**具體指示：**
*   **建議數量：** 請以條列方式，生成**嚴格3至5點**建議。
*   **建議格式：** 每點建議都必須**以動詞開頭的祈使句**撰寫，且為**1至2句的極簡短句子**。
*   **排除細節：** **請勿包含**子項目或詳細說明。
*   **獨創性：** 請勿直接模仿所提供範例的結構，而是針對關鍵字提供最優化、最重要且簡潔的建議。
*   **語言：** **務必使用繁體中文**作答。
*   **輸出格式：** 請勿使用JSON格式，而是直接以上述文字格式輸出列表。
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
