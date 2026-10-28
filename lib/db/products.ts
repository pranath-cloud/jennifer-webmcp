import { getPgPool } from "./postgres";

/**
 * Per-shop catalog index (testing.aisearch_products).
 * Products are hydrated ProductSummary jsonb so index hits feed the SAME
 * scoring/ranking code as live Shopify results — one scoring layer.
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
      `SELECT 1 FROM information_schema.tables WHERE table_schema='testing' AND table_name='aisearch_products'`
    );
    indexAvailable = r.rows.length > 0;
  } catch {
    indexAvailable = false;
  }
  return indexAvailable;
}

// Per-shop index-presence cache — saves a remote-PG roundtrip per keystroke
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
      `SELECT 1 FROM testing.aisearch_products WHERE shop_domain=$1 LIMIT 1`,
      [shopDomain]
    );
    shopIndexCache.set(shopDomain, { has: r.rows.length > 0, ts: Date.now() });
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Full-text search of the local catalog index.
 * Strategy: tsvector @@ websearch_to_tsquery handles phrases/quotes/typos-to-
 * stems. Falls back to an OR'd ILIKE pass when FTS yields nothing (SKUs and
 * oddball spellings aren't stemmed well).
 */
export async function searchCatalogIndex(params: {
  shopDomain: string;
  text: string;            // natural query or extracted keywords
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

  // Build the text predicate — category and keywords union
  const terms: string[] = [];
  if (params.category) terms.push(params.category);
  if (text) terms.push(...text.split(/\s+/).filter((t) => t.length > 1));
  const uniqueTerms = [...new Set(terms.map((t) => t.toLowerCase()))];

  const textClauses: string[] = [];
  const searchTerms = uniqueTerms.filter(
    (t) => !["show", "me", "a", "an", "the", "for", "with", "under", "above", "over", "in", "of", "and", "or", "to", "get", "buy", "i", "want", "looking"].includes(t)
  );

  if (searchTerms.length > 0) {
    const andQuery = searchTerms.join(" & ");
    args.push(andQuery);
    textClauses.push(
      `to_tsvector('english', coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(search_text,''))
        @@ to_tsquery('english', $${args.length})`
    );
    // OR'd variant so partial matches still return (scoring ranks them)
    const orQuery = searchTerms.join(" | ");
    args.push(orQuery);
    textClauses.push(
      `to_tsvector('english', coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(search_text,''))
        @@ to_tsquery('english', $${args.length})`
    );
  }
  if (params.brand) {
    args.push(`%${params.brand.toLowerCase()}%`);
    textClauses.push(
      `(lower(coalesce(vendor,'')) LIKE $${args.length} OR lower(coalesce(title,'')) LIKE $${args.length} OR lower(coalesce(search_text,'')) LIKE $${args.length})`
    );
  }

  const textWhere = textClauses.length > 0 ? `(${textClauses.join(" OR ")})` : "TRUE";

  // Ranking: exact-ish (AND) hits first, then partial OR hits, in-stock boost
  let rankExpr = "0";
  if (searchTerms.length > 0) {
    const andQ = searchTerms.join(" & ");
    args.push(andQ);
    rankExpr = `ts_rank(
      to_tsvector('english', coalesce(title,'') || ' ' || coalesce(vendor,'') || ' ' || coalesce(product_type,'') || ' ' || coalesce(search_text,'')),
      to_tsquery('english', $${args.length}))`;
  }

  args.push(limit);
  const sql = `
    SELECT summary, ${rankExpr} AS rank
    FROM testing.aisearch_products
    WHERE ${where} AND ${textWhere}
    ORDER BY rank DESC, (total_inventory > 0) DESC, min_price ASC NULLS LAST
    LIMIT $${args.length}
  `;

  const r = await pool.query(sql, args);
  return r.rows.map((row: any) => row.summary);
}

/** SKU-style lookup — wildcards on the sku_list jsonb text. */
export async function searchIndexBySku(shopDomain: string, token: string): Promise<any[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  if (!(await tableExists(pool))) return [];
  const r = await pool.query(
    `SELECT summary FROM testing.aisearch_products
      WHERE shop_domain=$1 AND status='active' AND sku_list::text ILIKE $2
      LIMIT 25`,
    [shopDomain, `%${token}%`]
  );
  return r.rows.map((row: any) => row.summary);
}

/** Upsert normalized ProductSummary objects into the index (fire-and-forget safe). */
export async function upsertProductsToIndex(shopDomain: string, summaries: any[]): Promise<void> {
  if (!INDEX_ENABLED || summaries.length === 0) return;
  const pool = getPgPool();
  if (!(await tableExists(pool))) return;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const s of summaries) {
      const searchText = [
        s.title || "", s.vendor || "", s.productType || "",
        (s.tags || []).join(" "), (s.skuList || []).join(" "),
        (s.collections || []).join(" "),
        (s.availableColors || []).join(" "),
        (s.availableMaterials || []).join(" "),
      ].join(" ").slice(0, 20000);
      await client.query(
        `INSERT INTO testing.aisearch_products
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

/** Search the content index (pages, articles, collections) — the site's RAG base. */
export async function searchContentIndex(shopDomain: string, text: string, limit = 5): Promise<IndexedContent[]> {
  if (!INDEX_ENABLED) return [];
  const pool = getPgPool();
  try {
    const terms = (text || "").split(/\s+/).filter((t) => t.length > 1 &&
      !["show","me","a","an","the","for","with","under","above","over","in","of","and","or","to","get","buy","i","want","looking"].includes(t.toLowerCase()));
    if (terms.length === 0) return [];
    const q = terms.join(" | ");
    const r = await pool.query(
      `SELECT content_type, title, url, handle,
              ts_rank(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')), to_tsquery('english', $2)) AS rank
       FROM testing.aisearch_content
       WHERE shop_domain=$1
         AND to_tsvector('english', coalesce(title,'') || ' ' || coalesce(body,'')) @@ to_tsquery('english', $2)
       ORDER BY rank DESC LIMIT $3`,
      [shopDomain, q, limit]
    );
    return r.rows.map((row: any) => ({
      type: row.content_type, title: row.title, url: row.url || `/${row.content_type}s/${row.handle}`, handle: row.handle,
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
        `INSERT INTO testing.aisearch_content (shop_domain, content_type, object_id, handle, title, body, url, synced_at, updated_at)
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

export async function deleteProductFromIndex(shopDomain: string, productId: string): Promise<void> {
  if (!INDEX_ENABLED) return;
  const pool = getPgPool();
  await pool.query(
    `UPDATE testing.aisearch_products SET status='archived', updated_at=now() WHERE shop_domain=$1 AND product_id=$2`,
    [shopDomain, String(productId)]
  ).catch(() => {});
}
