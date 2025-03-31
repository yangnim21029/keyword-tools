/**
 * Suggestion Service - 提供關鍵詞建議的功能
 * 此服務僅負責從 Google 獲取建議數據，不處理快取邏輯
 */

// --- 數據獲取功能 ---

/**
 * 使用 Google Autocomplete API 獲取關鍵詞建議
 */
export async function fetchAutocomplete(query: string, region: string = 'TW', language: string = 'zh-TW'): Promise<string[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 50)); // 減少延遲

    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&gl=${region}&hl=${language}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      },
    });

    const data = await response.json();
    // Google autocomplete 返回 [query, suggestions] 格式
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
      return data[1];
    }
    return [];
  } catch (error) {
    console.error('獲取自動完成建議時出錯:', error);
    return []; // 錯誤時返回空數組
  }
}

/**
 * 使用 Google Autocomplete API 獲取關鍵詞建議，使用較長的延遲
 * 適用於特定 UI 互動（例如點擊關鍵詞卡片）
 */
export async function fetchSuggestionWithDelay(query: string, region: string = 'TW', language: string = 'zh-TW'): Promise<string[]> {
  try {
    await new Promise(resolve => setTimeout(resolve, 200)); // 較長的延遲

    const url = `https://suggestqueries.google.com/complete/search?client=chrome&q=${encodeURIComponent(query)}&gl=${region}&hl=${language}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      },
    });

    const data = await response.json();
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
      return data[1];
    }
    return [];
  } catch (error) {
    console.error('延遲獲取自動完成建議時出錯:', error);
    return [];
  }
} 