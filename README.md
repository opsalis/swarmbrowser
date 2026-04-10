# SwarmBrowser — Headless Browser API from Anywhere

Render, screenshot, scrape, and generate PDFs from 4 continents. See how your site looks from Singapore, Frankfurt, Canada, or the UK.

## Features

- **Screenshot API** — PNG/JPEG screenshots of any URL
- **PDF Generation** — Convert web pages to PDF
- **Web Scraping** — Extract data from JS-rendered pages
- **Geographic rendering** — Choose which continent renders the page
- **Batch processing** — Submit 1000 URLs at once
- **Performance metrics** — Load times from each location

## Quick Start

```bash
# Screenshot
curl -X POST http://localhost:3500/v1/screenshot \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"url": "https://example.com", "width": 1280, "height": 720}' \
  --output screenshot.png

# PDF
curl -X POST http://localhost:3500/v1/pdf \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"url": "https://example.com", "format": "A4"}' \
  --output page.pdf

# Scrape
curl -X POST http://localhost:3500/v1/scrape \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: your-key' \
  -d '{"url": "https://example.com", "extract": ["title", "meta", "links", "text"]}'
```

## Architecture

```
Client → API (Express :3500) → Browser Pool (Puppeteer + Chromium)
         Pods on 4 k3s nodes, HPA-scaled
```

## Deployment

```bash
kubectl apply -f backend/k8s/service.yaml
kubectl apply -f backend/k8s/deployment.yaml
kubectl apply -f backend/k8s/hpa.yaml
```

## Pricing

| Tier | Pages/day | Locations | Price |
|------|-----------|-----------|-------|
| Free | 100 | 1 | $0/mo |
| Pro | 10,000 | All 4 | $20/mo USDC |
| Business | 100,000 | All 4 | $100/mo USDC |

## License

Proprietary — Mesa Operations LLC
