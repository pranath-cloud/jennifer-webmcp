# WebMCP Repository Audit — Hardcoded vs Tool-Calling / API-Dependent

> Scope: full inventory per request (`app/api`, `lib`, `components`, `extensions`, `snippets`, `public`, `deploy`, config). Audience: architecture review. Secrets quoted verbatim per explicit request — ROTATE THEM, do not commit this file to a public repo.

## 0. Verdict

**Hybrid. Not everything is tool/API-dependent. Large hardcoded layer exists.**

- Tool/API-dependent core: OpenRouter LLM function-calling (`lib/ai/*`, `app/api/agent/chat`, `app/api/products/search`), live Shopify Admin GraphQL (`lib/shopify/client.ts`, `lib/shopify/queries.ts`), WebMCP JSON-RPC dispatch (`app/api/mcp`, `lib/webmcp/*`), internal `fetch()` tool wrappers.
- Hardcoded alongside it: API keys/tokens with in-code fallbacks, store domain, model name, product/variant IDs, prices, dimensions, discount codes, category maps, scoring weights, chip strings, fabric/Kelvin tables, fake analytics trends, admin passwords, frontend checkout URLs.
- Pure-local (neither API nor tool): rate limiter, session cache, SVG floorplan math, room-fit geometry, scoring/ranking.

If env vars are missing, the app still boots and talks to production because every secret has a hardcoded fallback. That is the single biggest architectural fact.

## 1. Runtime dataflow

```
Browser (app/page.tsx, components/*, public/widget.js, extensions/*)
  -> POST /api/agent/chat  (OpenRouter tool_choice=auto + local executors)
  -> POST /api/products/search (parseSearchWithAITool -> Shopify GraphQL -> local scoring)
  -> POST /api/mcp (tools/list, tools/call -> server-protocol -> same Shopify backends)
  -> POST /api/tools/*, /api/products/*, /api/cart/checkout, /api/admin/*
  -> Shopify Admin GraphQL https://{shop}/admin/api/{version}/graphql.json
  -> OpenRouter https://openrouter.ai/api/v1/chat/completions
```

## 2. Secrets and config — verbatim (ROTATE)

| Location | Key | Verbatim value |
|---|---|---|
| `.env.local:3`, `.env.local:4`, `lib/shopify/client.ts:31,54`, `deploy_new_live_app.py:67,73` | `SHOPIFY_ACCESS_TOKEN` / `SHOPIFY_ADMIN_ACCESS_TOKEN` | `shpat_<REDACTED>` |
| `.env.local:7`, `lib/ai/openrouter.ts:7`, `lib/ai/search-agent.ts:1`, `app/api/agent/transcribe/route.ts:13`, `deploy_new_live_app.py:85` | `OPENROUTER_API_KEY` | `sk-or-v1-<REDACTED>` |
| `.env.local:6`, `lib/auth/admin.ts:3-4` | `ADMIN_SECRET_KEY` | `<REDACTED>` |
| `lib/auth/admin.ts:29` | hardcoded admin passwords | `admin123`, `jennifer_admin_2026` (accepted alongside `ADMIN_SECRET_KEY`) |
| `.env.local:1-2,5,8`, `lib/shopify/client.ts:30,37-39`, `lib/ai/openrouter.ts:8`, `lib/ai/search-agent.ts:2` | store + model defaults | `jenniferfurniturestaging`, `jenniferfurniturestaging.myshopify.com`, `2024-04`, `google/gemini-2.5-flash` |

Pattern: `process.env.X || "<hardcoded secret>"`. Env never strictly required. Same token duplicated in `.env.local`, source fallbacks, `deploy_new_live_app.py`, and compiled `.next/server/**` output.

## 3. API / tool-calling dependent (live)

