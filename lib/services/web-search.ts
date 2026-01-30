// Web search service using Puppeteer for golf resort discovery

import puppeteer, { Browser, Page } from "puppeteer";

interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

interface ResortWebResult {
  name: string;
  url: string;
  description: string;
  location: string;
  phoneNumber?: string;
  email?: string;
  amenities: string[];
  groupCapacity?: string;
  priceRange?: string;
  source: "google" | "bing" | "direct";
}

interface ScrapedDetails {
  title: string;
  description: string;
  phoneNumber?: string;
  email?: string;
  amenities: string[];
  groupCapacity?: string;
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
        "--window-size=1920x1080",
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
  }
  return browserInstance;
}

async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

export async function searchGoogleForResorts(
  destination: string,
  maxResults: number = 10
): Promise<WebSearchResult[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const results: WebSearchResult[] = [];

  try {
    // Set user agent to avoid bot detection
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Build search query focused on golf resorts for groups
    const searchQuery = `${destination} golf resort group packages large groups golf trip`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}&num=${maxResults}`;

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    // Wait for search results
    await page.waitForSelector("div#search", { timeout: 10000 });

    // Extract search results
    const searchResults = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = [];
      const resultElements = document.querySelectorAll("div.g");

      resultElements.forEach((el) => {
        const titleEl = el.querySelector("h3");
        const linkEl = el.querySelector("a");
        const snippetEl = el.querySelector("div[data-sncf]") ||
                          el.querySelector("div.VwiC3b") ||
                          el.querySelector("span.aCOpRe");

        if (titleEl && linkEl) {
          const href = linkEl.getAttribute("href");
          if (href && !href.includes("google.com")) {
            items.push({
              title: titleEl.textContent || "",
              url: href,
              snippet: snippetEl?.textContent || "",
            });
          }
        }
      });

      return items.slice(0, 10);
    });

    for (const result of searchResults) {
      results.push({
        ...result,
        source: "google",
      });
    }
  } catch (error) {
    console.error("Google search error:", error);
  } finally {
    await page.close();
  }

  return results;
}

export async function searchBingForResorts(
  destination: string,
  maxResults: number = 10
): Promise<WebSearchResult[]> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  const results: WebSearchResult[] = [];

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    const searchQuery = `${destination} golf resort group packages golf trip accommodations`;
    const searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(searchQuery)}&count=${maxResults}`;

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });

    await page.waitForSelector("#b_results", { timeout: 10000 });

    const searchResults = await page.evaluate(() => {
      const items: { title: string; url: string; snippet: string }[] = [];
      const resultElements = document.querySelectorAll("li.b_algo");

      resultElements.forEach((el) => {
        const titleEl = el.querySelector("h2 a");
        const snippetEl = el.querySelector("p") || el.querySelector(".b_caption p");

        if (titleEl) {
          const href = titleEl.getAttribute("href");
          if (href) {
            items.push({
              title: titleEl.textContent || "",
              url: href,
              snippet: snippetEl?.textContent || "",
            });
          }
        }
      });

      return items.slice(0, 10);
    });

    for (const result of searchResults) {
      results.push({
        ...result,
        source: "bing",
      });
    }
  } catch (error) {
    console.error("Bing search error:", error);
  } finally {
    await page.close();
  }

  return results;
}

export async function scrapeResortDetails(
  url: string
): Promise<ScrapedDetails | null> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });

    const details = await page.evaluate(() => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || "";
      };

      // Try to extract contact information
      const bodyText = document.body.innerText;

      // Extract phone numbers (US format)
      const phoneMatch = bodyText.match(
        /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/
      );

      // Extract email addresses
      const emailMatch = bodyText.match(
        /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
      );

      // Get meta description
      const metaDesc =
        document.querySelector('meta[name="description"]')?.getAttribute("content") || "";

      // Get page title
      const title = document.title || "";

      // Look for amenities/features
      const amenityKeywords = [
        "championship course",
        "18 holes",
        "36 holes",
        "resort",
        "spa",
        "restaurant",
        "lodging",
        "accommodations",
        "conference",
        "event",
        "group",
        "package",
        "caddie",
        "pro shop",
      ];

      const foundAmenities = amenityKeywords.filter((keyword) =>
        bodyText.toLowerCase().includes(keyword)
      );

      // Look for group capacity mentions
      const capacityMatch = bodyText.match(
        /(?:up to |accommodate[s]? |capacity[:]? ?)(\d+)(?:\s*(?:guests|golfers|players|people))?/i
      );

      return {
        title,
        description: metaDesc,
        phoneNumber: phoneMatch?.[0] || undefined,
        email: emailMatch?.[0] || undefined,
        amenities: foundAmenities,
        groupCapacity: capacityMatch?.[1] || undefined,
      };
    });

    return details;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

export async function searchForGolfResorts(
  destination: string
): Promise<ResortWebResult[]> {
  const results: ResortWebResult[] = [];
  const seenUrls = new Set<string>();

  try {
    // Search both Google and Bing for better coverage
    const [googleResults, bingResults] = await Promise.all([
      searchGoogleForResorts(destination, 8),
      searchBingForResorts(destination, 8),
    ]);

    const allResults = [...googleResults, ...bingResults];

    // Deduplicate by URL
    const uniqueResults = allResults.filter((r) => {
      const domain = new URL(r.url).hostname;
      if (seenUrls.has(domain)) return false;
      seenUrls.add(domain);
      return true;
    });

    // Filter for likely golf resort pages
    const golfRelated = uniqueResults.filter((r) => {
      const text = `${r.title} ${r.snippet}`.toLowerCase();
      return (
        text.includes("golf") ||
        text.includes("resort") ||
        text.includes("course") ||
        text.includes("club")
      );
    });

    // Scrape details from top results (limit to avoid rate limiting)
    const topResults = golfRelated.slice(0, 6);

    for (const result of topResults) {
      try {
        const details = await scrapeResortDetails(result.url);

        if (details) {
          results.push({
            name: details.title || result.title,
            url: result.url,
            description: details.description || result.snippet,
            location: destination,
            phoneNumber: details.phoneNumber,
            email: details.email,
            amenities: details.amenities || [],
            groupCapacity: details.groupCapacity,
            source: result.source as "google" | "bing",
          });
        }
      } catch (error) {
        // If scraping fails, still include basic info
        results.push({
          name: result.title,
          url: result.url,
          description: result.snippet,
          location: destination,
          amenities: [],
          source: result.source as "google" | "bing",
        });
      }
    }
  } catch (error) {
    console.error("Web search error:", error);
  }

  return results;
}

// Cleanup function to be called on process exit
export async function cleanup(): Promise<void> {
  await closeBrowser();
}

// Handle process termination
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);
