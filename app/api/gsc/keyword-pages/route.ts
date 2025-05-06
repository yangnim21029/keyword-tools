import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis"; // 假設你會使用 googleapis

// 模擬 GSC API 的函式 (你需要替換成實際的 API 呼叫)
async function fetchPagesForKeyword(keyword: string): Promise<string[]> {
  // 這裡你需要實作實際的 Google Search Console API 呼叫
  // 1. 初始化 OAuth2 client
  // 2. 設定 credentials (access token, refresh token)
  // 3. 建立 searchconsole instance
  // 4. 呼叫 searchanalytics.query API
  //    - startDate, endDate (例如過去 90 天)
  //    - dimensions: ['page']
  //    - dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: keyword }] }]
  //    - siteUrl
  // 5. 處理回應，從 rows 中提取 page URL (row.keys[0])
  // 6. 處理錯誤 (例如 token 過期，需要 refresh)

  console.log(`Simulating GSC API call for keyword: "${keyword}"`);

  // --- Placeholder ---
  // 這是一個模擬的回應，你需要用實際的 GSC API 呼叫取代
  if (keyword === "ai chatbot") {
    return ["/blog/ai-chatbot-introduction", "/features/chatbot", "/pricing"];
  } else if (keyword === "nextjs hosting") {
    return ["/blog/deploy-nextjs", "/docs/hosting"];
  } else {
    return []; // 找不到結果
  }
  // --- End Placeholder ---
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = searchParams.get("keyword");

  if (!keyword || typeof keyword !== "string") {
    return NextResponse.json(
      { error: 'Missing or invalid "keyword" parameter' },
      { status: 400 },
    );
  }

  try {
    const pages = await fetchPagesForKeyword(keyword);

    return NextResponse.json({
      query: keyword,
      pages: pages,
    });
  } catch (error) {
    console.error("Error fetching GSC data:", error);
    // 在實際應用中，你可能需要更細緻地處理錯誤
    // 例如，如果錯誤是關於 token 過期，嘗試刷新 token
    return NextResponse.json(
      { error: "Failed to fetch data from Google Search Console." },
      { status: 500 },
    );
  }
}
