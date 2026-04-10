import { Page } from 'puppeteer-core';

export interface ScrapeResult {
  title: string | null;
  meta: Record<string, string>;
  links: string[];
  text: string;
  html: string;
  headings: Array<{ level: number; text: string }>;
  images: Array<{ src: string; alt: string }>;
  structured: Record<string, string | string[]>;
}

/**
 * Extract content from a rendered page.
 */
export async function extractContent(page: Page, fields: string[]): Promise<Partial<ScrapeResult>> {
  const result: Partial<ScrapeResult> = {};

  if (fields.includes('title') || fields.length === 0) {
    result.title = await page.title();
  }

  if (fields.includes('meta') || fields.length === 0) {
    result.meta = await page.evaluate(() => {
      const metas: Record<string, string> = {};
      document.querySelectorAll('meta').forEach(el => {
        const name = el.getAttribute('name') || el.getAttribute('property') || '';
        const content = el.getAttribute('content') || '';
        if (name && content) metas[name] = content;
      });
      return metas;
    });
  }

  if (fields.includes('links') || fields.length === 0) {
    result.links = await page.evaluate(() =>
      Array.from(document.querySelectorAll('a[href]'))
        .map(a => (a as HTMLAnchorElement).href)
        .filter(href => href.startsWith('http'))
        .slice(0, 500)
    );
  }

  if (fields.includes('text') || fields.length === 0) {
    result.text = await page.evaluate(() =>
      document.body ? document.body.innerText.slice(0, 50000) : ''
    );
  }

  if (fields.includes('html')) {
    result.html = await page.evaluate(() =>
      document.documentElement.outerHTML.slice(0, 500000)
    );
  }

  if (fields.includes('headings') || fields.length === 0) {
    result.headings = await page.evaluate(() =>
      Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
        level: parseInt(h.tagName[1]),
        text: h.textContent?.trim() || ''
      })).slice(0, 100)
    );
  }

  if (fields.includes('images')) {
    result.images = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img')).map(img => ({
        src: (img as HTMLImageElement).src,
        alt: (img as HTMLImageElement).alt || ''
      })).slice(0, 200)
    );
  }

  return result;
}

/**
 * Extract specific CSS selectors from a page.
 */
export async function extractSelectors(page: Page, selectors: Record<string, string>): Promise<Record<string, string | string[]>> {
  const result: Record<string, string | string[]> = {};

  for (const [key, selector] of Object.entries(selectors)) {
    try {
      const elements = await page.$$eval(selector, els =>
        els.map(el => el.textContent?.trim() || '')
      );
      result[key] = elements.length === 1 ? elements[0] : elements;
    } catch {
      result[key] = '';
    }
  }

  return result;
}
