import { getPgPool } from "./postgres";
import { cosine } from "@/lib/ai/embeddings";
import { supabaseVectorSearch, supabaseUpsertVectors, supabaseDeleteVector } from "./vectors_supabase";

/**
 * V2 per-shop catalog index (testing.aisearch_products_v2) — same shape as v1
 * plus an `embedding` jsonb column powering the semantic vector leg.
 * Vector search runs against a per-shop in-memory cache (catalogs ~1k rows;
 * cosine over 512-dim vectors is microseconds — no pgvector needed).
 */

export interface IndexedProductRow {
  handle: string;
  title: string;
  summary: any;
  rank: number;
}

const INDEX_ENABLED = Boolean(process.env.PG_PASSWORD);

let indexAvailable: boolean | null = null;

async function tableExists(pool: any): Promise<boolean> {
  if (indexAvailable !== null) return indexAvailable;
  try {
    const r = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='testing' AND table_name='aisearch_products_v2'`
    );
    indexAvailable = r.rows.length > 0;
  } catch {
    indexAvailable = false;
  }
  return indexAvailable;
}

const shopIndexCache = new Map<string, { has: boolean; ts: number }>();
const SHOP_INDEX_TTL = 60_000;

export async function hasIndexForShop(shopDomain: string): Promise<boolean> {
  if (!INDEX_ENABLED) return false;
  const hit = shopIndexCache.get(shopDomain);
  if (hit && Date.now() - hit.ts < SHOP_INDEX_TTL) return hit.has;
  try {
    const pool = getPgPool();
    if (!(await tableExists(pool))) return false;
    const r = await pool.query(
      `SELECT 1 FROM testing.aisearch_products_v2 WHERE shop_domain=$1 LIMIT 1`,
      [shopDomain]
    );
    shopIndexCache.set(shopDomain, { has: r.rows.length > 0, ts: Date.now() });
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

const FTS_DOC = `coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(search_text,'')`;

export async function searchCatalogIndex(params: {
  shopDomain: string;
  text: string;
  category?: string;
  brand?: string;
  color?: string;
  material?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
}): Promise<any[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  if (!(await tableExists(pool))) return [];

  const limit = Math.min(params.limit || 150, 250);
  const text = (params.text || "").trim();
  const args: any[] = [params.shopDomain];
  let where = `shop_domain = $1 AND status = 'active'`;

  if (typeof params.minPrice === "number" && params.minPrice > 0) {
    args.push(params.minPrice);
    where += ` AND min_price >= $${args.length}`;
  }
  if (typeof params.maxPrice === "number" && params.maxPrice > 0) {
    args.push(params.maxPrice);
    where += ` AND min_price <= $${args.length}`;
  }

  const terms: string[] = [];
  if (params.category) terms.push(params.category);
  if (text) terms.push(...text.split(/\s+/).filter((t) => t.length > 1));
  const uniqueTerms = [...new Set(terms.map((t) => t.toLowerCase()))];
  const searchTerms = uniqueTerms.filter(
    (t) => !["show", "me", "a", "an", "the", "for", "with", "under", "above", "over", "in", "of", "and", "or", "to", "get", "buy", "i", "want", "looking"].includes(t)
  );

  const textClauses: string[] = [];
  if (searchTerms.length > 0) {
    args.push(searchTerms.join(" & "));
    textClauses.push(`to_tsvector('english', ${FTS_DOC}) @@ to_tsquery('english', $${args.length})`);
    args.push(searchTerms.join(" | "));
    textClauses.push(`to_tsvector('english', ${FTS_DOC}) @@ to_tsquery('english', $${args.length})`);
  }
  if (params.brand) {
    args.push(`%${params.brand.toLowerCase()}%`);
    textClauses.push(
      `(lower(coalesce(vendor,'')) LIKE $${args.length} OR lower(coalesce(title,'')) LIKE $${args.length} OR lower(coalesce(search_text,'')) LIKE $${args.length})`
    );
  }

  const textWhere = textClauses.length > 0 ? `(${textClauses.join(" OR ")})` : "TRUE";

  let rankExpr = "0";
  if (searchTerms.length > 0) {
    args.push(searchTerms.join(" & "));
    rankExpr = `ts_rank(to_tsvector('english', ${FTS_DOC}), to_tsquery('english', $${args.length}))`;
  }

  args.push(limit);
  const r = await pool.query(
    `SELECT summary, ${rankExpr} AS rank
     FROM testing.aisearch_products_v2
     WHERE ${where} AND ${textWhere}
     ORDER BY rank DESC, (total_inventory > 0) DESC, min_price ASC NULLS LAST
     LIMIT $${args.length}`,
    args
  );
  return r.rows.map((row: any) => row.summary);
}

/** SKU-style lookup — wildcards on the sku_list jsonb text. */
export async function searchIndexBySku(shopDomain: string, token: string): Promise<any[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  if (!(await tableExists(pool))) return [];
  const r = await pool.query(
    `SELECT summary FROM testing.aisearch_products_v2
      WHERE shop_domain=$1 AND status='active' AND sku_list::text ILIKE $2
      LIMIT 25`,
    [shopDomain, `%${token}%`]
  );
  return r.rows.map((row: any) => row.summary);
}

// ── Vector / semantic layer ────────────────────────────────────────────

/** Per-shop vector cache: product_id -> embedding (Float32Array). */
const vectorCache = new Map<string, { rows: { product_id: string; emb: Float32Array }[]; ts: number }>();
const VECTOR_CACHE_TTL = 5 * 60_000;

async function loadShopVectors(shopDomain: string, force = false) {
  const hit = vectorCache.get(shopDomain);
  if (!force && hit && Date.now() - hit.ts < VECTOR_CACHE_TTL) return hit.rows;
  const pool = getPgPool();
  const r = await pool.query(
    `SELECT product_id, embedding FROM testing.aisearch_products_v2
      WHERE shop_domain=$1 AND status='active' AND embedding IS NOT NULL`,
    [shopDomain]
  );
  const rows = r.rows.map((row: any) => ({
    product_id: row.product_id as string,
    emb: Float32Array.from(row.embedding || []),
  })).filter((row: any) => row.emb.length > 0);
  vectorCache.set(shopDomain, { rows, ts: Date.now() });
  return rows;
}

/** Drop a shop's cached vectors (call after embed backfill). */
export function invalidateVectorCache(shopDomain: string) {
  vectorCache.delete(shopDomain);
}

/**
 * Semantic candidates: cosine the query vector against the cached catalog.
 * Returns product_ids ranked by similarity (top `limit`, similarity > floor).
 */
export interface VectorHit {
  product_id: string;
  sim: number;   // blended (max of legs)
  isim: number;  // image-space sim — visual proximity to the query
}

export async function vectorSearchProductIds(
  shopDomain: string,
  queryVec: number[],
  limit = 100,
  floor = 0.25
): Promise<VectorHit[]> {
  if (!INDEX_ENABLED || !queryVec || queryVec.length === 0) return [];
  // pgvector on Supabase is the serving layer — in-DB HNSW cosine,
  // dual-leg (product text OR product photo can match).
  const sb = await supabaseVectorSearch(shopDomain, queryVec, limit, floor);
  if (sb.length > 0) return sb;
  // Fallback: in-memory cosine over PG-stored text embeddings (no image leg).
  try {
    const rows = await loadShopVectors(shopDomain);
    const q = Float32Array.from(queryVec);
    const scored: VectorHit[] = [];
    for (const row of rows) {
      const s = cosine(q, row.emb);
      if (s >= floor) scored.push({ product_id: row.product_id, sim: s, isim: 0 });
    }
    scored.sort((a, b) => b.sim - a.sim);
    return scored.slice(0, limit);
  } catch (e: any) {
    console.error("[v2 vectors] search failed:", e?.message || e);
    return [];
  }
}

/**
 * Image-space sims for specific product_ids — used by the color gate so
 * EVERY color-claimant gets evaluated against the cohort, not just the
 * top-100 vector hits. One small query; jsonb vectors cosined in JS.
 */
export async function imageSimsForProducts(
  shopDomain: string,
  productIds: string[],
  queryVec: number[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!INDEX_ENABLED || productIds.length === 0 || queryVec.length === 0) return out;
  const pool = getPgPool();
  try {
    const r = await pool.query(
      `SELECT product_id, image_embedding FROM testing.aisearch_products_v2
        WHERE shop_domain=$1 AND status='active' AND image_embedding IS NOT NULL
          AND product_id = ANY($2)`,
      [shopDomain, productIds]
    );
    const q = Float32Array.from(queryVec);
    for (const row of r.rows) {
      const v = Float32Array.from(row.image_embedding || []);
      if (v.length === q.length) out.set(row.product_id, cosine(q, v));
    }
  } catch (e: any) {
    console.error("[v2 vectors] imageSimsForProducts:", e?.message || e);
  }
  return out;
}

/** Fetch summaries for a list of product_ids (vector-only hits). */
export async function getIndexRowsByIds(shopDomain: string, productIds: string[]): Promise<any[]> {
  if (!INDEX_ENABLED || productIds.length === 0) return [];
  const pool = getPgPool();
  const r = await pool.query(
    `SELECT summary FROM testing.aisearch_products_v2
      WHERE shop_domain=$1 AND status='active' AND product_id = ANY($2)`,
    [shopDomain, productIds]
  );
  return r.rows.map((row: any) => row.summary);
}

/** Map a ProductSummary back to its indexed product_id for merging. */
export function summaryProductId(s: any): string {
  return String(s?.id || s?.productId || s?.handle || "");
}

/**
 * Reciprocal-rank fusion of FTS results + vector hits.
 * Vector-only products' summaries are fetched and appended to the pool;
 * pure recall boost — the shared scoring layer still ranks everything.
 */
export async function mergeSemanticCandidates(
  shopDomain: string,
  ftsSummaries: any[],
  vecHits: VectorHit[]
): Promise<any[]> {
  if (vecHits.length === 0) return ftsSummaries;
  const simById = new Map(vecHits.map((v) => [v.product_id, v]));
  // Tag every product that came back in EITHER leg (FTS rows included) so the
  // scorer gets semantic + visual proximity regardless of retrieval path.
  for (const s of ftsSummaries) {
    const v = simById.get(summaryProductId(s));
    if (v) { s.__vectorSim = v.sim; s.__imageSim = v.isim; }
  }
  const seen = new Set(ftsSummaries.map(summaryProductId));
  const missing = vecHits.map((v) => v.product_id).filter((id) => !seen.has(id)).slice(0, 60);
  if (missing.length === 0) return ftsSummaries;
  const extra = await getIndexRowsByIds(shopDomain, missing);
  for (const s of extra) {
    const v = simById.get(summaryProductId(s));
    s.__vectorSim = v?.sim || 0;
    s.__imageSim = v?.isim || 0;
  }
  return [...ftsSummaries, ...extra];
}

/** Searchable text snapshot — same formula used at upsert; compared to detect staleness. */
export function productSearchText(s: any): string {
  return [
    s.title || "", s.vendor || "", s.productType || "",
    (s.tags || []).join(" "), (s.skuList || []).join(" "),
    (s.collections || []).join(" "),
    (s.availableColors || []).join(" "),
    (s.availableMaterials || []).join(" "),
  ].join(" ").slice(0, 20000);
}

/**
 * Product ids whose vectors are stale: no text vec, or the featured photo
 * is new/changed relative to embedded_image_url (dead URLs and image swaps
 * both count — self-heals when a merchant fixes a listing photo).
 */
export async function getUnembeddedProductIds(shopDomain: string, limit = 3000): Promise<string[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  try {
    const r = await pool.query(
      `SELECT product_id FROM testing.aisearch_products_v2
        WHERE shop_domain=$1 AND status='active' AND (
          embedding IS NULL
          OR (summary->>'featuredImage' LIKE 'http%'
              AND (image_embedding IS NULL
                   OR embedded_image_url IS DISTINCT FROM summary->>'featuredImage'))
        )
        LIMIT $2`,
      [shopDomain, limit]
    );
    return r.rows.map((x: any) => x.product_id as string);
  } catch {
    return [];
  }
}

/** Per-product embed state — the webhook handler's staleness check. */
export async function getProductEmbedState(
  shopDomain: string,
  productId: string
): Promise<{ hasText: boolean; hasImg: boolean; embeddedImageUrl: string | null; searchText: string | null } | null> {
  if (!INDEX_ENABLED) return null;
  const pool = getPgPool();
  try {
    const r = await pool.query(
      `SELECT embedding IS NOT NULL AS has_text, image_embedding IS NOT NULL AS has_img,
              embedded_image_url, search_text
         FROM testing.aisearch_products_v2
        WHERE shop_domain=$1 AND product_id=$2`,
      [shopDomain, productId]
    );
    if (r.rows.length === 0) return null;
    return {
      hasText: !!r.rows[0].has_text,
      hasImg: !!r.rows[0].has_img,
      embeddedImageUrl: r.rows[0].embedded_image_url || null,
      searchText: r.rows[0].search_text || null,
    };
  } catch {
    return null;
  }
}

/**
 * Store text + image embeddings for indexed products (sync/backfill/webhook).
 * image_embedding: null explicitly clears (photo removed); image_url records
 * which featured URL produced the stored vector (change detection).
 */
export async function upsertProductEmbeddings(
  shopDomain: string,
  rows: { product_id: string; embedding?: number[]; image_embedding?: number[] | null; image_url?: string | null }[]
): Promise<void> {
  if (!INDEX_ENABLED || rows.length === 0) return;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of rows) {
      if (r.embedding?.length) {
        await client.query(
          `UPDATE testing.aisearch_products_v2 SET embedding=$3, updated_at=now()
            WHERE shop_domain=$1 AND product_id=$2`,
          [shopDomain, r.product_id, JSON.stringify(r.embedding)]
        );
      }
      if (r.image_embedding === null) {
        await client.query(
          `UPDATE testing.aisearch_products_v2 SET image_embedding=NULL, embedded_image_url=NULL, updated_at=now()
            WHERE shop_domain=$1 AND product_id=$2`,
          [shopDomain, r.product_id]
        );
      } else if (r.image_embedding?.length) {
        await client.query(
          `UPDATE testing.aisearch_products_v2 SET image_embedding=$3, embedded_image_url=$4, updated_at=now()
            WHERE shop_domain=$1 AND product_id=$2`,
          [shopDomain, r.product_id, JSON.stringify(r.image_embedding), r.image_url || null]
        );
      }
    }
    await client.query("COMMIT");
    invalidateVectorCache(shopDomain);
    // Dual-write to pgvector serving layer (fire-and-forget safe)
    supabaseUpsertVectors(rows, shopDomain).catch(() => {});
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Upsert normalized ProductSummary objects into the v2 index. */
export async function upsertProductsToIndex(shopDomain: string, summaries: any[]): Promise<void> {
  if (!INDEX_ENABLED || summaries.length === 0) return;
  const pool = getPgPool();
  if (!(await tableExists(pool))) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const s of summaries) {
      const searchText = productSearchText(s);
      await client.query(
        `INSERT INTO testing.aisearch_products_v2
           (shop_domain, product_id, handle, title, vendor, product_type, tags, sku_list,
            min_price, max_price, total_inventory, status, summary, search_text, synced_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active',$12,$13,now(),now())
         ON CONFLICT (shop_domain, product_id) DO UPDATE SET
           handle=excluded.handle, title=excluded.title, vendor=excluded.vendor,
           product_type=excluded.product_type, tags=excluded.tags, sku_list=excluded.sku_list,
           min_price=excluded.min_price, max_price=excluded.max_price,
           total_inventory=excluded.total_inventory, status='active',
           summary=excluded.summary, search_text=excluded.search_text, updated_at=now()`,
        [
          shopDomain,
          String(s.id || s.productId || s.handle),
          s.handle,
          s.title,
          s.vendor || null,
          s.productType || null,
          JSON.stringify(s.tags || []),
          JSON.stringify(s.skuList || []),
          s.minPrice ?? null,
          s.maxPrice ?? null,
          s.totalInventory ?? 0,
          JSON.stringify(s),
          searchText,
        ]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export interface IndexedContent {
  type: "page" | "article" | "collection";
  title: string;
  url: string;
  handle?: string;
}

export async function searchContentIndex(shopDomain: string, text: string, limit = 5): Promise<IndexedContent[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  try {
    const terms = (text || "").split(/\s+/).filter((t) => t.length > 1 &&
      !["show","me","a","an","the","for","with","under","above","over","in","of","and","or","to","get","buy","i","want","looking"].includes(t.toLowerCase()));
    if (terms.length === 0) return [];
    const r = await pool.query(
      `SELECT content_type, title, url, handle,
              ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')), to_tsquery('english', $2)) AS rank
       FROM testing.aisearch_content_v2
       WHERE shop_domain=$1
         AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')) @@ to_tsquery('english', $2)
       ORDER BY rank DESC LIMIT $3`,
      [shopDomain, terms.join(" | "), limit]
    );
    return r.rows.map((row: any) => ({
      type: row.content_type,
      title: (row.title || "").replace(/&ndash;|&mdash;/g, "—").replace(/&amp;/g, "&").replace(/&[a-z]+;|&#\d+;/gi, "").replace(/\s+/g, " ").trim(),
      url: row.url || `/${row.content_type}s/${row.handle}`, handle: row.handle,
    }));
  } catch {
    return [];
  }
}

export async function upsertContentToIndex(shopDomain: string, items: { type: string; id: string; title: string; handle?: string; body?: string; url?: string }[]): Promise<void> {
  if (!INDEX_ENABLED || items.length === 0) return;
  const pool = getPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const it of items) {
      await client.query(
        `INSERT INTO testing.aisearch_content_v2 (shop_domain, content_type, object_id, handle, title, body, url, synced_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
         ON CONFLICT (shop_domain, content_type, object_id) DO UPDATE SET
           handle=excluded.handle, title=excluded.title, body=excluded.body, url=excluded.url, updated_at=now()`,
        [shopDomain, it.type, String(it.id), it.handle || null, it.title, (it.body || "").slice(0, 40000), it.url || null]
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export async function upsertContentEmbeddings(
  shopDomain: string,
  rows: { object_id: string; content_type: string; embedding: number[] }[]
): Promise<void> {
  if (!INDEX_ENABLED || rows.length === 0) return;
  const pool = getPgPool();
  for (const r of rows) {
    if (!r.embedding || r.embedding.length === 0) continue;
    await pool.query(
      `UPDATE testing.aisearch_content_v2 SET embedding=$4, updated_at=now()
        WHERE shop_domain=$1 AND content_type=$2 AND object_id=$3`,
      [shopDomain, r.content_type, r.object_id, JSON.stringify(r.embedding)]
    ).catch(() => {});
  }
}

export async function deleteProductFromIndex(shopDomain: string, productId: string): Promise<void> {
  if (!INDEX_ENABLED) return;
  const pool = getPgPool();
  await pool.query(
    `UPDATE testing.aisearch_products_v2 SET status='archived', updated_at=now() WHERE shop_domain=$1 AND product_id=$2`,
    [shopDomain, String(productId)]
  ).catch(() => {});
  invalidateVectorCache(shopDomain);
  supabaseDeleteVector(shopDomain, String(productId)).catch(() => {});
}
