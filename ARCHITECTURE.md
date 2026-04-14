# Architecture — SwarmBrowser

**Version:** 1.0 — Architecture Draft (no code written)
**Date:** 2026-04-14
**Status:** Ready for implementation. Phases 1-5 defined. Future session can start coding from Phase 1.

---

## 1. What SwarmBrowser Does

SwarmBrowser is a distributed headless browser farm. A customer submits a URL (or a batch of URLs) and receives back screenshots, PDFs, scraped JSON, or HAR traces — rendered in real Chromium, Firefox, or WebKit browser engines, from any combination of geographic regions, in parallel across up to 1,000 browser instances.

### Primary Use Cases

| Use Case | Description |
|---|---|
| Competitive intelligence | See what a competitor's page shows from US, EU, APAC simultaneously — detect geo-targeting, price discrimination, regional A/B tests |
| SEO auditing | Render JavaScript-heavy SPAs the way Googlebot would. Extract title, meta, structured data, heading hierarchy, rendered text |
| A/B test verification | Confirm a variant is being served to real browsers in the correct regions and percentages |
| SSR snapshots | Generate server-side-rendered snapshots for caching, social preview cards, or PDF invoices |
| Legal/compliance capture | Screenshot + PDF + HAR = verifiable record of what a page showed at a specific time from a specific location |
| Load testing pre-flight | Render a site under realistic browser load before k6/Locust hammers the backend |

---

## 2. API Endpoints (7 total)

All endpoints require an `X-API-Key` header. All requests are `POST` with JSON body. All responses are JSON unless otherwise noted.

### 2.1 `POST /v1/screenshot`
**Purpose:** Render a URL and return a PNG or JPEG image.

| Parameter | Type | Description |
|---|---|---|
| `url` | string | Target URL (required) |
| `width` | int | Viewport width (default: 1280) |
| `height` | int | Viewport height (default: 800) |
| `format` | string | `png` or `jpeg` (default: `png`) |
| `quality` | int | JPEG quality 1-100 (default: 80) |
| `wait` | string | `networkidle`, `load`, `domcontentloaded`, or `N` ms |
| `full_page` | bool | Capture full scrollable height (default: false) |
| `region` | string | `us`, `eu`, `apac`, `any` (default: `any`) |

Response: `{ "url": "https://cdn.swarmbrowser.io/results/abc123.png", "width": 1280, "height": 800, "took_ms": 1423 }`

### 2.2 `POST /v1/pdf`
**Purpose:** Render a URL and return a PDF document.

| Parameter | Type | Description |
|---|---|---|
| `url` | string | Target URL (required) |
| `format` | string | Paper format: `A4`, `Letter`, etc. (default: `A4`) |
| `landscape` | bool | Landscape orientation (default: false) |
| `margin` | object | `{ top, bottom, left, right }` in px or cm |
| `print_background` | bool | Include CSS background colors/images (default: true) |
| `region` | string | Same as screenshot |

Response: `{ "url": "https://cdn.swarmbrowser.io/results/abc123.pdf", "pages": 3, "took_ms": 2100 }`

### 2.3 `POST /v1/scrape`
**Purpose:** Render a URL and extract structured content via CSS selectors or XPath.

| Parameter | Type | Description |
|---|---|---|
| `url` | string | Target URL (required) |
| `selectors` | object | Key-value map: `{ "title": "h1", "price": ".price-tag" }` |
| `extract_text` | bool | Also return full rendered text content (default: false) |
| `extract_links` | bool | Also return all `<a href>` links (default: false) |
| `extract_meta` | bool | Also return all `<meta>` tags (default: false) |
| `wait` | string | Same as screenshot |
| `region` | string | Same as screenshot |

Response: `{ "data": { "title": "Product Name", "price": "$49.99" }, "links": [...], "took_ms": 980 }`

### 2.4 `POST /v1/batch`
**Purpose:** Submit N URLs for parallel processing. All run simultaneously across the browser pool.

