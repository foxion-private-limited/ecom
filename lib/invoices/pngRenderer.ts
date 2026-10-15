import { chromium, Browser } from "playwright";

const CHROMIUM_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
  "--disable-dev-shm-usage",
  "--disable-accelerated-2d-canvas",
  "--no-first-run",
  "--no-zygote",
  "--single-process",
  "--disable-gpu",
  "--font-render-hinting=none",
];

export interface PngPageResult {
  pageNumber: number;
  buffer: Buffer;
  filename: string;
}

/**
 * Render HTML invoice into crisp PNG image(s).
 * Generates one high-resolution PNG per page (or whole page element).
 * Device scale factor: 2 provides crystal-clear typography on high-DPI screens.
 */
export async function renderHtmlToPngs(
  html: string,
  baseFilename: string = "invoice"
): Promise<PngPageResult[]> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: CHROMIUM_ARGS,
    });

    const page = await browser.newPage({
      viewport: {
        width: 1240, // Standard 150 DPI A4 width in px
        height: 1754, // Standard 150 DPI A4 height in px
      },
      deviceScaleFactor: 2, // 2x retina clarity
    });

    await page.setContent(html, {
      waitUntil: "load",
      timeout: 30000,
    });

    try {
      await page.evaluateHandle("document.fonts.ready");
    } catch {
      // Font readiness fallback
    }

    // Find all .page elements or default to full body
    const pageHandles = await page.$$(".page");

    const results: PngPageResult[] = [];

    if (pageHandles.length > 0) {
      for (let i = 0; i < pageHandles.length; i++) {
        const handle = pageHandles[i];
        const uint8Array = await handle.screenshot({
          type: "png",
        });
        results.push({
          pageNumber: i + 1,
          buffer: Buffer.from(uint8Array),
          filename: `${baseFilename}_page_${i + 1}.png`,
        });
      }
    } else {
      // Fallback: full page screenshot
      const uint8Array = await page.screenshot({
        type: "png",
        fullPage: true,
      });
      results.push({
        pageNumber: 1,
        buffer: Buffer.from(uint8Array),
        filename: `${baseFilename}_page_1.png`,
      });
    }

    return results;
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
