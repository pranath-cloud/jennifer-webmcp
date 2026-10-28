import { NextRequest, NextResponse } from "next/server";
import { shopifyGraphQL } from "@/lib/shopify/client";
import { SEARCH_PRODUCTS_QUERY, PREDICTIVE_SEARCH_PRODUCTS_QUERY, AVAILABILITY_BY_IDS_QUERY } from "@/lib/shopify/queries";
import { normalizeProductSummary } from "@/lib/shopify/normalizer";
import { parseSearchWithAITool, normalizeCategory } from "@/lib/ai/search-agent";
import { recordTelemetryEvent } from "@/lib/analytics/collector";
import { hasIndexForShop, searchCatalogIndex, searchIndexBySku, upsertProductsToIndex, searchContentIndex, vectorSearchProductIds, mergeSemanticCandidates, imageSimsForProducts, summaryProductId } from "@/lib/db/products_v2";
import { embedQuery } from "@/lib/ai/embeddings";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Session, X-Shop-Domain, *",
};

const searchResultsCache = new Map<string, { data: any; ts: number }>();

// Fire-and-forget: a Postgres telemetry write must never add latency
// to the shopper-facing search response.
function logTelemetry(event: Parameters<typeof recordTelemetryEvent>[0]): void {
  recordTelemetryEvent(event).catch((err) => console.warn("Telemetry non-fatal error:", err));
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function generateSmartSuggestions(category?: string, color?: string, material?: string, naturalQuery?: string): string[] {
  const suggestions: string[] = [];
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  if (category) {
    const capCat = cap(category);
    if (color) {
      const capCol = cap(color);
      suggestions.push(`${capCol} ${capCat}s`);
    }
    if (material) {
      const capMat = cap(material);
      suggestions.push(`${capMat} ${capCat}s`);
    }
    suggestions.push(`In-Stock ${capCat}s`);
    suggestions.push(`Top-Rated ${capCat}s`);
  } else if (color) {
    const capCol = cap(color);
    suggestions.push(`${capCol} Sofas & Sectionals`);
    suggestions.push(`${capCol} Accent Chairs`);
    suggestions.push(`In-Stock ${capCol} Furniture`);
  } else if (material) {
    const capMat = cap(material);
    suggestions.push(`${capMat} Sofas & Recliners`);
    suggestions.push(`${capMat} Sectionals`);
    suggestions.push(`In-Stock ${capMat} Furniture`);
  } else if (naturalQuery && naturalQuery.trim().length > 0) {
    const cleanQ = naturalQuery.trim();
    const capQ = cap(cleanQ);
    suggestions.push(`${cleanQ} in Stock`);
    suggestions.push(`Top-Rated ${cleanQ}`);
  } else {
    suggestions.push("Sectionals in stock");
    suggestions.push("Power recliners");
  }

  const unique = Array.from(new Set(suggestions));
  return unique.slice(0, 3);
}

async function handleSearch(params: any, request: NextRequest) {
  const { query: naturalQuery = "", limit = 250, shop_domain, shop, store, session_id, sessionId, is_predictive = false, is_final, track_telemetry, standard_mode = false } = params;
  const targetShop = shop_domain || shop || store || request.headers.get("x-shop-domain") || request.nextUrl?.searchParams?.get("shop") || request.nextUrl?.searchParams?.get("shop_domain") || undefined;
  const effectiveSessionId = session_id || sessionId || request.headers.get("x-client-session") || undefined;

  // Telemetry Filter: Only persist intentional, final searches (skip transient predictive keystrokes)
  const isPredictive = is_predictive === true || params.predictive === true || request.headers.get("x-is-predictive") === "true";
  const shouldRecordTelemetry = !isPredictive && (is_final === true || track_telemetry === true || (is_final !== false && naturalQuery.trim().length >= 3));

  // Response Cache Check (5-minute TTL)
  const cleanQ = naturalQuery.trim().toLowerCase();
  const cacheKey = `${targetShop || "default"}:${cleanQ}:${isPredictive ? "pred" : "final"}:${limit}`;
  const cached = searchResultsCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < 1000 * 60 * 5) {
    return {
      status: 200,
      headers: corsHeaders,
      data: cached.data
    };
  }

  // Standard Mode: Raw Shopify Catalog Keyword Query for Side-by-Side Comparison
  if (standard_mode) {
    const rawTerm = (naturalQuery || "").trim();
    const standardQuery = rawTerm ? `status:active AND (title:*${rawTerm}* OR tag:*${rawTerm}*)` : "status:active";
    const response = await shopifyGraphQL<any>(SEARCH_PRODUCTS_QUERY, {
      query: standardQuery,
      first: typeof limit === "number" && limit > 0 ? limit : 12,
    }, { shopDomain: targetShop });

    const rawEdges = response.data?.products?.edges || [];
    const products = rawEdges
      .map((e: any) => normalizeProductSummary(e.node))
      .filter((p: any) => p.featuredImage && (p.status ? p.status === "ACTIVE" : true) && (p.publishedAt !== null || (targetShop && targetShop.includes("staging"))));

    return {
      status: 200,
      headers: corsHeaders,
      data: {
        success: true,
        shop_domain: targetShop || "jenniferfurniturestaging.myshopify.com",
        count: products.length,
        mode: "standard",
        interpreted_query: `Standard keyword search: "${rawTerm}"`,
        products,
      }
    };
  }

  // 1. PURE AI TOOL CALLING / FAST-PATH EXTRACTION
  const aiConstraints = await parseSearchWithAITool(naturalQuery, isPredictive);

  // A bare SKU/model query ("N500092100") isn't a furniture sentence — the LLM
  // classifies it as non-furniture and everything exits early. Force it through.
  if (/^[a-z0-9-]{4,25}$/i.test(naturalQuery.trim()) && /\d/.test(naturalQuery)) {
    aiConstraints.is_furniture_search = true;
    if (!aiConstraints.search_keywords) aiConstraints.search_keywords = naturalQuery.trim();
  }

  // If user query was classified as non-furniture (e.g. greeting, noise, gibberish)
  let emptyExtraction = naturalQuery.trim().length > 0 && !aiConstraints.category && !aiConstraints.search_keywords && !aiConstraints.color && !aiConstraints.material && !aiConstraints.brand && (!aiConstraints.features || aiConstraints.features.length === 0);
  if (aiConstraints.is_furniture_search === false || emptyExtraction) {
    // Semantic rescue — vague lifestyle/concept queries ("something stylish
    // for my living room") have no extractable keywords but ARE shopping
    // intent. Embed the raw query and let the vector index decide.
    if (!isPredictive && naturalQuery.trim().split(/\s+/).length >= 3) {
      try {
        const shopForVec = targetShop || "jenniferfurniturestaging.myshopify.com";
        const qv = await embedQuery(naturalQuery).catch(() => [] as number[]);
        if (qv.length > 0 && await hasIndexForShop(shopForVec)) {
          const hits = await vectorSearchProductIds(shopForVec, qv, 60, 0.3);
          if (hits.length >= 3 && hits[0].sim >= 0.36) {
            aiConstraints.is_furniture_search = true;
            aiConstraints.search_keywords = aiConstraints.search_keywords || naturalQuery.trim();
            emptyExtraction = false;
          }
        }
      } catch { /* fall through to early-exit */ }
    }

    // Catalog probe — short queries the LLM can't classify are often
    // product/series names it has never heard ("bossanova", "hugo"). One
    // cheap FTS + SKU probe decides before we declare it non-furniture.
    if ((aiConstraints.is_furniture_search === false || emptyExtraction) && naturalQuery.trim().length > 1) {
      try {
        const probeShop = targetShop || "jenniferfurniturestaging.myshopify.com";
        if (await hasIndexForShop(probeShop)) {
          let probe = await searchCatalogIndex({ shopDomain: probeShop, text: naturalQuery.trim(), limit: 8 });
          if (probe.length === 0 && /^[a-z0-9-]{3,30}$/i.test(naturalQuery.trim())) {
            probe = await searchIndexBySku(probeShop, naturalQuery.trim());
          }
          if (probe.length > 0) {
            aiConstraints.is_furniture_search = true;
            aiConstraints.search_keywords = aiConstraints.search_keywords || naturalQuery.trim();
            emptyExtraction = false;
          }
        }
      } catch { /* probe is best-effort */ }
    }
  }
  if (aiConstraints.is_furniture_search === false || emptyExtraction) {
    if (shouldRecordTelemetry) {
      logTelemetry({
        shopDomain: targetShop || "jenniferfurniturestaging.myshopify.com",
        eventType: "search_query",
        queryText: naturalQuery,
        interpretedQuery: naturalQuery,
        extractedConstraints: {
          category: undefined,
        },
        resultCount: 0,
        zeroResult: true,
        sessionId: effectiveSessionId,
      });
    }

    // Not a furniture query — but it may be a site-content query
    // ("delivery", "returns", "warranty") → still surface pages/articles.
    const earlyContent = await searchContentIndex(targetShop || "jenniferfurniturestaging.myshopify.com", naturalQuery, 5).catch(() => []);

    return {
      status: 200,
      headers: corsHeaders,
      data: {
        success: true,
        shop_domain: targetShop || "jenniferfurniturestaging.myshopify.com",
        count: 0,
        interpreted_query: naturalQuery,
        ai_extracted_constraints: aiConstraints,
        smart_suggestions: ["Sectionals in stock", "Power recliners", "Sleeper sofas"],
        content_results: earlyContent,
        products: [],
      }
    };
  }

  const category = normalizeCategory(params.category || aiConstraints.category || "");
  const features: string[] = (aiConstraints.features || []).map((f: string) => f.toLowerCase().trim());
  const color = (params.color || aiConstraints.color || "").toLowerCase().trim();
  const material = (params.material || aiConstraints.material || "").toLowerCase().trim();
  const brand = (params.brand || params.vendor || aiConstraints.brand || "").toLowerCase().trim();
  let max_price = typeof params.max_price === "number" ? params.max_price : aiConstraints.max_price;
  let min_price = typeof params.min_price === "number" ? params.min_price : aiConstraints.min_price;
  // Sanity floor — no furniture sells under $100, so a tiny max_price is always
  // an extraction artifact ("can X be bought for 24?"), not a real budget.
  if (typeof max_price === "number" && max_price < 100) max_price = undefined;
  let searchKeywords = (aiConstraints.search_keywords || category || naturalQuery || "").toLowerCase().trim();

  // Strip constraint tokens that leaked into keywords — color/material/brand
  // words and price digits belong to their own filters, not text matching.
  // ("green sofas worth 4000" → "sofa"; SKU digits like "635" survive when
  // no price constraint consumed them.)
  {
    const kwStop = new Set(["worth", "cost", "price", "dollar", "dollars", "bucks", "spend", "budget", "value", "range", "around", "less", "than", "at", "least", "starting", "start", "between", "beyond", "approx", "approximately"]);
    const brandTokenSet = new Set(brand.split(/[^a-z0-9]+/).filter(Boolean));
    const hasPriceConstraint = (typeof max_price === "number" && max_price > 0) || (typeof min_price === "number" && min_price > 0);
    searchKeywords = searchKeywords.split(/\s+/).filter((t: string) =>
      t.length > 1 &&
      t !== color && t !== material &&
      !brandTokenSet.has(t) &&
      !kwStop.has(t) &&
      !(/^\d+$/.test(t) && hasPriceConstraint)
    ).join(" ") || (category || "");
  }

  // 2. Candidate Shopify GraphQL query formulation - strictly driven by AI-extracted parameters
  const statusFilter = "status:active";
  let compiledQuery = statusFilter;
  const brandSquash = brand.replace(/[^a-z0-9]/g, "");
  if (brand) {
    const brandTokens = brand.split(/[^a-z0-9]+/).filter((t: string) => t.length > 1);
    const brandToken = brandTokens.sort((a: string, b: string) => b.length - a.length)[0] || brand;
    compiledQuery += ` AND (vendor:*${brandToken}* OR title:*${brandToken}* OR tag:*${brandToken}*)`;
  }
  if (category) {
    compiledQuery += ` AND (title:*${category}* OR tag:*${category}* OR product_type:*${category}* OR vendor:*${category}* OR variants.sku:*${category}*)`;
  } else if (searchKeywords && searchKeywords.length > 1) {
    const kwTokens = searchKeywords.split(/\s+/).filter((t: string) =>
      t.length > 1 && (!brandSquash || !brandSquash.includes(t.replace(/[^a-z0-9]/g, "")))
    );
    if (kwTokens.length >= 2) {
      compiledQuery += ` AND (${kwTokens.map((k: string) => `(title:*${k}* OR tag:*${k}* OR product_type:*${k}* OR vendor:*${k}* OR variants.sku:*${k}*)`).join(" AND ")})`;
    } else if (kwTokens.length === 1) {
      compiledQuery += ` AND (title:*${kwTokens[0]}* OR tag:*${kwTokens[0]}* OR product_type:*${kwTokens[0]}* OR vendor:*${kwTokens[0]}* OR variants.sku:*${kwTokens[0]}*)`;
    }
  }

  // SKU-pattern tokens (letter+digit mix: "N500092100", "KLA-DAY-JF1160")
  const kwList = (searchKeywords || "").split(/\s+/).filter((t: string) => t.length > 1);
  const skuTokens = [category, ...kwList].filter((t: string) =>
    /^(?=.*\d)(?=.*[a-z])[a-z0-9-]{4,25}$/i.test(t || "")
  );
  const shopKey = targetShop || "jenniferfurniturestaging.myshopify.com";
  let skuFallback = false;
  let broadFallback = false;
  let semanticOnly = false;
  let cohortMaxImageSim = 0; // best image-space match in this query's vector cohort
  let cohortMaxColorSim = 0; // best match to the color-scoped probe vector
  let rawProducts: any[] = [];
  let usedIndex = false;

  const logZeroResult = () => {
    if (!shouldRecordTelemetry) return;
    logTelemetry({
      shopDomain: shopKey,
      eventType: "search_query",
      queryText: naturalQuery,
      interpretedQuery: aiConstraints.interpreted_query || naturalQuery,
      extractedConstraints: {
        category: category || undefined,
        features: features.length > 0 ? features : undefined,
        color: color || undefined,
        material: material || undefined,
        brand: brand || undefined,
        min_price: typeof min_price === "number" ? min_price : undefined,
        max_price: typeof max_price === "number" ? max_price : undefined,
      },
      resultCount: 0,
      zeroResult: true,
      sessionId: effectiveSessionId,
    });
  };

  // PHASE 3 — local catalog index (Postgres FTS). ~30-80ms vs a GraphQL
  // roundtrip at ~600ms+; this is what makes predictive search feel instant.
  try {
    if (await hasIndexForShop(shopKey)) {
      usedIndex = true;
      const ftsText = [searchKeywords, category].filter(Boolean).join(" ").trim();
      // Final search runs the semantic leg in parallel with FTS — vector
      // recall catches synonyms/concepts FTS can't ("kid-proof couch").
      // Final search runs the semantic leg in parallel with FTS — vector
      // recall catches synonyms/concepts FTS can't ("kid-proof couch").
      // Predictive keystrokes stay FTS-only for speed — EXCEPT when a
      // color/material is present: the photo gate needs an image sim per
      // candidate, so we embed even in predictive (~150ms). For color
      // queries we embed a color-scoped probe ("green sofa") instead of the
      // raw query — the full query vector conflates hue with category/
      // material ("green leather sofa" ranks blue leather sofas on top).
      const colorProbeText = color ? `${color} ${category || "furniture"}` : null;
      const embedPromise = (!isPredictive || color || material)
        ? embedQuery((isPredictive && colorProbeText) ? colorProbeText : naturalQuery).catch(() => [] as number[])
        : Promise.resolve([] as number[]);
      // SKU-pattern tokens — a SKU is an exact identifier, not text. Consult
      // sku_list BEFORE trusting fuzzy FTS hits: a token-collision match
      // ("KLA" bleeding out of "KLA-SKY-H0631" as a brand) would otherwise
      // starve the exact lookup and headline the wrong product.
      let indexed: any[] = [];
      if (skuTokens.length > 0) {
        const hits = (await Promise.all(skuTokens.map((t: string) => searchIndexBySku(shopKey, t)))).flat();
        if (hits.length > 0) {
          const seenSku = new Set<string>();
          indexed = hits.filter((h: any) => {
            const id = summaryProductId(h);
            if (seenSku.has(id)) return false;
            seenSku.add(id);
            h.__skuHit = true;
            return true;
          });
          skuFallback = true;
        }
      }

      if (indexed.length === 0) {
        indexed = await searchCatalogIndex({
          shopDomain: shopKey,
          text: ftsText,
          brand,
          limit: 250,
        });
      }

      // Semantic leg — merge vector-recalled products into the candidate
      // pool (recall only; the shared scoring layer still ranks them).
      // Runs BEFORE the broad fallback: when FTS misses entirely, semantic
      // recall is exactly what should rescue the query.
      const queryVec = await embedPromise;
      if (queryVec.length > 0 && isPredictive) {
        // Predictive color/material gate — no vector recall (the Supabase
        // hop isn't worth it per keystroke); just stamp image sims on the
        // FTS pool so the cohort gate below has its evidence. Color queries
        // get the probe vector above, so these sims double as color sims.
        const sims = await imageSimsForProducts(shopKey, indexed.map(summaryProductId).filter(Boolean), queryVec);
        for (const s of indexed) {
          const v = sims.get(summaryProductId(s));
          if (typeof v === "number") {
            s.__imageSim = v;
            if (v > cohortMaxImageSim) cohortMaxImageSim = v;
            if (color) {
              s.__colorSim = v;
              if (v > cohortMaxColorSim) cohortMaxColorSim = v;
            }
          }
        }
      } else if (queryVec.length > 0) {
        const vecHits = await vectorSearchProductIds(shopKey, queryVec, 100);
        cohortMaxImageSim = Math.max(0, ...vecHits.map((v: any) => v.isim || 0));
        if (indexed.length === 0 && vecHits.length > 0) {
          semanticOnly = true;
        }
        indexed = await mergeSemanticCandidates(shopKey, indexed, vecHits);
        // Color queries need an image sim on EVERY candidate — a tag-lying
        // product outside the vector top-100 would otherwise escape the
        // cohort gate entirely. One small lookup covers the unstamped rows.
        if (color) {
          const unstamped = indexed.map(summaryProductId).filter(Boolean);
          const stamped = new Set(indexed.filter((s: any) => typeof s.__imageSim === "number").map(summaryProductId));
          const need = unstamped.filter((id) => !stamped.has(id));
          if (need.length > 0) {
            const extra = await imageSimsForProducts(shopKey, need, queryVec);
            for (const s of indexed) {
              const v = extra.get(summaryProductId(s));
              if (typeof v === "number") s.__imageSim = v;
            }
          }
        }
      }

      // Dedicated color probe (final search). Query-vector image sims rank
      // "leather sofa"-ness more than hue — a color-scoped probe isolates
      // the hue dimension so the cohort gate measures actual color.
      if (color && !isPredictive && indexed.length > 0) {
        const colorVec = await embedQuery(`${color} ${category || "furniture"}`).catch(() => [] as number[]);
        if (colorVec.length > 0) {
          const colorSims = await imageSimsForProducts(shopKey, indexed.map(summaryProductId).filter(Boolean), colorVec);
          for (const s of indexed) {
            const v = colorSims.get(summaryProductId(s));
            if (typeof v === "number") {
              s.__colorSim = v;
              if (v > cohortMaxColorSim) cohortMaxColorSim = v;
            }
          }
        }
      }

      if (indexed.length === 0) {
        if (naturalQuery.trim().length > 0) {
          logZeroResult();
          broadFallback = true;
        }
        // Broad browse — top in-stock items, never a dead end
        indexed = await searchCatalogIndex({ shopDomain: shopKey, text: "", limit: 48 });
      }
      rawProducts = indexed;
    }
  } catch (idxErr) {
    console.warn("Catalog index unavailable — falling back to GraphQL:", idxErr);
    usedIndex = false;
  }

  if (!usedIndex) {
    const queryGql = isPredictive ? PREDICTIVE_SEARCH_PRODUCTS_QUERY : SEARCH_PRODUCTS_QUERY;
    // Predictive calls fetch 50 for speed — but when constraints get filtered
    // client-side (price/brand/color/material), a 50-product pool can empty
    // out. Fetch the full page in that case so valid matches aren't dropped.
    const needsClientFiltering = Boolean(
      brand || color || material ||
      (typeof min_price === "number" && min_price > 0) ||
      (typeof max_price === "number" && max_price > 0)
    );
    const fetchCount = isPredictive ? (needsClientFiltering ? 250 : 50) : 250;

    // Exact-SKU fast path — run BEFORE the fuzzy compiled query so a real
    // SKU can't be outranked by a token-collision match.
    let edges: any[] = [];
    let response: any;
    if (skuTokens.length > 0) {
      response = await shopifyGraphQL<any>(queryGql, {
        query: `${statusFilter} AND (${skuTokens.map((t: string) => `variants.sku:*${t}*`).join(" OR ")})`,
        first: fetchCount,
      }, { shopDomain: targetShop });
      edges = response.data?.products?.edges || [];
      if (edges.length > 0) skuFallback = true;
    }

    if (edges.length === 0) {
      response = await shopifyGraphQL<any>(queryGql, {
        query: compiledQuery,
        first: fetchCount,
      }, { shopDomain: targetShop });
      edges = response.data?.products?.edges || [];
    }

    // If category query returned no results, try category keyword fallback
    if (edges.length === 0 && category && category.length > 2) {
      response = await shopifyGraphQL<any>(queryGql, {
        query: `${statusFilter} AND (title:*${category}* OR tag:*${category}* OR product_type:*${category}* OR vendor:*${category}* OR variants.sku:*${category}*)`,
        first: fetchCount,
      }, { shopDomain: targetShop });
      edges = response.data?.products?.edges || [];
    }

    // Last resort: strict multi-token AND found nothing — retry with OR.
    // Catalog entries often match only some tokens ("otaru 635" where the
    // title carries only "Otaru").
    if (edges.length === 0 && kwList.length >= 2) {
      response = await shopifyGraphQL<any>(queryGql, {
        query: `${statusFilter} AND (${kwList.map((k: string) => `(title:*${k}* OR tag:*${k}* OR product_type:*${k}* OR vendor:*${k}* OR variants.sku:*${k}*)`).join(" OR ")})`,
        first: fetchCount,
      }, { shopDomain: targetShop });
      edges = response.data?.products?.edges || [];
    }

    // If query was non-empty and 0 products matched the catalog, log an honest
    // zero_result — then fall through to a broad in-stock fetch so the shopper
    // still sees popular items instead of a dead-end page.
    if (edges.length === 0) {
      if (naturalQuery.trim().length > 0) {
        logZeroResult();
        broadFallback = true;
      }
      response = await shopifyGraphQL<any>(queryGql, {
        query: statusFilter,
        first: fetchCount,
      }, { shopDomain: targetShop });
      edges = response.data?.products?.edges || [];
    }

    rawProducts = edges.map((edge: any) => {
      const s: any = normalizeProductSummary(edge.node);
      s.skuList = (edge.node.variants?.edges || []).map((v: any) => v.node?.sku).filter(Boolean);
      if (skuFallback) s.__skuHit = true;
      return s;
    });

    // Lazy-fill the index — every search teaches the catalog, so a shop that
    // hasn't been synced yet still converges toward index-served search.
    upsertProductsToIndex(shopKey, rawProducts).catch(() => {});
  }

  // 3. Score & Rank Products according to AI Extracted Parameters with Strict Multi-Token Precision
  interface ScoredProduct {
    score: number;
    product: any;
    matchDetails: string[];
    colorMatched: boolean;
    colorStrong: boolean;
    colorPictured: boolean;
    materialMatched: boolean;
    materialStrong: boolean;
    categoryMatched: boolean;
    brandMatched: boolean;
  }

  const COLOR_ALIASES: Record<string, string[]> = {
    blue: ["navy", "turquoise", "teal", "azure", "cadet", "blue", "volcanic blue"],
    green: ["sage", "olive", "emerald", "green", "marine green", "moss", "forest", "pine"],
    brown: ["espresso", "walnut", "cognac", "chocolate", "brown", "tan", "camel", "caramel"],
    gray: ["grey", "charcoal", "slate", "gray", "silver"],
  };
  const colorHits = (vals: string[], c: string) =>
    (vals || []).some((v) => {
      const lv = (v || "").toLowerCase();
      // Word-boundary: "Oliver 173" must not match the "olive" alias.
      if (new RegExp(`\\b${c}\\b`, "i").test(lv)) return true;
      return (COLOR_ALIASES[c] || []).some((s) => new RegExp(`\\b${s}\\b`, "i").test(lv));
    });

  const scoredProducts: ScoredProduct[] = [];

  // Accessory / Fragment keywords to prune for primary categories unless explicitly searched
  const fragmentKeywords = ["wedge", "pie wedge", "armless chair", "armless", "power pack", "slipcover", "console unit", "corner unit", "connecting bracket"];
  const isLookingForFragment = fragmentKeywords.some(f => naturalQuery.toLowerCase().includes(f));

  for (const p of rawProducts) {
    const pt = (p.productType || "").toLowerCase();
    const title = (p.title || "").toLowerCase();
    const tags: string[] = (p.tags || []).map((t: string) => t.toLowerCase());
    const tagStr = tags.join(" ");
    const price = p.minPrice;
    const hasImage = p.featuredImage && typeof p.featuredImage === "string" && p.featuredImage.startsWith("http");

    // Suppress Discontinued, Non-Active, Unpublished & Image-less Products
    if (pt === "discontinued" || tags.includes("discontinued")) continue;
    if (p.status && p.status !== "ACTIVE") continue;
    if (p.publishedAt === null && targetShop && !targetShop.includes("staging")) continue;
    if (!hasImage) continue;

    // Suppress modular fragments for main categories (e.g. "pie wedge", "armless chair" when searching for "sectional")
    if (!isLookingForFragment && (category === "sectional" || searchKeywords.includes("sectional") || category === "sofa" || category === "recliner")) {
      const isFragment = fragmentKeywords.some(f => title.includes(f));
      if (isFragment && !title.includes("sectional set") && !title.includes("piece sectional")) {
        continue;
      }
      // Suppress standalone chairs if searching for sectionals
      if (category === "sectional" && (pt.includes("chair") || title.includes("accent chair")) && !title.includes("sectional")) {
        continue;
      }
      // Suppress standalone chairs/ottomans when searching for sofas —
      // "Chloe Accent Chair" is not a "green sofa" answer even if a
      // collection or tag incidentally contains the word sofa.
      if ((category === "sofa" || category === "sectional") && (pt.includes("chair") || pt.includes("ottoman")) && !pt.includes("sofa") && !title.includes("sofa") && !title.includes("sectional")) {
        continue;
      }
    }

    let score = 0.0; // Baseline score starts at 0 - no artificial floor
    const matchDetails: string[] = [];
    // Semantic proximity bonus — vector-recalled products that the
    // constraint gates accept get ranked by meaning, not just keywords.
    if (typeof p.__vectorSim === "number" && p.__vectorSim > 0) {
      score += Math.round(p.__vectorSim * 50);
      matchDetails.push(`vector:${p.__vectorSim.toFixed(2)}`);
    }
    // Visual leg — the product's PHOTO resembles the query. Decisive on
    // color/material searches: "green sofa" ranks products whose images are
    // actually green, above catalog-tag greens that photograph beige.
    if (typeof p.__imageSim === "number" && p.__imageSim > 0.33) {
      const imgBonus = Math.round((p.__imageSim - 0.30) * (color || material ? 80 : 50));
      if (imgBonus > 0) {
        score += imgBonus;
        matchDetails.push(`img:${p.__imageSim.toFixed(2)}`);
      }
    }
    let colorMatched = false;
    let colorStrong = false;
    let colorPictured = false;
    let materialMatched = false;
    let materialStrong = false;
    let categoryMatched = false;
    let brandMatched = false;

    // Exact SKU hit — the identifier IS the match. Guarantee it clears the
    // score gate and outranks fuzzy alternatives, since title/tag regexes
    // can't see a SKU.
    if (p.__skuHit) {
      score += 300.0;
      categoryMatched = true;
      matchDetails.push("SKU match");
    }

    // A. AI Target Keyword Matching
    const targetTokens = searchKeywords.toLowerCase().split(/\s+/).filter((t: string) => t.length > 1);
    let matchedTokenCount = 0;
    for (const token of targetTokens) {
      let tokenFound = false;
      const tokenRegex = new RegExp(`\\b${token}\\b`, "i");
      if (tokenRegex.test(title)) {
        score += 35.0;
        tokenFound = true;
      } else if (tokenRegex.test(pt)) {
        score += 25.0;
        tokenFound = true;
      } else if (tokenRegex.test(tagStr)) {
        score += 15.0;
        tokenFound = true;
      }
      if (tokenFound) matchedTokenCount++;
    }

    if (targetTokens.length > 1 && matchedTokenCount === targetTokens.length) {
      score += 40.0;
      matchDetails.push("Target match");
    }

    // B. Strict Feature Modifier Matching (e.g. sleeper, power reclining, swivel, storage, usb)
    const allMetaFeaturesStr = ((p.features || []).join(" ") + " " + (p.collections || []).join(" ")).toLowerCase();
    for (const feat of features) {
      const featRegex = new RegExp(`\\b${feat}\\b`, "i");
      const hasFeat = featRegex.test(title) || featRegex.test(pt) || featRegex.test(tagStr) || featRegex.test(allMetaFeaturesStr) ||
        (feat === "sleeper" && (/\b(sofa bed|futon|sleeper)\b/i.test(title) || /\b(sofa bed|sleeper)\b/i.test(pt) || tagStr.includes("sleeper") || allMetaFeaturesStr.includes("sleeper"))) ||
        (feat === "power reclining" && (/\b(power|electric)\b/i.test(title) || tagStr.includes("power") || allMetaFeaturesStr.includes("power")));

      if (hasFeat) {
        score += 80.0;
        matchDetails.push(`${feat} feature`);
      } else {
        score -= 70.0; // Heavy penalty if product lacks requested compound feature
      }
    }

    // D. Category / Keyword Relevance
    const searchTerms = [searchKeywords, category].filter(Boolean).map(t => t.toLowerCase());
    const collectionsStr = (p.collections || []).join(" ").toLowerCase();
    for (const term of searchTerms) {
      const termRegex = new RegExp(`\\b${term}\\b`, "i");
      if (termRegex.test(title)) {
        score += 50.0;
        categoryMatched = true;
        break;
      } else if (termRegex.test(pt)) {
        score += 40.0;
        categoryMatched = true;
        break;
      } else if (termRegex.test(collectionsStr)) {
        score += 35.0;
        categoryMatched = true;
        break;
      } else if (termRegex.test(tagStr)) {
        score += 25.0;
        categoryMatched = true;
        break;
      }
    }

    if (!categoryMatched && searchTerms.length > 0) {
      const isLookingForSectional = searchTerms.some(t => t.includes("sectional"));
      if (isLookingForSectional && (/\bsectional\b/i.test(title) || /\bsectional\b/i.test(pt) || tagStr.includes("sectional") || collectionsStr.includes("sectional"))) {
        score += 50.0;
        categoryMatched = true;
      } else {
        score -= 20.0;
      }
    }

    // E. Color Strictness (inspects Options, Variants, Tags, and Title)
    if (color) {
      const colorRegex = new RegExp(`\\b${color}\\b`, "i");
      const optColors = (p.availableColors || []).map((c: string) => c.toLowerCase());

      const hasColorOption = optColors.some((c: string) => 
        colorRegex.test(c) ||
        (color === "blue" && (c.includes("navy") || c.includes("turquoise") || c.includes("teal") || c.includes("blue") || c.includes("cadet") || c.includes("volcanic blue"))) ||
        (color === "green" && (c.includes("sage") || c.includes("olive") || c.includes("emerald") || c.includes("green") || c.includes("marine green") || c.includes("moss") || c.includes("forest"))) ||
        (color === "brown" && (c.includes("espresso") || c.includes("walnut") || c.includes("cognac") || c.includes("chocolate") || c.includes("brown") || c.includes("tan") || c.includes("camel") || c.includes("caramel"))) ||
        (color === "gray" && (c.includes("grey") || c.includes("charcoal") || c.includes("slate") || c.includes("gray") || c.includes("silver")))
      );

      const hasColorTag = tags.includes(`color-${color}`) || tags.includes(`color_${color}`) || tags.includes(color) ||
        (color === "blue" && (tags.includes("navy") || tags.includes("turquoise") || tags.includes("teal") || tags.includes("blue") || tags.includes("cadet") || tags.includes("volcanic blue") || tagStr.includes("navy") || tagStr.includes("blue") || tagStr.includes("cadet") || tagStr.includes("turquoise"))) ||
        (color === "green" && (tagStr.includes("sage") || tagStr.includes("olive") || tagStr.includes("emerald") || tagStr.includes("green"))) ||
        (color === "brown" && (tagStr.includes("espresso") || tagStr.includes("walnut") || tagStr.includes("cognac") || tagStr.includes("chocolate") || tagStr.includes("brown") || tagStr.includes("tan"))) ||
        (color === "gray" && (tagStr.includes("grey") || tagStr.includes("charcoal") || tagStr.includes("slate") || tagStr.includes("gray")));

      const hasColorTitle = colorRegex.test(title) || 
        (color === "blue" && /\b(navy|turquoise|teal|azure|cadet|blue)\b/i.test(title)) ||
        (color === "green" && /\b(sage|olive|emerald|green|moss|forest)\b/i.test(title)) ||
        (color === "brown" && /\b(espresso|walnut|cognac|chocolate|brown|camel|caramel|tan)\b/i.test(title)) ||
        (color === "gray" && /\b(grey|charcoal|slate|gray)\b/i.test(title));

      // Four-tier truth ordering: pictured variant IS this color (what the
      // customer sees) > photo-embedding visual confirmation > title/tag
      // evidence > options-pool match. The visual cohort gate compares this
      // product's photo similarity to the BEST image match in the query's
      // vector cohort — relative margins ride out per-query calibration
      // differences in the compressed 768-dim space.
      colorPictured = colorHits(p.picturedColors || [], color);
      // Color-scoped probe sims when available (they isolate hue); the
      // query-vector image sim is the fallback for non-indexed pools.
      const imgSim = typeof p.__colorSim === "number" ? p.__colorSim
        : (typeof p.__imageSim === "number" ? p.__imageSim : 0);
      const gateMax = cohortMaxColorSim > 0 ? cohortMaxColorSim : cohortMaxImageSim;
      const hasAnyColorEvidence = colorPictured || hasColorTag || hasColorTitle || hasColorOption;
      const confirmCut = gateMax - (hasAnyColorEvidence ? 0.045 : 0.02);
      const visualConfirm = imgSim >= 0.36 && gateMax > 0 && imgSim >= confirmCut;
      // Tag claims the color but the photo clearly shows a different one —
      // trust the pixels and strip the tag back to option-grade evidence.
      const visualContradict = imgSim > 0 && gateMax > 0 && imgSim < gateMax - 0.085;
      if (visualConfirm && !colorPictured) matchDetails.push(`${color} in photo`);
      if (visualConfirm) colorPictured = true;

      if (colorPictured) {
        if (visualContradict && !hasColorTitle) {
          // Variant mapping claims this color but the featured photo clearly
          // shows another — the displayed image beats the catalog claim.
          score += 15.0;
          colorMatched = true;
          colorPictured = false;
          matchDetails.push(`${color} claim (photo differs)`);
        } else {
          score += 120.0;
          colorMatched = true;
          colorStrong = true;
          matchDetails.push(`${color} pictured`);
        }
      } else if (hasColorTag || hasColorTitle) {
        if (visualContradict && !hasColorTitle) {
          score += 20.0;
          colorMatched = true;
          matchDetails.push(`${color} tag only (photo differs)`);
        } else {
          score += hasColorTitle ? 95.0 : 70.0;
          colorMatched = true;
          colorStrong = true;
          matchDetails.push(`${color} finish`);
        }
      } else if (hasColorOption) {
        score += 25.0;
        colorMatched = true;
        matchDetails.push(`${color} option`);
      } else {
        score -= 90.0; // Strict penalty for mismatching color
      }
    }

    // F. Material Strictness (inspects Options, Variants, Tags, and Title)
    if (material) {
      const optMats = (p.availableMaterials || []).map((m: string) => m.toLowerCase());
      const hasMaterialOption = optMats.some((m: string) => 
        m.includes(material) ||
        (material === "leather" && (m.includes("leather") || m.includes("top grain") || m.includes("genuine leather"))) ||
        (material === "velvet" && m.includes("velvet")) ||
        (material === "fabric" && (m.includes("fabric") || m.includes("linen") || m.includes("chenille") || m.includes("polyester")))
      );

      const hasMaterialTag = tags.includes(`material-${material}`) || tags.includes(material) || tagStr.includes(material);
      const hasMaterialTitle = title.includes(material) ||
        (material === "leather" && (title.includes("top grain") || title.includes("genuine leather") || title.includes("faux leather") || title.includes("leather"))) ||
        (material === "velvet" && title.includes("velvet"));

      if (hasMaterialTag || hasMaterialTitle) {
        score += 45.0;
        materialMatched = true;
        materialStrong = true;
        matchDetails.push(`${material} material`);
      } else if (hasMaterialOption) {
        score += 18.0;
        materialMatched = true;
        matchDetails.push(`${material} option`);
      } else {
        score -= 30.0;
      }
    }

    // G2. Brand / Vendor Strictness (inspects vendor field, title, tags)
    if (brand) {
      const vendorStr = (p.vendor || "").toLowerCase();
      const vendorSquash = vendorStr.replace(/[^a-z0-9]/g, "");
      const brandTokenList = brand.split(/[^a-z0-9]+/).filter((t: string) => t.length > 1);
      const vendorHit = vendorSquash.length > 0 &&
        (vendorSquash.includes(brandSquash) || (brandTokenList.length > 0 && brandTokenList.every((t: string) => vendorStr.includes(t))));

      if (vendorHit) {
        score += 90.0;
        brandMatched = true;
        matchDetails.push(`${brand} brand`);
      } else {
        const brandRegex = new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (brandRegex.test(title) || brandRegex.test(tagStr) || brandRegex.test((p.collections || []).join(" "))) {
          score += 35.0;
          brandMatched = true;
          matchDetails.push(`${brand} mention`);
        } else {
          score -= 80.0; // Strict penalty for mismatching brand
        }
      }
    }

    // H. Price Bounds
    if (typeof max_price === "number" && max_price > 0) {
      if (price <= max_price) {
        score += 40.0;
        matchDetails.push(`Under $${max_price}`);
      } else {
        score -= 500.0; // Strictly disqualify products that exceed the requested price budget
      }
    }
    if (typeof min_price === "number" && min_price > 0) {
      if (price >= min_price) {
        score += 20.0;
      } else {
        score -= 500.0; // Strictly disqualify products below minimum budget
      }
    }

    // I. In-Stock Bonus
    if (p.inStock || p.totalInventory > 0) {
      score += 15.0;
    }

    scoredProducts.push({ score, product: p, matchDetails, colorMatched, colorStrong, colorPictured, materialMatched, materialStrong, categoryMatched, brandMatched });
  }


  // 4. Strict Filtering & Thresholding
  let filteredScored = scoredProducts;
  let fallbackNotice: string | undefined = broadFallback
    ? `No exact matches for "${naturalQuery}". Showing popular in-stock options:`
    : skuFallback
      ? `Products matching "${naturalQuery}":`
      : undefined;

  const hasColorReq = Boolean(color);
  const hasMaterialReq = Boolean(material);
  const hasBrandReq = Boolean(brand);
  const hasMaxPriceReq = typeof max_price === "number" && max_price > 0;
  const hasMinPriceReq = typeof min_price === "number" && min_price > 0;

  // Filter candidates by price constraint if specified
  let candidateScored = scoredProducts;
  if (hasMaxPriceReq) {
    candidateScored = candidateScored.filter(sp => sp.product.minPrice <= max_price);
  }
  if (hasMinPriceReq) {
    candidateScored = candidateScored.filter(sp => sp.product.minPrice >= min_price);
  }

  // If no products exist strictly within the price budget, provide closest alternatives with notice
  if (candidateScored.length === 0 && hasMaxPriceReq) {
    fallbackNotice = `No ${category || "furniture"} currently found under $${max_price}. Showing lowest priced in-stock options:`;
    candidateScored = scoredProducts.filter(sp => sp.categoryMatched || sp.score > -400);
    candidateScored.sort((a, b) => a.product.minPrice - b.product.minPrice);
  } else if (candidateScored.length === 0 && hasMinPriceReq) {
    fallbackNotice = `No ${category || "furniture"} currently found at $${min_price} or above. Showing closest in-stock options:`;
    candidateScored = scoredProducts.filter(sp => sp.categoryMatched || sp.score > -400);
    candidateScored.sort((a, b) => b.product.minPrice - a.product.minPrice);
  }

  // Brand is a hard constraint: prefer vendor-matched products, fall back with notice
  if (hasBrandReq) {
    const brandHits = candidateScored.filter(sp => sp.brandMatched);
    if (brandHits.length > 0) {
      candidateScored = brandHits;
    } else if (!fallbackNotice) {
      fallbackNotice = `No ${brand} items currently in stock. Showing similar options:`;
    }
  }

  if (hasColorReq && hasMaterialReq) {
    // Exact match for BOTH color and material within budget (e.g. blue leather sofa under $1000)
    const exactBoth = candidateScored.filter(sp => sp.colorStrong && sp.materialStrong && sp.score > 0);
    if (exactBoth.length > 0) {
      filteredScored = exactBoth;
    } else {
      // If no single product has both in stock within price, show top products matching color OR material
      const partialMatches = candidateScored.filter(sp => (sp.colorMatched || sp.materialMatched) && sp.score > 0);
      if (partialMatches.length > 0) {
        fallbackNotice = `No ${color} ${material} ${category || "items"} currently in stock${max_price ? ` under $${max_price}` : ""}. Showing top matching ${color} and ${material} ${category ? category + "s" : "options"}:`;
        filteredScored = partialMatches;
      } else {
        fallbackNotice = `No ${color} ${material} ${category || "items"} currently in stock${max_price ? ` under $${max_price}` : ""}. Showing top curated ${category ? category + "s" : "matches"}:`;
        filteredScored = candidateScored.filter(sp => sp.categoryMatched && sp.score > 0);
      }
    }
  } else if (hasColorReq) {
    // Prefer products whose PICTURED variant is this color — the grid then
    // literally shows green sofas for a green search. Then title/tag
    // evidence, then options-pool with an honest notice.
    const picturedMatches = candidateScored.filter(sp => sp.colorPictured && sp.score > 0);
    const strongColorMatches = candidateScored.filter(sp => sp.colorStrong && !sp.colorPictured && sp.score > 0);
    if (picturedMatches.length >= 3) {
      // Enough visibly-right products — don't dilute the grid with
      // tag-green items whose photos show another fabric.
      filteredScored = picturedMatches;
    } else if (picturedMatches.length > 0 || strongColorMatches.length > 0) {
      filteredScored = [...picturedMatches, ...strongColorMatches];
    } else {
      const weakColorMatches = candidateScored.filter(sp => sp.colorMatched && sp.score > 0);
      if (weakColorMatches.length > 0) {
        fallbackNotice = `No ${color} ${category || "items"} pictured in stock${max_price ? ` under $${max_price}` : ""} — showing ${category || "items"} available in ${color} options:`;
        filteredScored = weakColorMatches;
      } else {
        fallbackNotice = `No ${color} ${category || "items"} currently in stock${max_price ? ` under $${max_price}` : ""}. Showing top curated ${category ? category + "s" : "matches"}:`;
        filteredScored = candidateScored.filter(sp => sp.categoryMatched && sp.score > 0);
      }
    }
  } else if (hasMaterialReq) {
    const strongMaterialMatches = candidateScored.filter(sp => sp.materialStrong && sp.score > 0);
    if (strongMaterialMatches.length > 0) {
      filteredScored = strongMaterialMatches;
    } else {
      const weakMaterialMatches = candidateScored.filter(sp => sp.materialMatched && sp.score > 0);
      if (weakMaterialMatches.length > 0) {
        fallbackNotice = `No ${material} ${category || "items"} pictured in stock${max_price ? ` under $${max_price}` : ""} — showing ${category || "items"} available in ${material} options:`;
        filteredScored = weakMaterialMatches;
      } else {
        fallbackNotice = `No ${material} ${category || "items"} currently in stock${max_price ? ` under $${max_price}` : ""}. Showing top curated ${category ? category + "s" : "matches"}:`;
        filteredScored = candidateScored.filter(sp => sp.categoryMatched && sp.score > 0);
      }
    }
  } else {
    filteredScored = candidateScored;
  }

  // Only keep positive scoring products that genuinely matched query attributes.
  // When a price fallback already fired, its candidates carry the -500
  // out-of-budget penalty — let them through the score gate so the
  // "closest alternatives" notice actually has products to show.
  filteredScored = filteredScored.filter(sp =>
    (sp.score >= 20.0 || Boolean(fallbackNotice)) &&
    (sp.categoryMatched || sp.matchDetails.length > 0)
  );
  // If a fallback notice was issued but nothing survived the attribute gates
  // (e.g. "stressless" — brand miss with no other attributes to match), show
  // the best candidates rather than a dead end. Prefer attribute matches;
  // price fallbacks already carry their own cheapest/closest ordering.
  if (filteredScored.length === 0 && fallbackNotice && candidateScored.length > 0) {
    const attrMatched = candidateScored.filter(sp => sp.categoryMatched || sp.colorMatched || sp.materialMatched || sp.brandMatched);
    const pool = attrMatched.length > 0 ? attrMatched : candidateScored;
    if (!hasMaxPriceReq && !hasMinPriceReq) pool.sort((a, b) => b.score - a.score);
    filteredScored = pool;
  } else {
    filteredScored.sort((a, b) => b.score - a.score);
  }

  // Live availability check on index-served finals — the index is a nightly
  // snapshot, so a product that sold out (or restocked) this morning carries
  // a stale inStock flag. One batched nodes() probe corrects the finalists;
  // predictive keystrokes keep snapshot availability for speed.
  // The content-index lookup is independent — fire it now so it overlaps
  // with the probe roundtrip instead of serializing behind it.
  const maxResultCap = fallbackNotice ? 8 : (typeof limit === "number" && limit > 0 ? limit : 48);
  const contentPromise = searchContentIndex(shopKey, naturalQuery, 5).catch(() => [] as any[]);
  if (!isPredictive && usedIndex && filteredScored.length > 0) {
    try {
      const checkCount = Math.min(filteredScored.length, Math.max(maxResultCap, 8) + 8, 40);
      const ids = filteredScored.slice(0, checkCount)
        .map(sp => sp.product?.id)
        .filter((id: any) => typeof id === "string" && id.startsWith("gid://"));
      if (ids.length > 0) {
        const availRes = await shopifyGraphQL<any>(AVAILABILITY_BY_IDS_QUERY, { ids }, { shopDomain: targetShop });
        for (const n of availRes.data?.nodes || []) {
          if (!n?.id) continue;
          const vEdges = n.variants?.edges || [];
          const live = vEdges.length > 0
            ? vEdges.some((v: any) => v.node?.availableForSale !== false)
            : (n.totalInventory ?? 0) > 0;
          const sp = filteredScored.find(s => s.product?.id === n.id);
          if (sp && sp.product.inStock !== live) {
            sp.product.inStock = live;
            if (typeof n.totalInventory === "number") sp.product.totalInventory = n.totalInventory;
          }
        }
      }
    } catch (availErr) {
      console.warn("Availability probe failed — using index snapshot:", availErr);
    }
  }

  // Availability partition — purchasable products always outrank
  // out-of-stock. OOS only surfaces when nothing in the pool can actually be
  // bought right now; otherwise it never appears in the grid.
  const buyablePool = filteredScored.filter(sp => sp.product.inStock !== false);
  if (buyablePool.length > 0) {
    filteredScored = buyablePool;
  } else if (filteredScored.length > 0 && !fallbackNotice) {
    fallbackNotice = `All matching ${category || "items"} are currently out of stock — showing what can be ordered:`;
  }

  // Predictive only needs handles for the suggest-rewrite — cap at 24.
  const finalProducts = filteredScored.slice(0, isPredictive ? Math.min(maxResultCap, 24) : maxResultCap).map(sp => sp.product);

  // Predictive responses ship a slim shape — the widget maps these to
  // handles, and full summaries turn a keystroke response into ~500KB.
  const responseProducts = isPredictive
    ? finalProducts.map((p: any) => ({ handle: p.handle, title: p.title, minPrice: p.minPrice, vendor: p.vendor, featuredImage: p.featuredImage }))
    : finalProducts;

  const smartSuggestions: string[] = generateSmartSuggestions(category, color, material, naturalQuery);

  // Content index — matching articles/pages/collections (started above,
  // overlapped with the availability probe).
  const contentResults = await contentPromise;

  // Asynchronous Non-Blocking Search Telemetry Capture (Only for intentional/final searches)
  if (shouldRecordTelemetry) {
    logTelemetry({
      shopDomain: targetShop || "jenniferfurniturestaging.myshopify.com",
      eventType: "search_query",
      queryText: naturalQuery,
      interpretedQuery: aiConstraints.interpreted_query || naturalQuery,
      extractedConstraints: {
        category: category || undefined,
        features: features.length > 0 ? features : undefined,
        color: color || undefined,
        material: material || undefined,
        brand: brand || undefined,
        min_price: typeof min_price === "number" ? min_price : undefined,
        max_price: typeof max_price === "number" ? max_price : undefined,
      },
      resultCount: finalProducts.length,
      zeroResult: finalProducts.length === 0,
      sessionId: effectiveSessionId,
    });
  }

  const resultData = {
    success: true,
    shop_domain: targetShop || "jenniferfurniturestaging.myshopify.com",
    count: finalProducts.length,
    index_used: usedIndex,
    semantic_only: semanticOnly,
    interpreted_query: aiConstraints.interpreted_query || naturalQuery,
    fallback_notice: fallbackNotice,
    ai_extracted_constraints: {
      category,
      features,
      color,
      material,
      brand,
      max_price,
      min_price,
      search_keywords: searchKeywords,
    },
    smart_suggestions: smartSuggestions.slice(0, 3),
    content_results: contentResults,
    products: responseProducts,
  };

  searchResultsCache.set(cacheKey, { data: resultData, ts: Date.now() });

  return {
    status: 200,
    headers: corsHeaders,
    data: resultData
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await handleSearch(body, request);
    return NextResponse.json(result.data, { status: result.status, headers: result.headers });
  } catch (error: any) {
    console.error("Search API Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to search products" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const naturalQuery = searchParams.get("q") || searchParams.get("query") || "";
    const category = searchParams.get("category") || undefined;
    const session_id = searchParams.get("session_id") || searchParams.get("sessionId") || undefined;
    const shop = searchParams.get("shop") || searchParams.get("shop_domain") || undefined;
    const is_predictive = searchParams.get("is_predictive") === "true" || searchParams.get("predictive") === "true";
    const is_final = searchParams.has("is_final") ? searchParams.get("is_final") === "true" : undefined;
    const limit = parseInt(searchParams.get("limit") || "250");

    const result = await handleSearch({
      query: naturalQuery,
      category,
      session_id,
      shop,
      is_predictive,
      is_final,
      limit,
    }, request);

    return NextResponse.json(result.data, { status: result.status, headers: result.headers });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