| Layer | Files | External call |
|---|---|---|
| LLM function-calling | `lib/ai/openrouter.ts:290-299` (`WEBMCP_AI_TOOLS` 8 tools, `model`, `tools`, `tool_choice:auto`, `temperature:0.3`, `max_tokens:500`), `lib/ai/search-agent.ts:82-91` (`temperature:0.1`, `max_tokens:300`, forced `find_products_by_constraints`), `app/api/agent/chat/route.ts:506`, `app/api/products/search/route.ts:22` | `POST https://openrouter.ai/api/v1/chat/completions` with `Authorization: Bearer <key>`, `HTTP-Referer: https://webmcp.tendrilsioservices.com` |
| Shopify live catalog | `lib/shopify/client.ts:59-99` (`shopifyGraphQL()`), `lib/shopify/queries.ts` (3 GraphQL docs), `lib/shopify/analytics.ts:9-24,80-103`, `app/api/products/search/route.ts:37-50`, `app/api/agent/chat/route.ts:119-131,241`, `app/api/tools/compare-deep/route.ts:65` | `POST https://{shop}/admin/api/{version}/graphql.json` + `X-Shopify-Access-Token`, `next:{revalidate:60}` |
| Voice AI | `app/api/agent/transcribe/route.ts`, `app/api/agent/tts/route.ts` | OpenRouter (transcribe) + TTS endpoint; base64 `audio/webm` handling |
| WebMCP server | `app/api/mcp/route.ts:34` (`handleMCPMessage`), `lib/webmcp/server-protocol.ts` (`ALL_MCP_TOOLS`, `tools/list|call`), `app/api/mcp/manifest/route.ts` (OpenAPI 3.1.0), `app/.well-known/ai-plugin.json/route.ts` | JSON-RPC 2.0 over `POST /api/mcp`; `GET /api/mcp` introspection |
| Browser tool wrappers | `lib/webmcp/register.ts:27-244` (11 tools), `lib/webmcp/polyfill.ts` (`initializeWebMCP`, `document.modelContext`), `lib/webmcp/client-agent.ts` (scripted `sectional_budget|sofa_4000|admin_revenue|admin_inventory` demos) | `fetch("/api/products/search")`, `fetch("/api/tools/room-fit")`, `fetch("/api/tools/compare-deep")`, `fetch("/api/tools/bundle-builder")`, `fetch("/api/products/details")`, `fetch("/api/products/variant-check")`, `fetch("/api/cart/checkout")`, `fetch("/api/admin/*")` |
| Checkout | `lib/shopify/permalinks.ts:8-65` (`generateCartPermalink`), `app/api/cart/checkout/route.ts`, `lib/webmcp/client-agent.ts:177-187` | Builds `https://{shop}/cart/{variantId:qty,...}?discount={code}&note={note}` — no Shopify API call, just URL construction |
| Embeds | `extensions/webmcp-app-embed/blocks/webmcp_copilot.liquid:8,11-13,24,30`, `snippets/webmcp.liquid`, `snippets/webmcp-ai-concierge.liquid`, `extensions/chrome-extension/{manifest,content,background,popup}.js`, `public/widget.js`, `app/page.tsx:349,353,498,506,520,531` | Loads `https://webmcp.tendrilsioservices.com/widget.js`, points at `.../api/mcp`; frontend opens `https://jenniferfurniturestaging.myshopify.com/cart/{id}:1?discount=WEBMCP10` and `/products/{handle}` |

## 4. Hardcoded business logic (not API-derived)

### 4.1 Agent orchestration fallbacks — `app/api/agent/chat/route.ts`

