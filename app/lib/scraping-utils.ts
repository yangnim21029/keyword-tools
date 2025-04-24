import * as cheerio from 'cheerio';

/**
 * Fetches and extracts H2 and H3 headings from a list of URLs.
 * Stops after successfully processing a maximum of two URLs.
 *
 * Requires the 'cheerio' library to be installed:
 * `npm install cheerio`
 * `npm install --save-dev @types/cheerio`
 *
 * @param urls - An array of URLs to fetch headings from (e.g., top 10 SERP results).
 * @returns A promise resolving to a string containing H2/H3 headings from up to two URLs.
 */
export async function fetchOutlineHeadings({ urls }: { urls: string[] }): Promise<string> {
    let allHeadingsText = "";
    let successfulFetches = 0;
    const maxFetches = 2; // Limit to fetching from max 2 URLs

    console.log(`[fetchOutlineHeadings] Starting fetch for max ${maxFetches} URLs from ${urls.length} provided.`);

    for (const url of urls) {
        if (successfulFetches >= maxFetches) {
            console.log(`[fetchOutlineHeadings] Reached max fetch limit (${maxFetches}). Stopping.`);
            break; // Stop if we have successfully fetched from two URLs
        }

        try {
            console.log(`[fetchOutlineHeadings] Attempting to fetch: ${url}`);
            // Use native fetch (ensure your Node.js/environment supports it)
            const response = await fetch(url, {
                headers: { // Add a basic User-Agent to mimic a browser
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                signal: AbortSignal.timeout(10000) // Add a 10-second timeout
            });

            if (!response.ok) {
                console.warn(`[fetchOutlineHeadings] Failed to fetch ${url}: ${response.status} ${response.statusText}`);
                continue; // Skip to the next URL if fetch failed
            }

            const html = await response.text();
            // Check if cheerio is available (conceptual check - relies on installation)
            if (typeof cheerio?.load !== 'function') {
                 console.error("[fetchOutlineHeadings] Cheerio library is not loaded correctly. Please install 'cheerio'.");
                 // Optionally throw an error or return empty string if cheerio is essential
                 return allHeadingsText; // Return what we have so far or empty string
            }
            const $ = cheerio.load(html); // Load HTML into cheerio

            let headingsFromThisUrl = "";
            $('h2, h3').each((index, element) => {
                const tagName = $(element).prop('tagName').toLowerCase();
                const text = $(element).text().trim();
                if (text) {
                    headingsFromThisUrl += `${tagName}: ${text}\n`;
                }
            });

            if (headingsFromThisUrl) {
                allHeadingsText += `--- Headings from ${url} ---\n${headingsFromThisUrl}\n`;
                successfulFetches++; // Increment count only if headings were found
                console.log(`[fetchOutlineHeadings] Successfully processed ${url} (${successfulFetches}/${maxFetches}).`);
            } else {
                 console.log(`[fetchOutlineHeadings] No h2/h3 headings found at ${url}.`);
            }

        } catch (error: any) {
            // Handle fetch errors (like timeouts, network issues, DNS errors)
            if (error.name === 'TimeoutError') {
                console.error(`[fetchOutlineHeadings] Timeout fetching ${url}: ${error.message}`);
            } else {
                console.error(`[fetchOutlineHeadings] Error processing ${url}: ${error.message}`);
            }
            // Continue to the next URL even if one fails
        }
    }
     console.log(`[fetchOutlineHeadings] Finished fetching. Processed ${successfulFetches} URLs.`);
    return allHeadingsText;
} 