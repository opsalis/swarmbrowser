# API Reference — SwarmBrowser

Base URL: `https://api.swarmbrowser.example.com`

## Authentication

All requests require `X-API-Key` header (except /health).

## Endpoints

### Health

```
GET /health
```

```json
{
  "status": "ok",
  "version": "1.0.0",
  "location": "k3s-sg",
  "pool": { "total": 5, "busy": 2, "idle": 3, "queued": 0 },
  "uptime": 86400
}
```

---

### Screenshot

```
POST /v1/screenshot
```

Body:
```json
{
  "url": "https://example.com",
  "width": 1280,
  "height": 720,
  "format": "png",
  "fullPage": false,
  "quality": 80,
  "waitUntil": "networkidle2",
  "blockResources": ["image", "font"],
  "userAgent": "Custom/1.0",
  "timeout": 30000
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `url` | string | Required | URL to screenshot |
| `width` | integer | 1280 | Viewport width |
| `height` | integer | 720 | Viewport height |
| `format` | string | `png` | `png` or `jpeg` |
| `fullPage` | boolean | false | Capture full scrollable page |
| `quality` | integer | — | JPEG quality (1-100) |
| `waitUntil` | string | `networkidle2` | Navigation wait strategy |
| `blockResources` | string[] | — | Resource types to block |
| `userAgent` | string | — | Custom user agent |
| `timeout` | integer | 30000 | Page load timeout (ms) |

Response: Binary image with headers:
- `Content-Type: image/png` or `image/jpeg`
- `X-Load-Time: 1234` (milliseconds)
- `X-Location: k3s-sg` (render location)
- `X-Resource-Count: 42`

---

### PDF

```
POST /v1/pdf
```

Body:
```json
{
  "url": "https://example.com",
  "format": "A4",
  "landscape": false,
  "printBackground": true,
  "margin": { "top": "1cm", "bottom": "1cm", "left": "1cm", "right": "1cm" }
}
```

Response: Binary PDF with `Content-Type: application/pdf`

---

### Scrape

```
POST /v1/scrape
```

Body:
```json
{
  "url": "https://example.com",
  "extract": ["title", "meta", "links", "text", "headings", "images", "html"],
  "selectors": {
    "price": ".product-price",
    "name": "h1.product-title"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `extract` | string[] | Built-in extractors: title, meta, links, text, headings, images, html |
| `selectors` | object | CSS selectors to extract (key: name, value: selector) |

Response:
```json
{
  "url": "https://example.com",
  "location": "k3s-de",
  "metrics": {
    "loadTime": 1234,
    "domContentLoaded": 456,
    "firstPaint": 234,
    "resourceCount": 42,
    "totalBytes": 512000
  },
  "content": {
    "title": "Example Domain",
    "meta": { "description": "..." },
    "links": ["https://..."],
    "text": "...",
    "headings": [{ "level": 1, "text": "Example Domain" }]
  },
  "selectors": {
    "price": "$29.99",
    "name": "Product Name"
  }
}
```

---

### Performance Metrics

```
POST /v1/metrics
```

Same options as screenshot, returns only metrics (no rendering output).

---

### Batch Processing

```
POST /v1/batch
```

Body:
```json
{
  "urls": ["https://example.com/1", "https://example.com/2"],
  "action": "scrape",
  "options": {
    "extract": ["title", "text"],
    "waitUntil": "networkidle2"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `urls` | string[] | Up to 100 URLs |
| `action` | string | `scrape` or `screenshot` |
| `options` | object | Same options as individual endpoints |

Response:
```json
{
  "total": 2,
  "completed": 2,
  "failed": 0,
  "results": [...]
}
```

## Error Responses

```json
{ "error": "Description", "location": "k3s-sg" }
```

| Status | Meaning |
|--------|---------|
| 400 | Missing required parameter |
| 401 | Invalid API key |
| 500 | Rendering error (timeout, crash) |

## Rate Limits

| Tier | Pages/day | Batch size |
|------|-----------|------------|
| Free | 100 | 10 |
| Pro | 10,000 | 100 |
| Business | 100,000 | 100 |
