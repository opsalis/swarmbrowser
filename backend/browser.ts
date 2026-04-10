import { Page } from 'puppeteer-core';

const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '30000');

export interface NavigationOptions {
  url: string;
  width?: number;
  height?: number;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
  timeout?: number;
  blockResources?: string[]; // 'image', 'stylesheet', 'font', 'script'
  userAgent?: string;
  extraHeaders?: Record<string, string>;
  javascript?: boolean;
}

export interface PageMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number | null;
  resourceCount: number;
  totalBytes: number;
}

/**
 * Navigate a page to a URL with configured options.
 */
export async function navigatePage(page: Page, options: NavigationOptions): Promise<PageMetrics> {
  const startTime = Date.now();

  // Set viewport
  await page.setViewport({
    width: options.width || 1280,
    height: options.height || 720,
    deviceScaleFactor: 1
  });

  // Set user agent
  if (options.userAgent) {
    await page.setUserAgent(options.userAgent);
  }

  // Set extra headers
  if (options.extraHeaders) {
    await page.setExtraHTTPHeaders(options.extraHeaders);
  }

  // Block resources if specified
  if (options.blockResources && options.blockResources.length > 0) {
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (options.blockResources!.includes(req.resourceType())) {
        req.abort();
      } else {
        req.continue();
      }
    });
  }

  // Disable JavaScript if specified
  if (options.javascript === false) {
    await page.setJavaScriptEnabled(false);
  }

  // Track resources
  let resourceCount = 0;
  let totalBytes = 0;
  page.on('response', async (response) => {
    resourceCount++;
    try {
      const buffer = await response.buffer();
      totalBytes += buffer.length;
    } catch { /* ignore */ }
  });

  // Navigate
  const waitUntil = options.waitUntil || 'networkidle2';
  await page.goto(options.url, {
    waitUntil,
    timeout: options.timeout || PAGE_TIMEOUT
  });

  const loadTime = Date.now() - startTime;

  // Get timing metrics
  const timing = await page.evaluate(() => {
    const perf = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    return {
      domContentLoaded: perf ? perf.domContentLoadedEventEnd : 0,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || null
    };
  }).catch(() => ({ domContentLoaded: 0, firstPaint: null }));

  return {
    loadTime,
    domContentLoaded: timing.domContentLoaded,
    firstPaint: timing.firstPaint,
    resourceCount,
    totalBytes
  };
}

/**
 * Clean up a page after use.
 */
export async function cleanupPage(page: Page): Promise<void> {
  try {
    await page.close();
  } catch { /* ignore */ }
}
