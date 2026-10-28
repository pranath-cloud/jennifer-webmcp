const fs = require('fs');

let widgetCode = fs.readFileSync('c:/webmcp/public/widget.js', 'utf8');

// The fetch interceptor snippet
const fetchInterceptor = `
  // 0. Transparent Native Shopify Predictive Search Interceptor
  // Intercepts theme native predictive search fetch calls and routes through WebMCP AI Backend
  if (typeof window !== "undefined" && window.fetch) {
    var __jmcp_orig_fetch = window.fetch;
    window.fetch = function(resource, init) {
      var url = typeof resource === "string" ? resource : (resource && resource.url ? resource.url : "");
      
      if (url && (url.indexOf("/search/suggest") !== -1 || url.indexOf("/predictive_search") !== -1 || url.indexOf("predictive-search") !== -1)) {
        try {
          var parsedUrl = new URL(url, window.location.origin);
          var q = parsedUrl.searchParams.get("q") || "";
          var isSectionRequest = parsedUrl.searchParams.has("section_id") || url.indexOf("section_id=") !== -1;
          
          if (q && q.trim().length >= 2) {
            return __jmcp_orig_fetch(API_BASE + "/api/products/search", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Client-Session": sessionId,
                "X-Shop-Domain": hostShop
              },
              body: JSON.stringify({
                query: q.trim(),
                shop_domain: hostShop,
                session_id: sessionId
              })
            })
            .then(function(res) { return res.json(); })
            .then(function(data) {
              var products = (data && data.products) || [];
              
              if (isSectionRequest) {
                // Return Native Dawn Theme Section HTML
                var listHtml = "";
                products.slice(0, 6).forEach(function(p, idx) {
                  var price = "$" + (parseFloat(p.minPrice) || 0).toLocaleString("en-US", { minimumFractionDigits: 2 });
                  var img = p.featuredImage || "";
                  var vendor = p.vendor || brandName;
                  listHtml += \`
                    <li id="predictive-search-option-\${idx + 1}" class="predictive-search__list-item" role="option" aria-selected="false">
                      <a href="/products/\${p.handle}" class="predictive-search__item predictive-search__item--link-with-thumbnail link link--text" tabindex="-1">
                        \${img ? \`<img class="predictive-search__image" src="\${img}" alt="\${p.title.replace(/"/g, '&quot;')}" width="50" height="50" loading="lazy">\` : ''}
                        <div class="predictive-search__item-content predictive-search__item-content--centered">
                          <p class="predictive-search__item-vendor caption-with-letter-spacing">\${vendor}</p>
                          <h3 class="predictive-search__item-heading h5">\${p.title}</h3>
                          <div class="price">
                            <div class="price__container">
                              <div class="price__regular">
                                <span class="price-item price-item--regular">\${price}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </a>
                    </li>
                  \`;
                });
                
                var sectionHtml = \`
                  <div id="shopify-section-predictive-search" class="shopify-section">
                    <div id="predictive-search-results" class="predictive-search predictive-search--header">
                      <div class="predictive-search__results-groups-wrapper">
                        <div class="predictive-search__result-group">
                          <div style="padding: 10px 16px 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(0,0,0,0.06);">
                            <span>Products</span>
                            <span style="color: #0284c7; font-weight: 600; text-transform: none; font-size: 11px;">✨ AI Powered Match</span>
                          </div>
                          <ul id="predictive-search-results-products-list" class="predictive-search__results-list list-unstyled" role="group">
                            \${listHtml || '<li class="predictive-search__list-item" style="padding: 16px; font-size: 13px; color: #64748b;">No matching in-stock products found.</li>'}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                \`;
                
                return new Response(sectionHtml, {
                  status: 200,
                  headers: { "Content-Type": "text/html; charset=utf-8" }
                });
              } else {
                // Return Standard Shopify JSON schema
                var shopifyJson = {
                  resources: {
                    results: {
                      products: products.map(function(p) {
                        return {
                          id: p.id,
                          title: p.title,
                          handle: p.handle,
                          url: "/products/" + p.handle,
                          featured_image: { url: p.featuredImage, alt: p.title },
                          price: p.minPrice,
                          vendor: p.vendor || brandName,
                          available: true
                        };
                      })
                    }
                  }
                };
                
                return new Response(JSON.stringify(shopifyJson), {
                  status: 200,
                  headers: { "Content-Type": "application/json" }
                });
              }
            })
            .catch(function() {
              return __jmcp_orig_fetch.apply(window, [resource, init]);
            });
          }
        } catch(e) {}
      }
      
      return __jmcp_orig_fetch.apply(this, arguments);
    };
  }
`;

// Insert fetchInterceptor right after sessionId initialization
if (!widgetCode.includes('__jmcp_orig_fetch')) {
  widgetCode = widgetCode.replace('var sessionId = persistentClientId;', 'var sessionId = persistentClientId;\n' + fetchInterceptor);
  fs.writeFileSync('c:/webmcp/public/widget.js', widgetCode, 'utf8');
  console.log('Successfully injected native fetch interceptor into widget.js!');
} else {
  console.log('Fetch interceptor already present in widget.js');
}
