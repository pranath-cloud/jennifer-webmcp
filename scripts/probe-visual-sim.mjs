// Probe: embed a query, call match_products_mm, show tsim/isim distribution per product.
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const kv = Object.fromEntries(env.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const shop = process.argv[2] || 'jennifurniture.myshopify.com';
const query = process.argv[3] || 'green sofa';

const emb = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${kv.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'google/gemini-embedding-2', input: query, dimensions: 768 }),
}).then(r => r.json());
const qv = emb.data[0].embedding;

const rpc = await fetch(`${kv.SUPABASE_URL}/rest/v1/rpc/match_products_mm`, {
  method: 'POST',
  headers: { apikey: kv.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${kv.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ p_shop: shop, p_query: `[${qv.join(',')}]`, p_limit: 40 }),
}).then(r => r.json());
if (!Array.isArray(rpc)) { console.log('RPC error:', JSON.stringify(rpc)); process.exit(1); }

const c = new pg.Client({ host: kv.PG_HOST, port: +kv.PG_PORT, user: kv.PG_USER, password: kv.PG_PASSWORD, database: kv.PG_DATABASE });
await c.connect();
const ids = rpc.map(r => r.product_id);
const t = await c.query(`SELECT product_id, title, tags FROM testing.aisearch_products_v2 WHERE shop_domain=$1 AND product_id = ANY($2)`, [shop, ids]);
const byId = Object.fromEntries(t.rows.map(r => [r.product_id, r]));
await c.end();

console.log(`query: "${query}" — ${rpc.length} vector hits\n`);
console.log('isim  tsim  sim   | title');
for (const r of rpc.sort((a, b) => b.isim - a.isim).slice(0, 25)) {
  const row = byId[r.product_id];
  const green = row && /color-green|green/i.test(JSON.stringify(row.tags));
  console.log(`${r.isim.toFixed(3)} ${r.tsim.toFixed(3)} ${r.sim.toFixed(3)} | ${(row?.title || '?').slice(0, 70)}${green ? '  [tag:green]' : ''}`);
}
