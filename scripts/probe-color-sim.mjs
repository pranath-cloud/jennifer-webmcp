// Color probe: cosine a color-focused text vector against ALL PG image vecs.
import pg from 'pg';
import fs from 'fs';

const env = fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const kv = Object.fromEntries(env.split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const shop = process.argv[2] || 'jennifurniture.myshopify.com';
const query = process.argv[3] || 'green fabric upholstery';

const emb = await fetch('https://openrouter.ai/api/v1/embeddings', {
  method: 'POST',
  headers: { Authorization: `Bearer ${kv.OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'google/gemini-embedding-2', input: query, dimensions: 768 }),
}).then(r => r.json());
const qv = emb.data[0].embedding;

const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; } return d / (Math.sqrt(na) * Math.sqrt(nb)); };

const c = new pg.Client({ host: kv.PG_HOST, port: +kv.PG_PORT, user: kv.PG_USER, password: kv.PG_PASSWORD, database: kv.PG_DATABASE });
await c.connect();
const t = await c.query(`SELECT product_id, title, tags, image_embedding FROM testing.aisearch_products_v2 WHERE shop_domain=$1 AND status='active' AND image_embedding IS NOT NULL`, [shop]);
await c.end();

const scored = t.rows.map(r => ({ title: r.title, green: /color-green|green/i.test(JSON.stringify(r.tags)), isim: cos(qv, r.image_embedding) }));
scored.sort((a, b) => b.isim - a.isim);

console.log(`probe: "${query}" — ${scored.length} image vecs\n`);
console.log('== TOP 15 ==');
for (const s of scored.slice(0, 15)) console.log(`${s.isim.toFixed(3)} | ${s.title.slice(0, 72)}${s.green ? '  [tag:green]' : ''}`);
console.log('\n== all green-tagged products ==');
for (const s of scored.filter(s => s.green)) console.log(`${s.isim.toFixed(3)} | ${s.title.slice(0, 72)}`);
