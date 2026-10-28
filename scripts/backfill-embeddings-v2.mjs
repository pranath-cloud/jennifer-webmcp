/**
 * Resumable embedding backfill — gemini-embedding-2 (768-dim, multimodal).
 * Embeds product TEXT + featured PHOTO into one shared space, writes
 * PG (testing.aisearch_products_v2) + Supabase pgvector (product_embeddings).
 *
 *   node scripts/backfill-embeddings-v2.mjs [shop_domain] [--all]
 *     default: only rows missing text OR image embedding
 *     --all:   re-embed every active product (model upgrade)
 */
import pg from "pg";
import { readFileSync } from "fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SHOP = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "jennifurniture.myshopify.com";
const FORCE_ALL = process.argv.includes("--all");
const MODEL = env.EMBEDDING_MODEL || "google/gemini-embedding-2";
const DIMS = parseInt(env.EMBEDDING_DIMS || "768");
const KEY = env.OPENROUTER_API_KEY;
const SB_URL = env.SUPABASE_URL;
const SB_KEY = env.SUPABASE_SERVICE_KEY;
const BATCH = 24;

const pool = new pg.Pool({
  host: env.PG_HOST, port: parseInt(env.PG_PORT || "5000"),
  database: env.PG_DATABASE, user: env.PG_USER, password: env.PG_PASSWORD, max: 3,
});

async function embed(inputs) {
  const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model: MODEL,
      input: inputs.map((content) => ({ content })),
      dimensions: DIMS,
    }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}: ${(await res.text()).slice(0, 150)}`);
  return (await res.json()).data.map((d) => d.embedding);
}

function productText(s) {
  return [
    s.title || "", s.vendor || "", s.productType || "",
    (s.tags || []).join(" "), (s.collections || []).join(" "),
    (s.availableColors || []).join(" "), (s.availableMaterials || []).join(" "),
    (s.features || []).join(" "),
  ].join(" ").replace(/\s+/g, " ").trim().slice(0, 4000);
}

async function pushSupabase(rows) {
  if (!SB_URL || !SB_KEY || rows.length === 0) return;
  const body = rows.map((r) => ({
    shop_domain: SHOP, product_id: r.product_id,
    text_embedding: r.embedding?.length ? `[${r.embedding.join(",")}]` : null,
    image_embedding: r.image_embedding?.length ? `[${r.image_embedding.join(",")}]` : null,
    updated_at: new Date().toISOString(),
  }));
  await fetch(`${SB_URL}/rest/v1/product_embeddings`, {
    method: "POST",
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify(body),
  }).then(async (r) => { if (!r.ok) console.error("sb push:", r.status, (await r.text()).slice(0, 120)); }).catch(() => {});
}

async function backfill() {
  const where = FORCE_ALL
    ? "status='active'"
    : `status='active' AND (embedding IS NULL
        OR (summary->>'featuredImage' LIKE 'http%'
            AND (image_embedding IS NULL
                 OR embedded_image_url IS DISTINCT FROM summary->>'featuredImage')))`;
  const total = (await pool.query(
    `SELECT count(*) c FROM testing.aisearch_products_v2 WHERE shop_domain=$1 AND ${where}`, [SHOP]
  )).rows[0].c;
  console.log(`${SHOP}: ${total} products to embed${FORCE_ALL ? " (forced re-embed)" : ""}`);

  let done = 0, offset = 0;
  for (;;) {
    // missing-only mode: processed rows leave the result set, so always
    // read page 0. --all mode: rows stay, so paginate forward.
    const off = FORCE_ALL ? offset : 0;
    const r = await pool.query(
      `SELECT product_id, summary FROM testing.aisearch_products_v2
        WHERE shop_domain=$1 AND ${where} ORDER BY product_id LIMIT $2 OFFSET $3`,
      [SHOP, BATCH, off]
    );
    if (r.rows.length === 0) break;

    const texts = r.rows.map((x) => productText(x.summary || {}));
    const imgUrls = r.rows.map((x) => {
      const u = x.summary?.featuredImage;
      return typeof u === "string" && u.startsWith("http") ? u : null;
    });

    // Text batch — one bad row can only kill its own slot at worst; on a
    // 400 we retry row-by-row so a bad item never sinks the batch.
    let textVecs = [];
    try {
      textVecs = await embed(texts.map((t) => [{ type: "text", text: t }]));
    } catch (e) {
      console.error("\ntext batch failed — retrying singly:", e.message);
      for (const t of texts) {
        try { textVecs.push((await embed([[{ type: "text", text: t }]]))[0] || []); }
        catch { textVecs.push([]); }
      }
    }

    // Images — batch, then per-image retry on failure (a dead CDN URL or
    // invalid format only loses its own vector).
    const validIdx = imgUrls.map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
    const imgVecsByIdx = new Map();
    try {
      const vs = await embed(validIdx.map((i) => [{ type: "image_url", image_url: { url: imgUrls[i] } }]));
      validIdx.forEach((i, k) => imgVecsByIdx.set(i, vs[k] || []));
    } catch (e) {
      console.error("\nimg batch failed — retrying singly:", e.message);
      for (const i of validIdx) {
        try { imgVecsByIdx.set(i, (await embed([[{ type: "image_url", image_url: { url: imgUrls[i] } }]]))[0] || []); }
        catch { imgVecsByIdx.set(i, []); }
      }
    }

    for (let i = 0; i < r.rows.length; i++) {
      const pid = r.rows[i].product_id;
      const tvec = textVecs[i] || [];
      const ivec = imgVecsByIdx.get(i) || [];
      if (!tvec.length && !ivec.length) continue;
      await pool.query(
        `UPDATE testing.aisearch_products_v2
          SET embedding = COALESCE($3, embedding),
              image_embedding = COALESCE($4, image_embedding),
              embedded_image_url = CASE WHEN $4 IS NOT NULL THEN $5 ELSE embedded_image_url END,
              updated_at = now()
          WHERE shop_domain=$1 AND product_id=$2`,
        [SHOP, pid, tvec.length ? JSON.stringify(tvec) : null, ivec.length ? JSON.stringify(ivec) : null, imgUrls[i]]
      );
    }
    await pushSupabase(r.rows.map((x, i) => ({
      product_id: x.product_id,
      embedding: textVecs[i] || [],
      image_embedding: (imgVecsByIdx.get(i) || []).length ? imgVecsByIdx.get(i) : null,
    })).filter((x) => x.embedding.length));
    done += r.rows.length;
    offset += r.rows.length;
    process.stdout.write(`embedded ${done}/${total}\r`);
    if (!FORCE_ALL && done >= total) break;
  }
  console.log(`\ndone: ${done}`);
}

if (!KEY) { console.error("OPENROUTER_API_KEY missing"); process.exit(1); }
await backfill();
await pool.end();
