/**
 * Suggestion Service - 提供關鍵字建議的功能
 * 此服務僅負責從 Google 獲取建議數據，不處理快取邏輯
 */

// --- 數據獲取功能 ---

/**
 * 使用 Google Autocomplete API 獲取關鍵字建議
 */
export async function fetchAutocomplete(
  query: string,
  region: string = "TW",
  language: string = "zh-TW",
): Promise<string[]> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 50)); // 減少延遲
    console.log(
      `[Service: fetchAutocomplete] Query: ${query}, Region: ${region}, Language: ${language}`,
    );

    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(
      query,
    )}&gl=${region}&hl=${language}`;

    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
    });

    const data = await response.json();
    // Google autocomplete 返回 [query, suggestions, ?, ?, metadata] 格式
    // metadata 包含 relevance: data[4]['google:suggestrelevance']
    // console.log(`[Service: fetchAutocomplete] Raw Data:`, data); // 日誌記錄原始數據

    if (
      Array.isArray(data) &&
      data.length > 4 && // 確保包含 metadata
      Array.isArray(data[1]) && // 確保 suggestions 是數組
      data[4] && // 確保 metadata 存在
      typeof data[4] === "object" &&
      "google:suggestrelevance" in data[4] && // 確保 relevance 分數存在
      Array.isArray(data[4]["google:suggestrelevance"]) // 確保 relevance 是數組
    ) {
      const suggestions: string[] = data[1];
      const relevanceScores: number[] = data[4]["google:suggestrelevance"];

      // 確保建議和分數數量一致
      if (suggestions.length === relevanceScores.length) {
        const filteredSuggestions = suggestions.filter(
          (_, index) => relevanceScores[index] >= 600,
        );
        console.log(
          `[Service: fetchAutocomplete] Filtered Suggestions (>=600):`,
          filteredSuggestions,
        );
        return filteredSuggestions;
      } else {
        console.warn(
          "[Service: fetchAutocomplete] Suggestions and scores length mismatch.",
        );
        // 如果數量不符，可以選擇返回所有建議或空數組，這裡返回所有建議
        return suggestions;
      }
    } else if (
      Array.isArray(data) &&
      data.length > 1 &&
      Array.isArray(data[1])
    ) {
      // 如果沒有 relevance data，則返回所有建議 (舊的邏輯)
      console.warn(
        "[Service: fetchAutocomplete] Relevance data not found, returning all suggestions.",
      );
      return data[1];
    }

    console.log("[Service: fetchAutocomplete] No valid suggestions found.");
    return [];
  } catch (error) {
    console.error("獲取自動完成建議時出錯:", error);
    return []; // 錯誤時返回空數組
  }
}

/**
 * 使用 Google Autocomplete API 獲取關鍵字建議，使用較長的延遲
 * 適用於特定 UI 互動（例如點擊關鍵字卡片）
 */
export async function fetchSuggestionWithDelay(
  query: string,
  region: string = "TW",
  language: string = "zh-TW",
): Promise<string[]> {
  try {
    await new Promise((resolve) => setTimeout(resolve, 200)); // 較長的延遲
    console.log(
      `[Service: fetchSuggestionWithDelay] Query: ${query}, Region: ${region}, Language: ${language}`,
    );

    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(
      query,
    )}&gl=${region}&hl=${language}`;

    const response = await fetch(url, {
      cache: "no-store", // 通常延遲獲取不需要快取
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36",
      },
    });

    const data = await response.json();
    // console.log(`[Service: fetchSuggestionWithDelay] Raw Data:`, data); // 日誌記錄原始數據

    if (
      Array.isArray(data) &&
      data.length > 4 &&
      Array.isArray(data[1]) &&
      data[4] &&
      typeof data[4] === "object" &&
      "google:suggestrelevance" in data[4] &&
      Array.isArray(data[4]["google:suggestrelevance"])
    ) {
      const suggestions: string[] = data[1];
      const relevanceScores: number[] = data[4]["google:suggestrelevance"];

      if (suggestions.length === relevanceScores.length) {
        const filteredSuggestions = suggestions.filter(
          (_, index) => relevanceScores[index] >= 600,
        );
        console.log(
          `[Service: fetchSuggestionWithDelay] Filtered Suggestions (>=600):`,
          filteredSuggestions,
        );
        return filteredSuggestions;
      } else {
        console.warn(
          "[Service: fetchSuggestionWithDelay] Suggestions and scores length mismatch.",
        );
        return suggestions; // 返回所有建議
      }
    } else if (
      Array.isArray(data) &&
      data.length > 1 &&
      Array.isArray(data[1])
    ) {
      console.warn(
        "[Service: fetchSuggestionWithDelay] Relevance data not found, returning all suggestions.",
      );
      return data[1]; // 返回所有建議 (舊的邏輯)
    }

    console.log(
      "[Service: fetchSuggestionWithDelay] No valid suggestions found.",
    );
    return [];
  } catch (error) {
    console.error("延遲獲取自動完成建議時出錯:", error);
    return [];
  }
}
