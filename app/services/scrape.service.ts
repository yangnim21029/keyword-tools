import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { ScrapedPageContent } from "./firebase/data-onpage-result";

/**
 * Fetches a URL and extracts the main article content using Readability.
 *
 * @param url The URL of the webpage to scrape.
 * @returns A promise that resolves to the scraped content or null if extraction fails.
 */
export async function extractArticleContentFromUrl(
  url: string
): Promise<Omit<ScrapedPageContent, "extractedAt"> | null> {
  console.log(`[Scrape Service] Attempting to extract content from: ${url}`);
  try {
    const response = await fetch(url, {
      headers: {
        // Set a common user-agent to mimic a browser
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    if (!response.ok) {
      console.error(
        `[Scrape Service] Failed to fetch ${url}: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const html = await response.text();

    // Use JSDOM to parse the HTML
    // Provide the URL so Readability can resolve relative links if needed
    const dom = new JSDOM(html, { url });

    // Use Readability to extract the article
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      console.warn(
        `[Scrape Service] Readability could not parse article from ${url}`
      );
      return null;
    }

    console.log(`[Scrape Service] Successfully extracted content from: ${url}`);

    // Return the extracted data conforming to the interface (excluding extractedAt)
    const scrapedData: Omit<ScrapedPageContent, "extractedAt"> = {
      url: url,
      title: article.title ?? "",
      textContent: article.textContent ?? "",
      htmlContent: article.content ?? "",
      excerpt: article.excerpt ?? undefined,
      byline: article.byline ?? undefined,
      length: article.length === null ? undefined : article.length,
      siteName: article.siteName ?? undefined,
    };

    return scrapedData;
  } catch (error) {
    console.error(`[Scrape Service] Error processing ${url}:`, error);
    return null;
  }
}
