async function testFields() {
  const queries = [
    'title:Monika',
    'tag:leather',
    'vendor:Luonto',
    'product_type:Sofa',
    'barcode:123',
    'sku:123'
  ];

  for (const q of queries) {
    const sUrl = `https://jenniferfurniturestaging.myshopify.com/search?q=${encodeURIComponent(q)}&section_id=template--19183349498024__main`;
    const res = await fetch(sUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await res.text();
    const countMatch = html.match(/(\d+)\s+results/i);
    const cardMatches = [...html.matchAll(/class="[^"]*card-wrapper[^"]*"/g)].length;
    console.log(`Query: "${q}" -> Results regex match: ${countMatch ? countMatch[0] : 'N/A'}, Card matches: ${cardMatches}`);
  }
}

testFields().catch(console.error);