| Parameter | Type | Description |
|---|---|---|
| `urls` | string[] | Array of URLs (max 1,000) |
| `action` | string | `screenshot`, `pdf`, or `scrape` |
| `options` | object | Action-specific options (same params as individual endpoints) |
| `webhook_url` | string | POSTed to when all results are ready (optional) |

Response: `{ "job_id": "j_abc123", "total": 250, "status": "queued", "poll_url": "/v1/jobs/j_abc123" }`

Results retrieved via `GET /v1/jobs/{job_id}` or via webhook.

### 2.5 `POST /v1/compare`
**Purpose:** Render the same URL from M different geographic regions and diff the HTML/screenshots.

| Parameter | Type | Description |
|---|---|---|
| `url` | string | Target URL (required) |
| `regions` | string[] | Regions to compare: `["us", "eu", "apac"]` |
| `action` | string | `screenshot` or `scrape` (default: `screenshot`) |
| `diff_threshold` | float | Pixel diff threshold for screenshots (default: 0.05) |

Response: `{ "results": { "us": {...}, "eu": {...}, "apac": {...} }, "diffs": { "us_vs_eu": { "pixel_diff_pct": 12.3, "diff_url": "..." } } }`

Use case: detect geo-blocking, regional CDN failures, price discrimination.

### 2.6 `POST /v1/diff`
**Purpose:** Render two different URLs and diff the visual output or extracted content.

| Parameter | Type | Description |
|---|---|---|
| `url_a` | string | First URL |
| `url_b` | string | Second URL |
| `action` | string | `screenshot` or `scrape` |
| `region` | string | Region to render both from (default: `any`) |

Response: `{ "url_a": {...}, "url_b": {...}, "diff": { "pixel_diff_pct": 8.7, "diff_url": "..." } }`

Use case: verify A/B test variants differ as expected; compare staging vs production.

### 2.7 `POST /v1/record`
**Purpose:** Capture a full HAR (HTTP Archive) and Playwright trace for a multi-step user flow.

| Parameter | Type | Description |
|---|---|---|
| `steps` | object[] | Array of `{ action, selector, value }` — click, fill, navigate, wait |
| `start_url` | string | Starting URL |
| `region` | string | Region to run from |

Response: `{ "har_url": "...", "trace_url": "...", "screenshots": [...], "took_ms": 8200 }`

HAR contains all network requests. Trace is a Playwright trace viewable in trace.playwright.dev.

---

## 3. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Browser engine | Playwright + Chromium (primary), Firefox, WebKit | Industry standard, handles modern SPAs, shadow DOM, SSR |
| Job queue | Redis (BullMQ) | Durable queues, priority, retry, delay, job TTL |
| Metadata store | PostgreSQL | Job state, customer keys, billing, results manifest |
| Result storage | MinIO (S3-compatible) | Self-hosted, no egress fees, compatible with existing k3s infra |
| API gateway | k8s Ingress (nginx) + Cloudflare Tunnel | TLS termination, WAF, DDoS protection, no public IP needed |
| Order service | Node.js (TypeScript) | Validates API key, debits credits, enqueues job |
| Browser worker | Node.js + Playwright | Dequeues jobs, launches browser, executes task, uploads result |
| HPA trigger | CPU + custom BullMQ queue-depth metric | Scale workers when queue depth > threshold |
| CDN | Cloudflare R2 or existing MinIO + signed URLs | Customer downloads results via pre-signed URLs |

---

## 4. Architecture

### High-Level Data Flow