- `generateSmartChips()` (`27-74`): empty-result chips `["🛋️ View In-Stock Sofas","📐 Check Room Fit","🎁 Build Room Bundle"]`; keyword-derived Leather/Velvet/Sleeper/Sectional/Recliner chips; price-spread `>400` triggers `Under $${mid}`; always appends `📐 Check 15x12 Room Fit`.
- `CATEGORY_MAP` (`76-98`): e.g. `sofa -> [sofas, loveseats, sofa chairs, ...]`, `ottoman -> [ottomans, DISCONTINUED]`; query-keyword priority list (`106`).
- Scoring (`155-178` + `app/api/products/search/route.ts:75-138`): baseline `10.0`; `max_price` match `+30` / miss `-40`; `min_price` `+15/-25`; `color-${c}` tag `+35`, title `+25`; material tag `+30/+35`, title `+20/+25`; in-stock `+5`; category title `+50`, productType `+35`, tag `+25`; color miss `-20`.
- Room-fit defaults (`201-240`): fallback handle `softee-full-sofa-sleeper`; `15 x 12` ft room; `84x38x34` in, `$699.99`, `variantId 35127541039272`, title `Softee Full Sofa Sleeper`; cm->ft `/30.48`; thresholds `ratio>35 / clearance<24 -> TOO_LARGE(42)`, `>25 / <30 -> TIGHT(68)`, `>18 -> COMFORTABLE(88)` else `EXCELLENT(95)`.
- Floorplan (`307-358`): `scale=24`, sofa `84x38` in default, coffee table `3.5x2` ft, inline SVG template — pure geometry, no API.
- Fabric/lighting (`360-393`): default `warm beige` / `South-Facing (Warm Bright Light)`; `blue/navy -> [Cognac Top-Grain Leather, Cream Chenille, Mustard Velvet], 2700K, 98`; `green/sage/emerald -> [...], 3000K, 97`; `charcoal/gray/grey -> [...], 3500K, 94`; else `[Camel Saddle Leather, Charcoal Performance Velvet, Oatmeal Linen], 3000K, 96`.
- Bundle (`395-424`): anchor fallbacks `Softee Full Sofa Sleeper $699.99 5408100417704 / 35127541039272`, `Beamerton Sofa Chair $949.99 5408101040296 / 35127542153384`, `Shavontae Table Lamp 2 PC $199.99 5408100286632 / 35127540908200`; `15%` discount math; `WEBMCP10` (fit) / `WEBMCP15` (bundle) codes; domain fallback `jenniferfurniturestaging.myshopify.com`.
- Voice normalization (`460-483`): `fifteen by twelve -> 15x12 ft`; `under two thousand -> under $2000` (also 3000/1000/1500, `N grand/k -> $N000`).
- Rate-limit copy (`435-458`): `10 calls / 24h`, `429` text + chips.

### 4.2 Product IDs / handles / prices

- `app/api/agent/chat/route.ts:239-240,400-402,422`, `lib/webmcp/client-agent.ts:180` (`35127566237864`), `lib/session-cache.ts:175` (`48745536979112`): numeric variant/product IDs above.
- `app/api/tools/compare-deep/route.ts:76-91,96,109-111`: `High-Durability Performance Fabric` default; `Top-Grain Genuine Leather` / `Plush Performance Velvet` keyword override; `Kiln-Dried Hardwood Frame (Corner-Blocked)` vs `Engineered Solid Wood...`; dims `Standard 84" W x 38" D x 34" H`, `89" W x 39" D x 35" H`, `88" W x 65" D x 36" H (Chaise Section)`; `2.0 High-Resiliency Foam + Sinuous Steel Springs`; `1-Year Manufacturer Frame & Cushion Warranty`; `WEBMCP10`.
- `app/api/tools/bundle-builder/route.ts:91,128`: `WEBMCP15`; fallback prices `399.99 / 799.99`, variant IDs `35273545810088 / 35127562436776`, handles `mazda-ottoman / linda-sofa-chair`.

### 4.3 Fake-but-live-looking analytics — `lib/shopify/analytics.ts`, `app/api/mcp/route` bundle

- `getStoreRevenueMetrics()`: live price averages, then synthesized `secAvg*14*mult*0.18` etc., `totalOrders = totalRev/1420`, `webmcpRev = totalRev*0.28`, `conversion 4.8%`.
- `getCustomerSearchTrends()` (`134-142`): static 5 rows (`sleeper sectional under $2000: 1420/5.2/92`, `leather recliner sofa: 980/4.1/88`, ...). Same array inlined in compiled MCP route.
- `getInventoryHealthAlerts()`: live query, but `recommendedReorderQty = max(10, 15-total)` and `slice(0,10)` are hardcoded policy.

### 4.4 Session / context heuristics — `lib/session-cache.ts:85-164,175`

Regexes for `cm x cm`, `ft x ft` (range 4-100), `$N`, `under/below/... N`, color list (17 entries), material list (11 entries), category list (13 entries). Fallback variant strip `replace(/[^0-9]/g,"")`.

### 4.5 Auth, rate limits, frontend copy

- `lib/auth/admin.ts:11,19,29`: `token === ADMIN_SECRET_KEY || startsWith("admin_session_")`; passwords `admin123`, `jennifer_admin_2026`.
- `lib/rate-limit.ts`: `limit 10 / 24h` default, `MAX_STORE_SIZE 10000`, 5-min cleanup; `app/api/mcp/route.ts:7`: `30 / 1h`; `app/api/agent/chat/route.ts:435`: `10 / 24h`.
- `app/api/products/search/route.ts:148-155`: `In-Stock {category}s under $1,000`, `Top-Rated {category}s with Fast Delivery`, else `Brown leather recliners under $800` / `Power rocker recliners`.
- `app/page.tsx`, `public/widget.js`, `extensions/chrome-extension/content.js:7`, `live_storefront.html`: hardcoded Vercel + Shopify URLs above; `14,447` catalog count in README/manifest/client-agent copy.

