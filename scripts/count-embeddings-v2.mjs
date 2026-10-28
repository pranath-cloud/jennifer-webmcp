import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const kv = Object.fromEntries(env.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));

const c = new pg.Client({ host: kv.PG_HOST, port: +kv.PG_PORT, user: kv.PG_USER, password: kv.PG_PASSWORD, database: kv.PG_DATABASE });
await c.connect();
const p = await c.query(`SELECT shop_domain, count(*) total, count(embedding) txt, count(image_embedding) img FROM testing.aisearch_products_v2 GROUP BY 1 ORDER BY 1`);
console.log('PRODUCTS (aisearch_products_v2):');
for (const r of p.rows) console.log(`  ${r.shop_domain}: ${r.total} products | text-emb ${r.txt} | image-emb ${r.img}`);
const ct = await c.query(`SELECT shop_domain, count(*) total, count(embedding) emb, count(*) filter (where content_type='article') articles, count(*) filter (where content_type='page') pages, count(*) filter (where content_type='collection') collections FROM testing.aisearch_content_v2 GROUP BY 1 ORDER BY 1`);
console.log('CONTENT (aisearch_content_v2):');
for (const r of ct.rows) console.log(`  ${r.shop_domain}: ${r.total} items (${r.articles} articles, ${r.pages} pages, ${r.collections} collections) | embedded ${r.emb}`);

const sb = await fetch(`${kv.SUPABASE_URL}/rest/v1/product_embeddings?select=shop_domain&limit=20000`, {
  headers: { apikey: kv.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${kv.SUPABASE_SERVICE_KEY}` },
}).then(r => r.json());
const byShop = {};
for (const r of sb) byShop[r.shop_domain] = (byShop[r.shop_domain] || 0) + 1;
console.log('SUPABASE product_embeddings:', JSON.stringify(byShop));
const sbi = await fetch(`${kv.SUPABASE_URL}/rest/v1/product_embeddings?select=shop_domain&image_embedding=not.is.null&limit=20000`, {
  headers: { apikey: kv.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${kv.SUPABASE_SERVICE_KEY}` },
}).then(r => r.json());
const byShopImg = {};
for (const r of sbi) byShopImg[r.shop_domain] = (byShopImg[r.shop_domain] || 0) + 1;
console.log('SUPABASE with image_embedding:', JSON.stringify(byShopImg));
await c.end();