```
Customer
    │
    │  POST /v1/screenshot  (HTTPS + X-API-Key)
    ▼
Cloudflare Tunnel + WAF
    │
    │  Forwards to k8s Ingress
    ▼
┌─────────────────────────────────────┐
│         Order Service               │
│  (Node.js, 2-5 pods, Deployment)    │
│                                     │
│  1. Validate API key (Redis lookup) │
│  2. Check credits / tier            │
│  3. Enqueue job to Redis (BullMQ)   │
│  4. Return job_id + poll_url        │
└─────────────────────────────────────┘
    │
    │  Job enqueued with priority + region preference
    ▼
┌─────────────────────────────────────┐
│         Redis (BullMQ)              │
│  Queues: screenshot, pdf, scrape,   │
│          batch, compare, diff,      │
│          record                     │
│  Priority: Pro > Free               │
│  TTL: jobs expire after 24h if      │
│        not picked up                │
└─────────────────────────────────────┘
    │
    │  Workers poll queue
    ▼
┌─────────────────────────────────────┐
│      Browser Worker Pool            │
│  (5-100 pods, HPA-managed)          │
│                                     │
│  Each pod:                          │
│  - Dequeues 1 job                   │
│  - Launches Playwright browser      │
│  - Executes: navigate, wait, action │
│  - Uploads result to MinIO          │
│  - Updates job state in PostgreSQL  │
│  - Marks job complete in BullMQ     │
│                                     │
│  Pool config per pod:               │
│  POOL_SIZE=3 browsers               │
│  MAX_USES=200 (recycle after)       │
│  IDLE_TIMEOUT=300s                  │
└─────────────────────────────────────┘
    │                      │
    ▼                      ▼
┌───────────┐    ┌──────────────────────┐
│  MinIO    │    │  PostgreSQL          │
│  (results)│    │  (metadata)          │
│           │    │                      │
│  /results │    │  jobs table:         │
│  /diffs   │    │  id, status, api_key │
│  /hars    │    │  result_url, took_ms │
│  /traces  │    │  created_at, region  │
└───────────┘    └──────────────────────┘
    │
    │  Pre-signed URL (15 min TTL)
    ▼
┌─────────────────────────────────────┐
│  Customer                           │
│  - Polls GET /v1/jobs/{id}          │
│  - OR receives webhook POST         │
│  - Downloads result from signed URL │
└─────────────────────────────────────┘
```

### Regional Architecture (Phase 4+)

```
Customer (EU)               Customer (APAC)
    │                           │
    ▼                           ▼
Cloudflare (anycast)     Cloudflare (anycast)
    │                           │
    ▼                           ▼
k3s Frankfurt nodes      k3s Singapore nodes
(Order Service)          (Order Service)
    │                           │
    └──────────┬────────────────┘
               ▼
        Redis (central or
        replicated per region)
               │
    ┌──────────┴────────────────┐
    ▼                           ▼
Frankfurt Workers         Singapore Workers
(Chromium, EU IPs)        (Chromium, APAC IPs)
```

Workers in each region process jobs with matching `region` tag first. Cross-region overflow: a job tagged `eu` that can't be picked up in 30s overflows to `any`.

---

## 5. Pricing Model

### Monthly Tiers

| Tier | Price | Pages/month | Concurrent browsers | Regions |
|---|---|---|---|---|
| Free | $0 | 500 | 1 | 1 (US) |
| Starter | $19.37 | 10,000 | 5 | All 4 |
| Pro | $97.53 | 100,000 | 25 | All 4 |
| Enterprise | Custom | Unlimited | 100+ | Custom |

Prices in USDC. Settlement via Opsalis 95/5 model (5% immutable royalty deducted from operator earnings).

### Overage Pricing

| Action | Overage rate |
|---|---|
| Screenshot | $0.001/page |
| PDF | $0.002/page |
| Scrape | $0.001/page |
| Batch | Same per-page rate × N |
| Compare (M regions) | Per-page rate × M |
| Diff | 2× screenshot rate |
| Record / HAR | $0.010/session |

### Credit System (Phase 3+)

Each tier includes a monthly credit bucket. Credits consumed:
- 1 credit = 1 screenshot or 1 scrape
- 2 credits = 1 PDF
- 1 credit × M = compare across M regions
- 10 credits = 1 HAR recording session

Credits roll over up to 2× monthly allowance.

---

## 6. Competitor Pricing Comparison

