/**
 * pgvector serving layer on Supabase (Postgres 17 + hnsw indexes).
 * Each product row carries TWO vectors in gemini-embedding-2's shared space:
 *   text_embedding  — title/tags/type/vendor (semantic)
 *   image_embedding — the featured photo (visual truth)
 * match_products_mm RPC returns both sims + blended max so the scorer can
 * weight visual proximity separately on color/material queries.
 */

const SB_URL = process.env.SUPABASE_URL;
const SB_KEY = process.env.SUPABASE_SERVICE_KEY;

export function supabaseVectorsEnabled(): boolean {
  return Boolean(SB_URL && SB_KEY);
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: SB_KEY!,
    Authorization: `Bearer ${SB_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export interface VecMatch {
  product_id: string;
  sim: number;   // max(tsim, isim)
  tsim: number;  // text-space similarity
  isim: number;  // image-space similarity (0 when no image vector)
}

/** In-DB cosine match via RPC — text leg OR image leg can rescue a product. */
export async function supabaseVectorSearch(
  shopDomain: string,
  queryVec: number[],
  limit = 100,
  floor = 0.25
): Promise<VecMatch[]> {
  if (!supabaseVectorsEnabled() || !queryVec.length) return [];
  try {
    const res = await fetch(`${SB_URL}/rest/v1/rpc/match_products_mm`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        p_shop: shopDomain,
        p_query: `[${queryVec.join(",")}]`,
        p_limit: limit,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      console.error("[supabase vec] match failed:", res.status, (await res.text()).slice(0, 200));
      return [];
    }
    const rows: any[] = await res.json();
    return rows
      .map((r) => ({
        product_id: r.product_id as string,
        tsim: (r.tsim as number) || 0,
        isim: (r.isim as number) || 0,
        sim: (r.sim as number) || 0,
      }))
      .filter((r) => r.sim >= floor);
  } catch (e: any) {
    console.error("[supabase vec]", e?.message || e);
    return [];
  }
}

/**
 * Upsert text + image vectors (PostgREST merge-duplicates).
 * Rows carrying a text vec upsert both legs; image-only rows PATCH just the
 * image column so a photo refresh can never wipe an existing text vector.
 */
export async function supabaseUpsertVectors(
  rows: { product_id: string; embedding?: number[]; image_embedding?: number[] | null }[],
  shopDomain: string
): Promise<number> {
  if (!supabaseVectorsEnabled() || rows.length === 0) return 0;
  let ok = 0;
  try {
    const full = rows.filter((r) => r.embedding?.length);
    const imgOnly = rows.filter((r) => !r.embedding?.length && r.image_embedding !== undefined);
    const now = new Date().toISOString();

    // Every object needs identical keys for PostgREST merge-duplicates —
    // null out missing legs rather than omitting the key.
    const body = full.map((r) => ({
      shop_domain: shopDomain,
      product_id: r.product_id,
      text_embedding: `[${(r.embedding as number[]).join(",")}]`,
      image_embedding: r.image_embedding?.length ? `[${r.image_embedding.join(",")}]` : null,
      updated_at: now,
    }));
    for (let i = 0; i < body.length; i += 200) {
      const res = await fetch(`${SB_URL}/rest/v1/product_embeddings`, {
        method: "POST",
        headers: headers({ Prefer: "resolution=merge-duplicates" }),
        body: JSON.stringify(body.slice(i, i + 200)),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) ok += Math.min(200, body.length - i);
      else console.error("[supabase vec] upsert failed:", res.status, (await res.text()).slice(0, 150));
    }

    // Image-only updates — PATCH touches just the one column.
    for (const r of imgOnly) {
      const res = await fetch(
        `${SB_URL}/rest/v1/product_embeddings?shop_domain=eq.${encodeURIComponent(shopDomain)}&product_id=eq.${encodeURIComponent(r.product_id)}`,
        {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({
            image_embedding: r.image_embedding?.length ? `[${r.image_embedding.join(",")}]` : null,
            updated_at: now,
          }),
          signal: AbortSignal.timeout(15000),
        }
      ).catch(() => null);
      if (res?.ok) ok++;
      else if (res) console.error("[supabase vec] img patch failed:", res.status);
    }
    return ok;
  } catch (e: any) {
    console.error("[supabase vec] upsert:", e?.message || e);
    return ok;
  }
}

export async function supabaseDeleteVector(shopDomain: string, productId: string): Promise<void> {
  if (!supabaseVectorsEnabled()) return;
  await fetch(
    `${SB_URL}/rest/v1/product_embeddings?shop_domain=eq.${encodeURIComponent(shopDomain)}&product_id=eq.${encodeURIComponent(productId)}`,
    { method: "DELETE", headers: headers(), signal: AbortSignal.timeout(6000) }
  ).catch(() => {});
}