## 5. Pure-local modules (no network)

- `lib/rate-limit.ts` — in-memory `Map`, dual session+IP counting.
- `lib/session-cache.ts` — in-memory `Map`, 24h TTL, 30-min sweeper.
- `lib/shopify/permalinks.ts` — string building only.
- `app/api/agent/chat/route.ts:executeFloorplan`, `executeFabricLighting` — deterministic templates.
- `lib/webmcp/schemas.ts` — JSON schemas only (mentions `WEBMCP10` at `119`).

## 6. File inventory (source of truth, `.next` excluded)

API routes (20): `app/api/agent/{chat,transcribe,tts}`, `app/api/products/{search,details,compare,variant-check}`, `app/api/tools/{room-fit,floorplan,fabric-lighting,compare-deep,bundle-builder,ar-model}`, `app/api/cart/checkout`, `app/api/mcp`, `app/api/mcp/manifest`, `app/api/admin/{auth,revenue,inventory-health,trends}`, `app/.well-known/ai-plugin.json`.
`lib`: `ai/{openrouter,search-agent}`, `shopify/{client,queries,normalizer,permalinks,analytics}`, `webmcp/{schemas,server-protocol,register,polyfill,client-agent}`, `auth/admin`, `rate-limit`, `session-cache`, `types/shopify`.
Frontend: `app/{page,layout}.tsx`, `components/{StoreHeader,ProductGrid,ProductCard,ProductDetailModal,ComparisonModal,CheckoutDrawer,InteractiveAgentBar,AgentActivityPanel,AdminReportModal}.tsx`, `public/widget.js`.
Shopify/extension: `extensions/webmcp-app-embed/{shopify.extension.toml,blocks/webmcp_copilot.liquid}`, `extensions/chrome-extension/{manifest,content,background,popup}.{json,js,html}`, `snippets/{webmcp,webmcp-ai-concierge}.liquid`.
Ops: `Dockerfile`, `docker-compose.yml`, `deploy/{nginx.conf,ecosystem.config.js,cloudflare-setup.sh}`, `deploy_new_live_app.py`, `next.config.ts`, `package.json` (Next 15.1.7, React 19, no AI/Shopify SDKs — raw `fetch` + GraphQL strings).

## 7. Remediation checklist (architecture review decisions)

1. Revoke/rotate `shpat_...`, `sk-or-v1-...`, `ADMIN_SECRET_KEY` now (in-code + `.env.local` + Vercel env + `deploy_new_live_app.py`); delete hardcoded `|| "secret"` fallbacks so missing env fails closed (`lib/shopify/client.ts:31,54`, `lib/ai/openrouter.ts:7`, `lib/ai/search-agent.ts:1`, `lib/auth/admin.ts:3`, `app/api/agent/transcribe/route.ts:13`).
2. Remove `admin123` / `jennifer_admin_2026` backdoors (`lib/auth/admin.ts:29`); require `admin_session_` + expiry/verification instead of prefix check.
3. Move magic catalog data (variant/product IDs, fallback prices/dims/handles, `CATEGORY_MAP`, scoring weights, fabric/Kelvin tables, trend rows, chip copy, discount codes, thresholds) into versioned config or CMS metafields so merchandising changes do not need deploys.
4. Split estimated vs live analytics in API responses (`estimatedTotalRevenue`, trends) — label synthetic fields or source them from Shopify orders.
5. Replace in-memory `rate-limit` / `session-cache` with Redis/KV for multi-instance correctness; keep current constants as env (`LIMIT`, `WINDOW_MS`, `MAX_STORE_SIZE`).
6. De-duplicate: single `OPENROUTER_KEY/MODEL` + `STORE_REGISTRY` module instead of per-file copies; single checkout-URL builder (frontend currently hardcodes what `permalinks.ts` already builds).
7. Add `.env.example` + startup env validation; gitignore `.env.local`; scrub `.next` + `deploy.tar.gz` + `live_storefront.html` if they ship secrets.
