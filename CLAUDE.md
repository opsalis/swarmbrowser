# CLAUDE.md — SwarmBrowser

> Read this first. All facts here are traceable to source code.

## What is SwarmBrowser

Headless browser API — render, screenshot, scrape from any continent. Customers send a URL, we render it in headless Chrome on our k3s cluster and return screenshots, PDFs, extracted text, DOM, and performance metrics.

## Relationship to Opsalis

This project runs on the Opsalis network as an independent business.
Registers services, earns USDC through 95/5 settlement, runs in Docker containers.
No changes to Opsalis core required.

## Repository Structure

```
backend/
  index.ts          — Express API: create session, get results, screenshots
  browser.ts        — Puppeteer headless Chrome management
  pool.ts           — Browser instance pool (reuse, recycle)
  scraper.ts        — Web scraping helpers (extract, screenshot, PDF)
  package.json
  tsconfig.json
  Dockerfile        — Chrome + Node.js
  k8s/
    deployment.yaml — Browser pods (scaled per demand)
    service.yaml
    hpa.yaml        — Horizontal Pod Autoscaler

website/
  index.html        — "Headless browsing from anywhere"
  dashboard.html
  terms.html
  wrangler.toml

docs/
  API_REFERENCE.md
  DEPLOYMENT.md
```

## Tech Stack

- Runtime: Node.js 22 + TypeScript
- Browser: Puppeteer + Chromium
- Framework: Express 4
- Orchestration: k3s Deployment + HPA
- Website: Cloudflare Pages

## Key Design Decisions

- **Browser pool** — Pre-launched browser instances for fast response. Recycle after N uses.
- **Geographic rendering** — Choose which continent renders the page (test CDN from Asia).
- **Batch mode** — Submit 1000 URLs, get all results. Parallel across nodes.
- **Resource limits** — Per-page timeout, max memory, block heavy resources optionally.

## Pricing

| Tier | Pages/day | Locations | Price |
|------|-----------|-----------|-------|
| Free | 100 | 1 | $0/mo |
| Pro | 10,000 | All 4 | $20/mo USDC |
| Business | 100,000 | All 4 | $100/mo USDC |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3500` | API listen port |
| `POOL_SIZE` | `5` | Browser instances per pod |
| `PAGE_TIMEOUT` | `30000` | Per-page timeout (ms) |
| `NODE_LOCATION` | `unknown` | Geographic location |
| `API_KEY` | — | Authentication key |

## Status

COMPLETE — Full implementation with API, browser pool, scraper, k8s manifests, and website.

## Repository

https://github.com/opsalis/swarmbrowser
