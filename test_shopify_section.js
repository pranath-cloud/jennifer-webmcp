const fs = require('fs');

async function test() {
  const url = 'https://jenniferfurniturestaging.myshopify.com/search?q=sofa';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  
  const sectionIds = [...html.matchAll(/id=["']shopify-section-([^"']+)["']/g)].map(m => m[1]);
  console.log('Sections on search page:', sectionIds);

  for (const sId of sectionIds) {
    const sUrl = `https://jenniferfurniturestaging.myshopify.com/search?q=sofa&section_id=${sId}`;
    const sRes = await fetch(sUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    console.log(`Testing section_id=${sId} -> Status: ${sRes.status}, Content-Length: ${sRes.headers.get('content-length') || sRes.statusText}`);
    if (sRes.ok) {
      const sHtml = await sRes.text();
      console.log(`  Success! Length: ${sHtml.length}, starts with: ${sHtml.slice(0, 100).replace(/\n/g, ' ')}`);
    }
  }
}

test().catch(console.error);
