// Types for our API response
type SearchResult = {
  title: string;
  url: string;
}

type OrganicResults = {
  organicResults: SearchResult[];
}

type ApiResponse = OrganicResults[];

/**
 * Fetches keyword search results from Google via Apify API
 * @param query The search query string or array of queries
 * @returns Formatted string of search results or error message
 */
export async function fetchKeywordData(query: string | string[]): Promise<string> {
  const apiUrl = 'https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=apify_api_n4QsZ7oEbTf359GZDTdb05i1U449og3Qzre3';
  
  const payload = {
    "countryCode": "af",
    "forceExactMatch": false,
    "includeIcons": false,
    "includeUnfilteredResults": false,
    "maxPagesPerQuery": 1,
    "mobileResults": false,
    "queries": query,
    "resultsPerPage": 100,
    "saveHtml": false,
    "saveHtmlToKeyValueStore": true,
    "searchLanguage": "ar"
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`);
    }

    const data = await response.json() as ApiResponse;

    if (data && Array.isArray(data) && data.length > 0 && data[0].organicResults) {
      const organicResults = data[0].organicResults;
      let formattedResults = "";
      const topResults = organicResults.slice(0, 10); // Get top 10 results

      topResults.forEach((item, index) => {
        formattedResults += `${index + 1}. ${item.title}\n${item.url}\n\n`;
      });
      
      return formattedResults || "沒有找到相關的關鍵字結果。";
    } else {
      return "無法解析關鍵字數據或數據為空。";
    }
  } catch (error) {
    console.error(`獲取關鍵字數據時發生錯誤:`, error);
    return `獲取關鍵字數據時發生錯誤: ${error instanceof Error ? error.message : String(error)}`;
  }
}


