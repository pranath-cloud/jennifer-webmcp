/**
 * AI Search regression battery — hits the deployed /api/products/search and
 * asserts extracted constraints + price compliance of returned products.
 * Covers both the Gemini path (is_predictive:false) and the regex fallback
 * (is_predictive:true, which is what the storefront widget actually calls).
 *
 * Usage:  node scripts/regression-search.mjs [baseUrl]
 * Default baseUrl: https://webmcp.tendrilsioservices.com
 */
const BASE = process.argv[2] || "https://webmcp.tendrilsioservices.com";

const CASES = [
  // The reported bug
  { q: "show me a brown sofa above 5000", shop: "jennifurniture.myshopify.com", min: 5000, color: "brown", cat: "sofa" },
  // Same query on Comfort (control)
  { q: "show me a brown sofa above 5000", shop: "jennifercomfortfurniture.myshopify.com", min: 5000, color: "brown", cat: "sofa" },
  // Max price
  { q: "leather sofa under 2000", shop: "jennifurniture.myshopify.com", max: 2000, material: "leather", cat: "sofa" },
  { q: "recliner under 1500", shop: "jennifercomfortfurniture.myshopify.com", max: 1500, cat: "recliner" },
  // Range
  { q: "sofa between 2000 and 4000", shop: "jennifurniture.myshopify.com", min: 2000, max: 4000, cat: "sofa" },
  // k-suffix
  { q: "sectional under 3k", shop: "jennifurniture.myshopify.com", max: 3000, cat: "sectional" },
  { q: "sofa above 2k", shop: "jennifercomfortfurniture.myshopify.com", min: 2000, cat: "sofa" },
  // Brand
  { q: "bernhardt sectional", shop: "jennifurniture.myshopify.com", brand: "bernhardt" },
  { q: "luonto sleeper", shop: "jennifurniture.myshopify.com", brand: "luonto" },
  // Color/category
  { q: "grey recliner", shop: "jennifurniture.myshopify.com", color: "gray", cat: "recliner" },
  { q: "dining table", shop: "jennifercomfortfurniture.myshopify.com", cat: "table" },
  // Feature
  { q: "power reclining sofa with headrest", shop: "jennifurniture.myshopify.com", cat: "sofa" },
  // Non-furniture gibberish — should not explode
  { q: "hello", shop: "jennifurniture.myshopify.com", expectZeroOrGarbage: true },
  // Real zero-result queries from Comfort telemetry
  { q: "N500092100", shop: "jennifercomfortfurniture.myshopify.com" },                    // SKU lookup
  { q: "can leon sleeper be boought for 24?", shop: "jennifercomfortfurniture.myshopify.com" }, // price artifact + typo
  { q: "show me leather sofas under 500", shop: "jennifercomfortfurniture.myshopify.com", max: 500, allowFallback: true },
  { q: "stressless", shop: "jennifercomfortfurniture.myshopify.com", allowFallback: true },     // brand not carried → similar
];

async function search(body) {
  const r = await fetch(`${BASE}/api/products/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function check(c, j, mode) {
  const fails = [];
  const k = j.ai_extracted_constraints || {};
  if (c.min && !(k.min_price >= c.min - 1 && k.min_price <= c.min + 1)) fails.push(`min_price=${k.min_price} want ${c.min}`);
  if (c.max && !(k.max_price >= c.max - 1 && k.max_price <= c.max + 1)) fails.push(`max_price=${k.max_price} want ${c.max}`);
  if (c.color && (k.color || "").toLowerCase() !== c.color) fails.push(`color=${k.color} want ${c.color}`);
  if (c.material && (k.material || "").toLowerCase() !== c.material) fails.push(`material=${k.material} want ${c.material}`);
  if (c.brand && !(k.brand || "").toLowerCase().includes(c.brand)) fails.push(`brand=${k.brand} want ${c.brand}`);
  if (c.cat && !(k.category || "").toLowerCase().includes(c.cat)) fails.push(`category=${k.category} want ${c.cat}`);

  // Every returned product must satisfy a min/max that was extracted —
  // unless a fallback_notice legitimately broadened the result set.
  if (!c.expectZeroOrGarbage) {
    if (!(c.allowFallback && j.fallback_notice)) {
      for (const p of j.products || []) {
        if (k.min_price && p.minPrice < k.min_price) fails.push(`$${p.minPrice} < min (product: ${p.title.slice(0, 40)})`);
        if (k.max_price && p.minPrice > k.max_price) fails.push(`$${p.minPrice} > max (product: ${p.title.slice(0, 40)})`);
        if (fails.length > 3) break;
      }
    }
    if ((j.count || 0) === 0) fails.push("zero results");
  }
  return fails;
}

let pass = 0, fail = 0;
for (const c of CASES) {
  for (const predictive of [true, false]) {
    const mode = predictive ? "pred" : "ai  ";
    try {
      const j = await search({ query: c.q, shop_domain: c.shop, is_predictive: predictive, is_final: false });
      const fails = check(c, j, mode);
      if (fails.length === 0) {
        pass++;
        console.log(`PASS ${mode} [${c.shop.split(".")[0].padEnd(26)}] "${c.q}" → ${j.count} results`);
      } else {
        fail++;
        console.log(`FAIL ${mode} [${c.shop.split(".")[0].padEnd(26)}] "${c.q}" → ${fails.slice(0, 3).join("; ")}`);
      }
    } catch (e) {
      fail++;
      console.log(`FAIL ${mode} [${c.shop.split(".")[0]}] "${c.q}" → ${e.message}`);
    }
  }
}
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`);
process.exit(fail ? 1 : 0);