| Competitor | Entry Paid Tier | What You Get | Our Starter ($19.37) Comparison |
|---|---|---|---|
| **Browserless.io** | $25/mo (annual) | 20K units/mo, 15 concurrent, 15-min sessions | Cheaper; 10K pages is comparable but we include region selection |
| **Browserless.io Starter** | $140/mo (annual) | 180K units/mo, 40 concurrent | Our Pro at $97.53 undercuts significantly; 100K pages vs 180K units (units ≠ pages due to Browserless billing complexity) |
| **Apify Starter** | $29/mo | $8/GB proxy, 32GB Actor memory, cloud compute | Different model (actor compute vs page renders); comparable price point, we are simpler to price |
| **ScrapingBee Freelance** | $49/mo | Credits for ~10K simple requests (1 credit each) or ~2K JS-rendered (5 credits each) | Our $19.37 is 60% cheaper for JS-rendered pages, which is all we do |
| **BrightData Web Scraper** | $1.50/1K records PAYG or $499/mo for 384K | Full proxy network, CAPTCHA solving, parsing | BrightData is infrastructure + scraping combined; we are browser-only. BrightData wins for proxy diversity, we win on price for simple rendering jobs |

**Verdict:** We are the cheapest headless browser API at every tier. Our differentiation is geographic rendering + USDC payment + Opsalis marketplace distribution.

---

## 7. Sharding for 1,000 Browsers

### Shard Strategy

At scale, browser pods are sharded across k3s nodes in multiple regions. Each shard processes jobs for its designated region tag.

```
Global Queue (Redis)
├── queue:screenshot:us      → US worker pods (Canada + any US-flagged nodes)
├── queue:screenshot:eu      → EU worker pods (Frankfurt, UK)
├── queue:screenshot:apac    → APAC worker pods (Singapore)
├── queue:screenshot:any     → Any available worker (global overflow)
└── queue:batch              → Dedicated high-throughput queue
```

**Scaling math:** 1 browser instance takes ~2s to screenshot a typical page. With 5 browsers per pod and 200 pods = 1,000 browsers = 500 screenshots/second peak capacity. At average job size 2s and 5 browsers/pod, that is 2.5 pages/second per pod or 2,500 pages/second at 1,000 pod capacity.

**HPA trigger:** When `queue_depth / worker_count > 5` (i.e., each worker has more than 5 jobs waiting), HPA fires. Scale-up takes ~60s (pod start + Playwright install). This is acceptable because batch jobs are async; real-time jobs (single URL) get priority queue slots that are always served by standing pods.

### Priority Queues

```
Priority 10 (highest): Pro + Enterprise single-URL requests
Priority 5:            Free + Starter single-URL requests
Priority 3:            Batch jobs (any tier)
Priority 1:            Background compare/diff jobs
```

BullMQ supports native priority. Standing minimum pods (never scaled to zero) = 5 pods across at least 2 regions, always-ready for synchronous requests.

---

## 8. API Key Management

### Key Generation

Keys are generated at signup (or via self-service API). Format: `sb_live_<48 hex chars>` (production), `sb_test_<48 hex chars>` (sandbox).

Keys are stored SHA-256 hashed in PostgreSQL. The raw key is shown once at creation via the dashboard. Lost keys require rotation (new key issued, old key 48h grace period).

### Rate Limiting (per key)

| Tier | Max requests/min | Max concurrent browser sessions |
|---|---|---|
| Free | 10 | 1 |
| Starter | 60 | 5 |
| Pro | 300 | 25 |
| Enterprise | Custom | Custom |

Rate limiting enforced in the Order Service via Redis atomic counters (`INCR` + `EXPIRE`). Key revocation is immediate: Order Service deletes key from Redis cache; next request fails auth.

### Key Rotation Flow

1. Customer requests rotation via dashboard
2. New key generated, stored alongside old key with status `rotating`
3. Old key remains valid for 48h (grace period for updating integrations)
4. After 48h, old key status set to `revoked`
5. All subsequent requests with old key return 401 with `key_rotated` error code

---

