# AgentCart — WebMCP for Shopify (Jennifer Furniture)

> **Agent-Native E-Commerce Platform built for the OpenAI WebMCP Challenge**  
> Demonstrating zero-scraping, typed tool invocation, real-time variant stock verification, side-by-side spec comparisons, and direct 1-click Shopify checkout handoffs over the W3C Web Model Context Protocol (`document.modelContext.registerTool`).

---

## 🌟 The Innovation: Why WebMCP?

Today, when an AI shopping agent tries to purchase furniture on standard websites:
* ❌ It parses bloated, unstructured HTML (5MB+ of DOM and scripts).
* ❌ It gets stuck on dynamic swatch pickers, popups, and carousel drawers.
* ❌ It hallucinates out-of-stock items because variant stock is hidden in AJAX payloads.
* ❌ It struggles with checkout handoffs and credit card DOM scraping.

**With AgentCart & WebMCP:**
* ✅ **Zero Scraping:** The website exposes 5 typed JavaScript tools directly to the browser's `document.modelContext`.
* ✅ **Real-Time Variant Stock:** Agents verify exact color, size, and layout inventory before recommending products.
* ✅ **Dimensional & Material Comparison:** Automatically compiles aligned specification matrices from Shopify metafields.
* ✅ **1-Click Checkout Handoff:** Generates direct Shopify Cart Permalinks that transfer the shopping session seamlessly to secure checkout.
* ✅ **Human-in-the-Loop Collaboration:** The user watches live visual UI updates as the agent reasons and executes tools.

---

## 🏗️ Architecture

```
                    ┌───────────────────────────────┐
                    │           AI AGENT            │
                    │  (ChatGPT / Chrome / Tester)  │
                    └───────────────┬───────────────┘
                                    │
                                    │ 1. Discovers tools via document.modelContext
                                    │ 2. Invokes tool with structured JSON
                                    ▼
                 ┌────────────────────────────────────┐
                 │       WEBMCP FRONTEND LAYER        │
                 │      (Jennifer Furniture App)      │
                 │                                    │
                 │ • Polyfill & Tool Registration     │
                 │ • Tool Schemas & Input Validation  │
                 │ • Real-time UI State Synchronizer  │
                 │ • Returns MCP Content Blocks       │
                 └──────────────────┬─────────────────┘
                                    │
                                    │ Internal HTTP POST (/api/products/search, etc.)
                                    ▼
                 ┌────────────────────────────────────┐
                 │     SECURE BACKEND INTEGRATION     │
                 │           (Next.js / Node)         │
                 │                                    │
                 │ • Environment Secret Isolation     │
                 │ • Query Builder (Lucene Syntax)    │
                 │ • Specification & Metafield Parser │
                 │ • Variant Matcher & Permalink Gen  │
                 └──────────────────┬─────────────────┘
                                    │
                                    │ HTTPS GraphQL / Cart Permalinks
                                    ▼
                 ┌────────────────────────────────────┐
                 │       SHOPIFY PLUS STAGING         │
                 │   (jenniferfurniturestaging)       │
                 │                                    │
                 │ • 14,447 Catalog Items             │
                 │ • Real-Time Variant Inventory      │
                 │ • Shopify Checkout Engine          │
                 └────────────────────────────────────┘
```

---

## 🛠️ The 5 WebMCP Capabilities

| Tool Name | Description | Key Inputs | Key Outputs |
| :--- | :--- | :--- | :--- |
| `find_products_by_constraints` | Searches in-stock furniture by category, price bounds, materials, features, and vendor. | `category`, `max_price`, `material`, `features`, `in_stock_only` | `products: [{ id, title, price, inStock, colors }]` |
| `get_product_details` | Fetches deep specs, parsed dimensions, fabric details, and complete variant matrix. | `product_id` / `handle` | `product: { specifications, variants, options, warranty }` |
| `check_variant_availability` | Verifies real-time stock for specific color, size, and layout combinations. | `product_id`, `selected_options: { Color: "Gray" }` | `isAvailable: true, matchedVariant: { id, price, inventoryQuantity }` |
| `compare_products` | Generates an aligned side-by-side comparison matrix across 2–4 products. | `product_ids: ["id1", "id2"]` | `comparisonMatrix: { products, summaryRecommendation, bestValueId }` |
| `create_checkout_handoff` | Converts selected variants into an instant 1-click Shopify Cart Permalink URL. | `items: [{ variant_id, quantity }]`, `discount_code` | `checkoutUrl: "https://...myshopify.com/cart/..."` |

---

## 🚀 Getting Started

### 1. Prerequisites
* Node.js v18+ (tested on Node.js v22)
* Shopify Staging Store credentials (`SHOPIFY_SHOP_NAME`, `SHOPIFY_ACCESS_TOKEN`)

### 2. Setup & Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/agentcart-webmcp.git
cd agentcart-webmcp

# Install dependencies
npm install

# Configure environment variables in .env.local
SHOPIFY_SHOP_NAME=jenniferfurniturestaging
SHOPIFY_ACCESS_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
SHOPIFY_API_VERSION=2024-04
```

### 3. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing the WebMCP Integration

### Method 1: Using the Built-In Agent Playground (Recommended for Judges)
1. Open [http://localhost:3000](http://localhost:3000).
2. Look at the top **Interactive WebMCP Agent Playground** bar.
3. Click the 1-click scenario button: **"Sleeper Sectional under $2k"**.
4. Watch the agent execute the 4-step workflow:
   - **Step 1:** Discovers and calls `find_products_by_constraints`. Product grid updates in real-time.
   - **Step 2:** Calls `compare_products`. Comparison Modal pops up with aligned dimensions and specs.
   - **Step 3:** Calls `check_variant_availability`. Verifies live inventory for the selected color.
   - **Step 4:** Calls `create_checkout_handoff`. Opens the Checkout Drawer with a verified Shopify cart permalink!
5. Click **"Agent Telemetry HUD"** in the top right corner to inspect the live event stream, tool schemas, latency (ms), and JSON payloads.

### Method 2: Inspecting with Browser DevTools / Model Context Tool Inspector
In the browser console:
```javascript
// Check registered tools
console.log(document.modelContext.getRegisteredTools());

// Execute a tool directly via WebMCP
const results = await document.modelContext.executeTool("find_products_by_constraints", {
  category: "sectional",
  max_price: 2000,
  in_stock_only: true
});
console.log(JSON.parse(results.content[0].text));
```

### Method 3: Automated Integration Test Suite
```bash
node test_live_api.mjs
```
Runs all 5 tool endpoints against the live 14,447-product catalog on Shopify staging.

---

## 🛡️ Security & Privacy
* **Zero Secret Leakage:** `SHOPIFY_ACCESS_TOKEN` is never sent to the browser or exposed to AI agents.
* **Read-Only Scopes:** Safe catalog read permissions prevent unwanted modifications to production data.
* **Direct Shopify Checkout:** Financial transactions and payment details are processed exclusively on Shopify's PCI-compliant checkout infrastructure via Cart Permalinks.
