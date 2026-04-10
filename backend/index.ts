import express, { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { browserPool } from './pool';
import { navigatePage, cleanupPage, NavigationOptions } from './browser';
import { extractContent, extractSelectors } from './scraper';

const app = express();
app.use(express.json({ limit: '10mb' }));

// --- Config ---
const PORT = parseInt(process.env.PORT || '3500');
const API_KEY = process.env.API_KEY || '';
const NODE_LOCATION = process.env.NODE_LOCATION || process.env.HOSTNAME || 'unknown';
const PAGE_TIMEOUT = parseInt(process.env.PAGE_TIMEOUT || '30000');

// --- Auth ---
function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) { next(); return; }
  const key = req.headers['x-api-key'] as string;
  if (key !== API_KEY) { res.status(401).json({ error: 'Invalid API key' }); return; }
  next();
}

// --- Health ---
app.get('/health', (_req: Request, res: Response) => {
  const poolStatus = browserPool.getStatus();
  res.json({
    status: 'ok',
    version: '1.0.0',
    location: NODE_LOCATION,
    pool: poolStatus,
    uptime: process.uptime()
  });
});

// --- Screenshot ---
app.post('/v1/screenshot', authenticate, async (req: Request, res: Response) => {
  const {
    url, width = 1280, height = 720, format = 'png',
    fullPage = false, quality, waitUntil = 'networkidle2',
    blockResources, userAgent, timeout
  } = req.body;

  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  const instance = await browserPool.acquire();
  try {
    const page = await instance.browser.newPage();

    const metrics = await navigatePage(page, {
      url, width, height, waitUntil, blockResources, userAgent,
      timeout: timeout || PAGE_TIMEOUT
    });

    const screenshotOptions: any = {
      type: format === 'jpeg' ? 'jpeg' : 'png',
      fullPage,
      encoding: 'binary'
    };
    if (format === 'jpeg' && quality) {
      screenshotOptions.quality = quality;
    }

    const screenshot = await page.screenshot(screenshotOptions);
    await cleanupPage(page);

    res.set('Content-Type', format === 'jpeg' ? 'image/jpeg' : 'image/png');
    res.set('X-Load-Time', metrics.loadTime.toString());
    res.set('X-Location', NODE_LOCATION);
    res.set('X-Resource-Count', metrics.resourceCount.toString());
    res.send(screenshot);
  } catch (err: any) {
    res.status(500).json({ error: err.message, location: NODE_LOCATION });
  } finally {
    await browserPool.release(instance);
  }
});

// --- PDF ---
app.post('/v1/pdf', authenticate, async (req: Request, res: Response) => {
  const {
    url, format = 'A4', landscape = false, printBackground = true,
    margin, waitUntil = 'networkidle2', blockResources, userAgent, timeout
  } = req.body;

  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  const instance = await browserPool.acquire();
  try {
    const page = await instance.browser.newPage();

    const metrics = await navigatePage(page, {
      url, waitUntil, blockResources, userAgent,
      timeout: timeout || PAGE_TIMEOUT
    });

    const pdfOptions: any = {
      format: format || 'A4',
      landscape,
      printBackground,
      margin: margin || { top: '1cm', bottom: '1cm', left: '1cm', right: '1cm' }
    };

    const pdf = await page.pdf(pdfOptions);
    await cleanupPage(page);

    res.set('Content-Type', 'application/pdf');
    res.set('Content-Disposition', 'attachment; filename="page.pdf"');
    res.set('X-Load-Time', metrics.loadTime.toString());
    res.set('X-Location', NODE_LOCATION);
    res.send(pdf);
  } catch (err: any) {
    res.status(500).json({ error: err.message, location: NODE_LOCATION });
  } finally {
    await browserPool.release(instance);
  }
});

// --- Scrape ---
app.post('/v1/scrape', authenticate, async (req: Request, res: Response) => {
  const {
    url, extract = ['title', 'meta', 'links', 'text', 'headings'],
    selectors, waitUntil = 'networkidle2', blockResources, userAgent, timeout
  } = req.body;

  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  const instance = await browserPool.acquire();
  try {
    const page = await instance.browser.newPage();

    const metrics = await navigatePage(page, {
      url, waitUntil, blockResources, userAgent,
      timeout: timeout || PAGE_TIMEOUT
    });

    const content = await extractContent(page, extract);
    let selectorResults = {};
    if (selectors && typeof selectors === 'object') {
      selectorResults = await extractSelectors(page, selectors);
    }

    await cleanupPage(page);

    res.json({
      url,
      location: NODE_LOCATION,
      metrics: {
        loadTime: metrics.loadTime,
        domContentLoaded: metrics.domContentLoaded,
        firstPaint: metrics.firstPaint,
        resourceCount: metrics.resourceCount,
        totalBytes: metrics.totalBytes
      },
      content,
      selectors: selectorResults
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, location: NODE_LOCATION });
  } finally {
    await browserPool.release(instance);
  }
});

// --- Performance metrics only ---
app.post('/v1/metrics', authenticate, async (req: Request, res: Response) => {
  const { url, waitUntil = 'networkidle2', blockResources, userAgent, timeout } = req.body;

  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  const instance = await browserPool.acquire();
  try {
    const page = await instance.browser.newPage();
    const metrics = await navigatePage(page, {
      url, waitUntil, blockResources, userAgent,
      timeout: timeout || PAGE_TIMEOUT
    });
    await cleanupPage(page);

    res.json({
      url,
      location: NODE_LOCATION,
      metrics
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message, location: NODE_LOCATION });
  } finally {
    await browserPool.release(instance);
  }
});

// --- Batch processing ---
app.post('/v1/batch', authenticate, async (req: Request, res: Response) => {
  const { urls, action = 'scrape', options = {} } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: 'urls array is required' });
    return;
  }

  if (urls.length > 100) {
    res.status(400).json({ error: 'Maximum 100 URLs per batch' });
    return;
  }

  const results = [];
  const concurrency = Math.min(urls.length, browserPool.getStatus().total);

  // Process in chunks matching pool size
  for (let i = 0; i < urls.length; i += concurrency) {
    const chunk = urls.slice(i, i + concurrency);
    const chunkResults = await Promise.allSettled(
      chunk.map(async (url: string) => {
        const instance = await browserPool.acquire();
        try {
          const page = await instance.browser.newPage();
          const metrics = await navigatePage(page, {
            url, waitUntil: options.waitUntil || 'networkidle2',
            timeout: options.timeout || PAGE_TIMEOUT,
            blockResources: options.blockResources
          });

          let result: any = { url, location: NODE_LOCATION, metrics };

          if (action === 'screenshot') {
            const screenshot = await page.screenshot({ encoding: 'base64', type: 'png' });
            result.screenshot = screenshot;
          } else if (action === 'scrape') {
            result.content = await extractContent(page, options.extract || ['title', 'meta', 'text']);
          }

          await cleanupPage(page);
          return result;
        } finally {
          await browserPool.release(instance);
        }
      })
    );

    for (const r of chunkResults) {
      results.push(r.status === 'fulfilled' ? r.value : { error: (r.reason as Error).message });
    }
  }

  res.json({
    total: urls.length,
    completed: results.filter((r: any) => !r.error).length,
    failed: results.filter((r: any) => r.error).length,
    results
  });
});

// --- Start ---
async function start() {
  await browserPool.initialize();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SwarmBrowser API listening on :${PORT}, location: ${NODE_LOCATION}`);
  });
}

start().catch((err) => {
  console.error(`Failed to start: ${err.message}`);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await browserPool.shutdown();
  process.exit(0);
});

export { app };
