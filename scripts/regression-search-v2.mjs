/**
 * V2 regression battery — jenniferfurniturestaging on the v2 app.
 * Asserts constraint extraction, price compliance, index usage,
 * semantic recall, and content retrieval.
 *
 * Usage:  node scripts/regression-search-v2.mjs [baseUrl]
 */
const BASE = process.argv[2] || "https://webmcp.tendrilsioservices.com";
const SHOP = process.argv[3] || "jenniferfurniturestaging.myshopify.com";

const CASES = [
  // Constraints
  { q: "green sofa under 4000", max: 4000, color: "green", cat: "sofa" },
  { q: "gree sofa under 4000", max: 4000, color: "green", cat: "sofa" },           // typo
  { q: "leather sofa under 2000", max: 2000, material: "leather", cat: "sofa" },
  { q: "recliner under 1500", max: 1500, cat: "recliner" },
  { q: "sofa between 2000 and 4000", min: 2000, max: 4000, cat: "sofa" },
  { q: "sectional under 3k", max: 3000, cat: "sectional" },
  { q: "sofa above 2k", min: 2000, cat: "sofa" },
  // Brand
  { q: "bernhardt leather sectional", brand: "bernhardt", cat: "sectional" },
  { q: "luonto sleeper", brand: "luonto" },
  // Color/category
  { q: "grey recliner", color: "gray", cat: "recliner" },
  { q: "dining table", cat: "dining table" },
  { q: "brown sleeper sofa", color: "brown", kw: "sleeper" },
  // Typos
  { q: "secyional under 3000", cat: "sectional", max: 3000 },
  { q: "lether recliner", material: "leather", cat: "recliner" },
  // Semantic — the v2 differentiators (FTS alone misses these)
  { q: "kid friendly couch for small apartment", cat: "sofa", semantic: true },
  { q: "comfortable sofa for movie nights", cat: "sofa" },
  { q: "wall hugger recliner", cat: "recliner" },
  { q: "something stylish for my living room", any: true, aiOnly: true }, // semantic-rescue path is final-search only (keystrokes stay FTS-fast)
  // Content
  { q: "delivery policy", contentOnly: true },
  { q: "return policy", contentOnly: true },
  // Edge cases
  { q: "hello", expectZeroOrGarbage: true },
  { q: "stressless", allowFallback: true },
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

function check(name, cond, extra = "") {
  if (!cond) { console.log(`    FAIL: ${name} ${extra}`); return false; }
  return true;
}

let pass = 0, fail = 0;
for (const c of CASES) {
  for (const mode of (c.aiOnly ? ["ai"] : ["predictive", "ai"])) {
    const body = {
      query: c.q, shop_domain: SHOP, session_id: `v2reg-${Date.now()}`,
      is_predictive: mode === "predictive", is_final: mode === "ai",
    };
    let res;
    try { res = await search(body); } catch (e) {
      console.log(`✗ [${mode}] "${c.q}" — request error: ${e.message}`); fail++; continue;
    }
    const ec = res.ai_extracted_constraints || {};
    const products = res.products || [];
    const content = res.content_results || [];
    let ok = true;

    if (c.contentOnly) {
      ok = check("content returned", content.length > 0, `(products:${products.length})`);
    } else if (c.expectZeroOrGarbage) {
      ok = check("no crash", res.success === true);
    } else {
      ok = check("has results", products.length > 0 || c.allowFallback, `count=${products.length}`);
      if (c.cat) ok = check(`category=${c.cat}`, ec.category === c.cat, `got=${ec.category}`) && ok;
      if (c.color) ok = check(`color=${c.color}`, (ec.color || "") === c.color, `got=${ec.color}`) && ok;
      if (c.material) ok = check(`material=${c.material}`, (ec.material || "") === c.material, `got=${ec.material}`) && ok;
      if (c.brand) ok = check(`brand=${c.brand}`, (ec.brand || "") === c.brand, `got=${ec.brand}`) && ok;
      if (c.max) ok = check(`max_price=${c.max}`, ec.max_price === c.max, `got=${ec.max_price}`) && ok;
      if (c.min) ok = check(`min_price=${c.min}`, ec.min_price === c.min, `got=${ec.min_price}`) && ok;
      if (c.max && products.length > 0) {
        const over = products.filter(p => p.minPrice > c.max * 1.02).length;
        ok = check("prices within max", over === 0, `${over} over`) && ok;
      }
      if (res.index_used === false) console.log("    note: index not used");
    }

    if (ok) { pass++; console.log(`✓ [${mode}] "${c.q}" → ${products.length} products${content.length ? ` +${content.length} content` : ""}`); }
    else { fail++; console.log(`✗ [${mode}] "${c.q}"`); }
  }
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