## 9. Security

### Customer Data Isolation

Each browser job runs in an isolated Playwright context (incognito-equivalent). No cookies, localStorage, or session data persist between jobs. Between jobs from the same customer, browser profiles are wiped. Browser processes are containerized; no filesystem access outside the Playwright temp directory.

### Container Sandboxing

Chromium requires `--no-sandbox` to run inside containers (kernel namespace restrictions). Mitigation: each browser worker pod runs in its own Linux namespace with `seccomp` profile restricting dangerous syscalls. Pod `securityContext` sets `runAsNonRoot: true`. No privileged containers.

### Output Sanitization

Screenshots and PDFs are binary blobs — no HTML or scripts are returned to customers. Scrape JSON responses are serialized data only; no executable content. Pre-signed MinIO URLs have 15-minute TTL and are customer-scoped.

### Rate Limits and DDoS

Cloudflare WAF sits in front of all ingress. Per-key rate limits enforced in Order Service. Global burst protection: if aggregate queue depth exceeds 10,000 pending jobs, new submissions receive 503 with `Retry-After` header. This protects the queue from thundering-herd attacks.

### Blocked URL Categories

The Order Service maintains a blocklist of reserved IP ranges (RFC 1918, link-local, loopback). Requests to `localhost`, `169.254.x.x`, `10.x.x.x`, `192.168.x.x` are rejected to prevent SSRF attacks.

---

## 10. Cost Model

### Infrastructure (at launch, Phase 1-2)

| Resource | Spec | Monthly cost |
|---|---|---|
| 5 always-on browser pods | 2 vCPU, 3GB RAM each, across existing k3s nodes | ~$30 (marginal, existing nodes) |
| Redis (BullMQ) | 512MB Redis pod, existing k3s | ~$0 (existing) |
| PostgreSQL | Shared with other products on existing k3s node | ~$0 (existing) |
| MinIO | Shared with existing MinIO; result storage 50GB | ~$1/mo (existing MinIO) |
| Cloudflare Tunnel | Existing tunnel | $0 |
| **Total Phase 1** | | ~$31/mo |

### At Scale (Phase 4-5, 100 pods burst)

| Resource | Cost |
|---|---|
| 100 burst pods × 2 vCPU burst (spot/burstable) | ~$100/mo amortized |
| Redis cluster (HA, 3 nodes) | ~$15/mo |
| PostgreSQL (managed or dedicated pod) | ~$10/mo |
| MinIO storage (1TB results, rotated) | ~$10/mo |
| Bandwidth (result downloads) | ~$20/mo |
| **Total burst capacity** | ~$155/mo |

### Revenue vs Cost

At 100 paying Starter customers ($19.37 × 100 = $1,937/mo) with ~$155/mo infrastructure: **92% gross margin**. Target 70% margin is comfortably exceeded. Scale model holds because Playwright workers are stateless and horizontally scalable at low per-pod cost.

---

## 11. Implementation Phases

This section is the contract for future coding sessions. Each phase is a self-contained deliverable.

### Phase 1 — Proof of Concept (Estimate: 1 session, ~200 lines)

**Goal:** Single Docker container, single endpoint, no queue, no auth.

**Deliverables:**
- `backend/worker/index.ts` — Express + Playwright, handles `POST /v1/screenshot` only
- `backend/worker/Dockerfile` — Node 22 + Playwright + Chromium
- Manual test: `curl -X POST http://localhost:3500/v1/screenshot -d '{"url":"https://example.com"}' → PNG`

**No:** Redis, PostgreSQL, auth, HPA, MinIO. Result returned inline as base64.

**Definition of done:** Screenshot of example.com returned in <5s from a local Docker container.

### Phase 2 — Full Endpoint Suite + Queue (Estimate: 2 sessions)

**Goal:** All 7 endpoints, Redis queue, 5 worker pods, results stored in MinIO.

