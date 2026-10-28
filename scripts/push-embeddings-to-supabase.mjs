/**
 * One-time / resumable push: copy embeddings from testing.aisearch_products_v2
 * into the Supabase pgvector table (product_embeddings) via PostgREST upsert.
 *
 *   node scripts/push-embeddings-to-supabase.mjs [shop_domain]
 */
import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SHOP = process.argv[2] || "jenniferfurniturestaging.myshopify.com";
const SB_URL = env.SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_KEY;
if (!SB_URL || !SB_KEY) { console.error("SUPABASE_URL / SUPABASE_SERVICE_KEY missing in .env.local"); process.exit(1); }

const pool = new pg.Pool({
  host: env.PG_HOST, port: parseInt(env.PG_PORT || "5000"),
  database: env.PG_DATABASE, user: env.PG_USER, password: env.PG_PASSWORD, max: 3,
});

const BATCH = 500;
let pushed = 0, cursor = 0;
for (;;) {
  const r = await pool.query(
    `SELECT product_id, embedding, image_embedding FROM testing.aisearch_products_v2
      WHERE shop_domain=$1 AND status='active' AND embedding IS NOT NULL
      ORDER BY product_id LIMIT $2 OFFSET $3`,
    [SHOP, BATCH, cursor]
  );
  if (r.rows.length === 0) break;
  const body = r.rows.map((x) => ({
    shop_domain: SHOP, product_id: x.product_id,
    text_embedding: x.embedding?.length ? `[${x.embedding.join(",")}]` : null,
    image_embedding: x.image_embedding?.length ? `[${x.image_embedding.join(",")}]` : null,
    updated_at: new Date().toISOString(),
  }));
  const res = await fetch(`${SB_URL}/rest/v1/product_embeddings`, {
    method: "POST",
    headers: {
      apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json", Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) { console.error("upsert failed:", res.status, (await res.text()).slice(0, 200)); break; }
  pushed += r.rows.length;
  cursor += r.rows.length;
  process.stdout.write(`pushed ${pushed}\r`);
}
console.log(`\ndone: ${pushed} vectors`);
await pool.end();
