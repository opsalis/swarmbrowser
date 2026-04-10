# Architecture — SwarmBrowser

## Overview

SwarmBrowser is a headless browser API service that renders web pages from 4 continents using Puppeteer on k3s infrastructure.

## System Components

### 1. API Server + Browser Pods (Deployment)
- Express.js API
- Puppeteer with headless Chromium
- Browser instance pool for fast response
- HPA scales pods based on CPU/memory

### 2. Website (Cloudflare Pages)
- Static landing page
- Usage dashboard

## Architecture

```
Client
  │
  ▼  REST (port 3500)
┌─────────────────────────┐
│  API + Browser Pool     │  x N pods (HPA-scaled)
│  Express + Puppeteer    │
│  Chromium headless       │
└─────────────────────────┘
  Pods distributed across:
  Canada | Frankfurt | Singapore | UK
```

## Request Flow

### Screenshot
```
1. Client: POST /v1/screenshot { url, width, height, format }
2. API acquires browser instance from pool
3. Navigates to URL, waits for networkidle
4. Takes screenshot (PNG or JPEG)
5. Returns base64 or binary image
6. Browser instance returned to pool
```

### PDF
```
1. Client: POST /v1/pdf { url, format, landscape }
2. Same flow, generates PDF instead
3. Returns binary PDF
```

### Scrape
```
1. Client: POST /v1/scrape { url, selectors, extract }
2. Renders page, extracts specified data
3. Returns structured JSON with extracted content
```

### Batch
```
1. Client: POST /v1/batch { urls[], action, options }
2. Distributes across pool instances
3. Parallel processing
4. Returns array of results
```

## Browser Pool

```
Pool Manager
├── Instance 1 (idle) ── Chrome process
├── Instance 2 (busy) ── Chrome process ── rendering page
├── Instance 3 (idle) ── Chrome process
├── Instance 4 (busy) ── Chrome process ── taking screenshot
└── Instance 5 (idle) ── Chrome process

Config:
- POOL_SIZE: instances per pod (default 5)
- MAX_USES: recycle after N uses (default 100)
- IDLE_TIMEOUT: close idle instances after (default 5 min)
```

## Geographic Distribution

Pods run on all k3s nodes. Clients can specify preferred region:
- Request `region=asia` → routed to Singapore pod
- Request `region=europe` → routed to Frankfurt or UK pod
- No region → load balanced across all

## Security

- API key authentication
- Page navigation timeout (30s default)
- Resource blocking (optional: block images, fonts, ads)
- No persistent storage of rendered content
- Sandboxed Chromium (--no-sandbox flag in container for compat)

## Scaling

HPA configuration:
- Min replicas: 1 per node
- Max replicas: 10 per node
- Scale trigger: CPU > 70% or Memory > 80%
- Scale down delay: 5 minutes

## Resource Requirements

Each browser instance uses approximately:
- CPU: 100-500m during rendering
- Memory: 100-300MB per tab
- A pod with 5 instances needs ~1.5GB RAM