**Deliverables:**
- `backend/order-service/` — Express, validates key (hardcoded for now), enqueues to Redis
- `backend/worker/` — BullMQ consumer, all 7 endpoint handlers
- `backend/worker/screenshot.ts`, `pdf.ts`, `scrape.ts`, `batch.ts`, `compare.ts`, `diff.ts`, `record.ts`
- `backend/db/schema.sql` — PostgreSQL jobs table
- MinIO bucket creation + upload logic
- `GET /v1/jobs/{id}` polling endpoint
- k3s Deployment YAML for order-service + worker (5 replicas)
- k3s Service + Ingress YAML

**Definition of done:** All 7 endpoints functional, batch of 10 URLs completes, results retrievable from MinIO URL.

### Phase 3 — Auth, Billing Hook, HPA (Estimate: 1 session)

**Goal:** Real API keys, credit metering, HPA scaling.

**Deliverables:**
- `backend/auth/` — Key validation against PostgreSQL, Redis cache layer
- `backend/metering/` — Credit deduction per action type, tier enforcement
- Key management dashboard page (integrate with existing Sertone panel pattern)
- HPA manifest: `autoscaling/v2`, CPU + custom BullMQ queue-depth metric via Prometheus adapter
- Webhook delivery for async batch jobs
- Rate limiting middleware (Redis INCR)

**Definition of done:** Free key gets 429 at limit. Pro key scales to 25 concurrent. HPA scales worker pods from 5 to 15 under synthetic load.

### Phase 4 — Multi-Region Deployment + Compare/Diff (Estimate: 1 session)

**Goal:** Workers deployed across all 4 k3s regions. Compare and diff endpoints functional.

**Deliverables:**
- Region-tagged BullMQ queues (`:us`, `:eu`, `:apac`, `:any`)
- Node affinity rules per region in worker Deployment YAML
- Image diff logic (pixelmatch library or similar, pure Node.js)
- HTML diff logic for scrape compare
- Cloudflare geo-routing configuration (route customers to nearest ingress)

**Definition of done:** `POST /v1/compare` with `regions: ["us", "eu"]` returns two screenshots from different IPs + pixel diff percentage.

### Phase 5 — 1,000-Browser Scale, Advanced Features (Estimate: 2 sessions)

**Goal:** Stress-tested at 500 pages/sec, advanced recording, enterprise features.

**Deliverables:**
- Load test suite (k6 scripts in `test-bench/`)
- Priority queue tuning (Pro vs Free vs batch)
- Playwright trace viewer integration (serve trace files)
- Browser pool recycling optimization (MAX_USES tuning)
- Result CDN via Cloudflare R2 (optional — MinIO + signed URLs may be sufficient)
- Enterprise key management (org-level keys, sub-keys per project)
- BYOB (Bring Your Own Browser) — customer specifies user-agent, viewport, locale, timezone
- Metrics dashboard page showing: jobs/minute, p50/p95 latency, cache hit rate, error rate

**Definition of done:** k6 test of 1,000 concurrent batch URLs completes in <120s with <1% error rate. All Playwright traces viewable.

---

## 12. Open Questions for Founder Review

Before Phase 1 coding begins, confirm:

1. **Browser engines:** Chromium only for Phase 1-3, or add Firefox/WebKit from the start?
2. **Result retention:** How long do we keep result files in MinIO? Suggested: 24h for Free, 7 days for Starter, 30 days for Pro.
3. **Sync vs async:** Should single-URL screenshot/PDF/scrape be synchronous (response waits, max 30s) or always async (job_id returned, poll for result)? Recommendation: sync up to 30s, async fallback for slow pages.
4. **IP diversity:** For compare/diff to work meaningfully, workers in each region need IPs that CDNs recognize as being in that region. k3s nodes in Frankfurt = EU IP, Singapore = APAC IP. This works if we own the nodes. Confirm node locations.
5. **USDC billing:** Integrate billing hook directly with Sertone RouterV4 (existing settlement), or implement separate USDC billing for SwarmBrowser? Recommendation: use existing Sertone settlement + Opsalis marketplace distribution.
