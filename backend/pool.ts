import puppeteer, { Browser } from 'puppeteer-core';

const CHROMIUM_PATH = process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium';
const POOL_SIZE = parseInt(process.env.POOL_SIZE || '5');
const MAX_USES = parseInt(process.env.MAX_USES || '100');

interface PooledBrowser {
  browser: Browser;
  uses: number;
  busy: boolean;
  createdAt: number;
}

class BrowserPool {
  private pool: PooledBrowser[] = [];
  private queue: Array<(browser: PooledBrowser) => void> = [];
  private initializing = false;

  async initialize(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;

    console.log(`Initializing browser pool: ${POOL_SIZE} instances`);
    for (let i = 0; i < POOL_SIZE; i++) {
      try {
        const instance = await this.createInstance();
        this.pool.push(instance);
        console.log(`Browser instance ${i + 1}/${POOL_SIZE} ready`);
      } catch (err: any) {
        console.error(`Failed to create browser instance ${i + 1}: ${err.message}`);
      }
    }
    console.log(`Browser pool ready: ${this.pool.length} instances`);
  }

  private async createInstance(): Promise<PooledBrowser> {
    const browser = await puppeteer.launch({
      executablePath: CHROMIUM_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update'
      ]
    });

    return {
      browser,
      uses: 0,
      busy: false,
      createdAt: Date.now()
    };
  }

  async acquire(): Promise<PooledBrowser> {
    // Find an idle instance
    const idle = this.pool.find(b => !b.busy);
    if (idle) {
      idle.busy = true;
      idle.uses++;
      return idle;
    }

    // If pool is full, queue the request
    return new Promise((resolve) => {
      this.queue.push(resolve);
    });
  }

  async release(instance: PooledBrowser): Promise<void> {
    // Recycle if exceeded max uses
    if (instance.uses >= MAX_USES) {
      const idx = this.pool.indexOf(instance);
      if (idx >= 0) this.pool.splice(idx, 1);

      try {
        await instance.browser.close();
      } catch { /* ignore */ }

      try {
        const newInstance = await this.createInstance();
        this.pool.push(newInstance);
      } catch (err: any) {
        console.error(`Failed to recycle browser: ${err.message}`);
      }
    } else {
      instance.busy = false;
    }

    // Serve queued requests
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      const idle = this.pool.find(b => !b.busy);
      if (idle) {
        idle.busy = true;
        idle.uses++;
        next(idle);
      }
    }
  }

  getStatus(): { total: number; busy: number; idle: number; queued: number } {
    return {
      total: this.pool.length,
      busy: this.pool.filter(b => b.busy).length,
      idle: this.pool.filter(b => !b.busy).length,
      queued: this.queue.length
    };
  }

  async shutdown(): Promise<void> {
    for (const instance of this.pool) {
      try {
        await instance.browser.close();
      } catch { /* ignore */ }
    }
    this.pool = [];
  }
}

export const browserPool = new BrowserPool();
export { BrowserPool, PooledBrowser };
