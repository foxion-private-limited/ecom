import { chromium, Browser } from "playwright";

/**
 * Common Chromium launch options for server environments.
 */
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

/**
 * Generate a production-quality PDF from an HTML string using Playwright Chromium.
 * Uses exact A4 dimensions, print CSS, and background graphics.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch({
      headless: true,
      args: CHROMIUM_ARGS,
    });

    const page = await browser.newPage();

    // Set HTML content and wait until DOM and external assets (like logos) are ready
    await page.setContent(html, {
      waitUntil: "load",
      timeout: 30000,
    });

    // Ensure system/web fonts are ready
    try {
      await page.evaluateHandle("document.fonts.ready");
    } catch {
      // Ignore if document.fonts is not supported in the context
    }

    // Emulate print media so @media print styles take effect
    await page.emulateMedia({ media: "print" });

    // Generate PDF
    const pdfUint8Array = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0mm",
        right: "0mm",
        bottom: "0mm",
        left: "0mm",
      },
    });

    return Buffer.from(pdfUint8Array);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
