/**
 * WebMCP Multi-Tenant Storefront AI Search Interceptor & Tool Provider
 * Multi-Site Scalable • Telemetry & Analytics • 100% Native Theme Liquid & Instant AI Routing
 */
(function() {
  if (window.__WEBMCP_INITIALIZED__) return;
  window.__WEBMCP_INITIALIZED__ = true;
  window.__WEBMCP_VERSION = "v2";

  // Multi-Tenant Store & Brand Detection
  var currentScript = document.currentScript || document.querySelector('script[src*="widget.js"]');

  // API base = origin this script was served from (works on any deploy domain)
  var API_BASE = "https://webmcp.tendrilsioservices.com";
  try {
    if (currentScript && currentScript.src) API_BASE = new URL(currentScript.src).origin;
  } catch (e) {}
  var hostShop = (currentScript && currentScript.getAttribute("data-shop")) || 
                 (window.Shopify && window.Shopify.shop) || 
                 window.location.hostname || 
                 "jenniferfurniturestaging.myshopify.com";

  hostShop = hostShop.toLowerCase().trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];

  var brandName = (currentScript && (currentScript.getAttribute("data-brand-name") || currentScript.getAttribute("data-brand")));
  var discountCode = (currentScript && (currentScript.getAttribute("data-discount-code") || currentScript.getAttribute("data-discount")));

  if (hostShop.includes("onlinesalesonly") || hostShop.includes("sofabed")) {
    brandName = brandName || "SofaBed";
    discountCode = discountCode || "SOFABED10";
  } else if (hostShop.includes("jennifurniture") || hostShop.includes("jennihome")) {
    brandName = brandName || "JenniHome";
    discountCode = discountCode || "JENNI10";
  } else if (hostShop.includes("convertibles") || hostShop.includes("jenniferfurniture.com")) {
    brandName = brandName || "Jennifer Furniture";
    discountCode = discountCode || "JENNIFER10";
  } else if (hostShop.includes("comfort") || hostShop.includes("jennifercomfortfurniture")) {
    brandName = brandName || "Comfort Design Furniture";
    discountCode = discountCode || "COMFORT10";
  } else {
    brandName = brandName || "Jennifer Furniture";
    discountCode = discountCode || "WEBMCP10";
  }

  // Per-tenant navbar search placeholder (overridable via data-search-placeholder on the script tag)
  var searchPlaceholder = (currentScript && currentScript.getAttribute("data-search-placeholder")) || null;
  if (!searchPlaceholder && (hostShop.includes("comfort") || hostShop.includes("jennifercomfortfurniture"))) {
    searchPlaceholder = "Describe your space — let AI find the perfect piece.";
  } else if (!searchPlaceholder && (hostShop.includes("jennifurniture") || hostShop.includes("jennihome"))) {
    searchPlaceholder = "Show me a brown sofa under $5,000";
  }

  // Persistent Client Fingerprint (LocalStorage + 30-Day Cookie)
  var persistentClientId = null;
  try {
    persistentClientId = localStorage.getItem("jmcp_client_id");
    if (!persistentClientId) {
      persistentClientId = "cid_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem("jmcp_client_id", persistentClientId);
    }
    document.cookie = "jmcp_client_id=" + persistentClientId + "; path=/; max-age=2592000; SameSite=Lax";
  } catch (e) {
    persistentClientId = "cid_" + Math.random().toString(36).substring(2, 12);
  }

  var sessionId = persistentClientId;
  var lastAiHandlesCache = {};
  var currentPredictiveSeq = 0;

  function escapeHtmlText(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Helper to fetch AI-curated handles with caching and sequence guard
  function getAiHandlesForQuery(q) {
    var cleanQ = q.toLowerCase().trim();
    if (lastAiHandlesCache[cleanQ]) {
      return Promise.resolve(lastAiHandlesCache[cleanQ]);
    }

    return fetch(API_BASE + "/api/products/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Session": sessionId,
        "X-Shop-Domain": hostShop
      },
      body: JSON.stringify({
        query: cleanQ,
        shop_domain: hostShop,
        session_id: sessionId,
        is_predictive: true,
        is_final: false
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var products = (data && data.products) || [];
      var handles = products.map(function(p) { return p.handle; }).filter(Boolean);
      if (handles.length > 0) {
        lastAiHandlesCache[cleanQ] = handles;
      }
      return handles;
    })
    .catch(function() {
      return [];
    });
  }

  // Native suggest.json for the ORIGINAL query — supplies the Suggestions row
  // plus articles/pages/collections that a handle:-rewritten section render
  // would lose entirely. Public storefront endpoint, no auth, runs in parallel.
  function fetchNativeSuggestJson(q) {
    try {
      var u = "/search/suggest.json?q=" + encodeURIComponent(q) +
        "&resources[type]=query,page,article,collection&resources[limit]=4&resources[limit_scope]=each";
      return __jmcp_orig_fetch(u).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  // Inject suggestion chips + content results into the section HTML that
  // Shopify rendered for our handle: query. Mirrors the theme's own markup.
  function injectSectionContent(html, json, q) {
    var results = json && json.resources && json.resources.results;
    if (!results) return html;
    var queries = (results.queries || []).filter(function(x) {
      return x && x.text && String(x.text).indexOf("handle:") === -1;
    });
    var contentItems = []
      .concat((results.pages || []).map(function(x) { return { t: x.title, u: x.url, k: "Page" }; }))
      .concat((results.articles || []).map(function(x) { return { t: x.title, u: x.url, k: "Article" }; }))
      .concat((results.collections || []).map(function(x) { return { t: x.title, u: x.url, k: "Collection" }; }));
    if (!queries.length && !contentItems.length) return html;
    try {
      var doc = new DOMParser().parseFromString('<div id="__jmcp_wrap">' + html + "</div>", "text/html");
      var wrap = doc.getElementById("__jmcp_wrap");
      if (queries.length) {
        var lis = queries.slice(0, 4).map(function(x) {
          var href = x.url || ("/search?q=" + encodeURIComponent(x.text));
          return '<li role="option"><a href="' + href + '"><span><span>' + escapeHtmlText(x.text) + "</span></span></a></li>";
        }).join("");
        var qbox = '<div class="results results--queries"><h3 class="h4" id="predictive-search-suggestions">Suggestions</h3><ul role="listbox" aria-labelledby="predictive-search-queries">' + lis + "</ul></div>";
        var g1 = doc.querySelector(".results__group-1");
        if (g1) {
          g1.style.display = "";
          g1.innerHTML = qbox;
        } else {
          var g1n = doc.createElement("div");
          g1n.className = "results__group-1";
          g1n.innerHTML = qbox;
          var g2 = doc.querySelector(".results__group-2");
          if (g2) g2.parentNode.insertBefore(g1n, g2); else wrap.appendChild(g1n);
        }
      }
      if (contentItems.length) {
        var lis2 = contentItems.slice(0, 4).map(function(x) {
          return '<li role="option"><a href="' + (x.u || "#") + '"><div class="results-products__info"><span>' +
            escapeHtmlText(x.t) + '</span><span class="grid-product__vendor">' + x.k + "</span></div></a></li>";
        }).join("");
        var cbox = doc.createElement("div");
        cbox.className = "results__group-3";
        cbox.innerHTML = '<div class="results results--products"><h3 class="h4">Pages &amp; Articles</h3><ul role="listbox">' + lis2 + "</ul></div>";
        var btn = doc.querySelector(".text-center");
        if (btn) btn.parentNode.insertBefore(cbox, btn); else wrap.appendChild(cbox);
      }
      return wrap.innerHTML;
    } catch (e) { return html; }
  }

  // 1. Transparent Native Shopify Predictive Search Interceptor
  // AI decodes query -> WebMCP finds best matching product handles -> Shopify natively renders Liquid results.
  // Rules: preserve the theme's exact request (section_id, resource limits, locale),
  // never block longer than ~900ms, honor AbortSignals, and always fall back to native.
  if (typeof window !== "undefined" && window.fetch) {
    var __jmcp_orig_fetch = window.fetch;
    window.fetch = function(resource, init) {
      var url = typeof resource === "string" ? resource : (resource && resource.url ? resource.url : "");

      if (url && (url.indexOf("/search/suggest") !== -1 || url.indexOf("/predictive_search") !== -1 || url.indexOf("predictive-search") !== -1)) {
        try {
          var parsedUrl = new URL(url, window.location.origin);
          var q = (parsedUrl.searchParams.get("q") || "").trim();
          var isSectionRequest = parsedUrl.searchParams.has("section_id") || url.indexOf("section_id=") !== -1;
          var signal = init && init.signal;

          if (q.indexOf("handle:") !== -1 || q.length < 1 || (signal && signal.aborted)) {
            return __jmcp_orig_fetch.apply(window, [resource, init]);
          }

          var thisSeq = ++currentPredictiveSeq;
          // Kick off the original-query suggest.json NOW so suggestions/articles
          // fetch in parallel with the AI handle call — adds ~0ms to the chain.
          var nativeSuggest = fetchNativeSuggestJson(q);
          return new Promise(function(resolve) {
            var done = false;
            var passThrough = function() {
              if (done) return;
              done = true;
              resolve(__jmcp_orig_fetch.apply(window, [resource, init]));
            };
            if (signal) {
              signal.addEventListener("abort", function() { done = true; });
            }
            // AI too slow -> native results, dropdown never starves.
            // EC2 calls run ~1-1.5s — give the rewrite room to land.
            var killer = setTimeout(passThrough, 2800);

            getAiHandlesForQuery(q).then(function(handles) {
              if (done) return;
              if (thisSeq !== currentPredictiveSeq) {
                // Stale — a newer keystroke owns the panel; settle into silence.
                // (Rejects trigger close() in themes like JenniHome's.)
                done = true;
                clearTimeout(killer);
                return;
              }
              if (handles.length === 0) { passThrough(); return; }
              done = true;
              clearTimeout(killer);

              // Rewrite ONLY the q param — keep section_id, resources[type]/[limit], locale intact
              parsedUrl.searchParams.set("q", "handle:" + handles.join(" OR handle:"));
              var rewrittenUrl = parsedUrl.pathname + "?" + parsedUrl.searchParams.toString();

              resolve(__jmcp_orig_fetch(rewrittenUrl).then(function(res) {
                if (!res.ok) {
                  return __jmcp_orig_fetch.apply(window, [resource, init]);
                }
                if (isSectionRequest) {
                  return Promise.all([res.text(), nativeSuggest]).then(function(pair) {
                    var html = pair[0];
                    var queryEscaped = escapeHtmlText(q);
                    var cleanHtml = html
                      .replace(/Search for [“"][^"”]+[”"]/gi, 'Search for “' + queryEscaped + '”')
                      .replace(/data-predictive-search-search-for-text>[^<]+<\/span>/gi, 'data-predictive-search-search-for-text>Search for “' + queryEscaped + '”</span>');
                    cleanHtml = injectSectionContent(cleanHtml, pair[1], q);
                    return new Response(cleanHtml, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
                  });
                }
                // JSON suggest payloads: hide raw handle: strings from query suggestions
                if ((res.headers.get("content-type") || "").indexOf("json") !== -1) {
                  return res.json().then(function(json) {
                    try {
                      var results = json && json.resources && json.resources.results;
                      if (results && results.queries) {
                        results.queries = results.queries.filter(function(x) {
                          return String((x && (x.styled_title || x.title)) || "").indexOf("handle:") === -1;
                        });
                      }
                    } catch(e) {}
                    return new Response(JSON.stringify(json), { status: 200, headers: { "Content-Type": "application/json" } });
                  });
                }
                return res;
              }));
            }).catch(passThrough);
          });
        } catch(e) {}
      }
      return __jmcp_orig_fetch.apply(this, arguments);
    };
  }

  // 2. Instant Search Form Submit Interceptor
  // Prevents loading Shopify's 141 dumb SQL results; routes directly to AI-curated handles on first page load!
  if (typeof document !== "undefined") {
    document.addEventListener("submit", function(e) {
      var form = e.target && e.target.closest ? e.target.closest("form[action*='/search']") : null;
      if (!form) return;
      var input = form.querySelector("input[name='q'], input[type='search'], .search__input");
      if (!input) return;
      var q = (input.value || "").trim();
      if (!q || q.length < 2 || q.indexOf("handle:") !== -1) return;

      var cachedHandles = lastAiHandlesCache[q.toLowerCase().trim()];
      if (cachedHandles && cachedHandles.length > 0) {
        e.preventDefault();
        var handleQuery = "handle:" + cachedHandles.join(" OR handle:");
        window.location.href = "/search?q=" + encodeURIComponent(handleQuery) + "&user_q=" + encodeURIComponent(q);
        return;
      }

      // If handles not cached yet, fetch them before navigating — but NEVER
      // let the shopper wait on us: race the API against a hard deadline and
      // fall back to a plain native submit (a normal search page beats a
      // frozen form every time). form.submit() can be shadowed by a control
      // named "submit", so call the prototype method.
      e.preventDefault();
      var submitButtons = form.querySelectorAll("button, input[type='submit']");
      submitButtons.forEach(function(btn) { btn.disabled = true; });

      var nativeSubmit = function() { HTMLFormElement.prototype.submit.call(form); };
      var deadline = new Promise(function(resolve) { setTimeout(resolve, 2500); });
      var aiHandles = fetch(API_BASE + "/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Session": sessionId, "X-Shop-Domain": hostShop },
        body: JSON.stringify({ query: q, shop_domain: hostShop, session_id: sessionId, is_final: true })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        var products = (data && data.products) || [];
        return products.map(function(p) { return p.handle; }).filter(Boolean);
      })
      .catch(function() { return []; });

      Promise.race([aiHandles, deadline.then(function() { return null; })]).then(function(handles) {
        if (handles && handles.length > 0) {
          var handleQuery = "handle:" + handles.join(" OR handle:");
          window.location.href = "/search?q=" + encodeURIComponent(handleQuery) + "&user_q=" + encodeURIComponent(q) + "&ai_logged=1";
        } else {
          nativeSubmit();
        }
      }).catch(nativeSubmit);
    }, true);
  }

  // Non-product content on the results page: our handle: redirect only yields
  // products, so fetch matching articles/pages/collections via the native
  // suggest endpoint and render them under the product grid.
  function appendContentResults(displayQuery) {
    if (!displayQuery || displayQuery.indexOf("handle:") !== -1 || document.querySelector(".webmcp-extra-results")) return;
    fetch("/search/suggest.json?q=" + encodeURIComponent(displayQuery) +
          "&resources[type]=article,page,collection&resources[limit]=6&resources[limit_scope]=each")
      .then(function(r) { return r.json(); })
      .then(function(j) {
        var res = (j && j.resources && j.resources.results) || {};
        var items = (res.articles || []).map(function(a) { return { title: a.title, url: a.url, kind: "Article" }; })
          .concat((res.pages || []).map(function(p) { return { title: p.title, url: p.url, kind: "Page" }; }))
          .concat((res.collections || []).map(function(c) { return { title: c.title, url: c.url, kind: "Collection" }; }));
        if (!items.length) return;
        var anchor = document.querySelector("#ProductGridContainer, #product-grid, ul.product-grid, .grid--uniform, .products-grid, .search-content");
        if (!anchor) return;
        var box = document.createElement("div");
        box.className = "webmcp-extra-results";
        box.setAttribute("style", "margin:2.5em 0;padding-top:1.5em;border-top:1px solid rgba(0,0,0,.12);");
        box.innerHTML = '<h3 style="font-size:1.05em;margin:0 0 .8em;letter-spacing:.04em;">Articles &amp; More</h3><ul style="list-style:none;margin:0;padding:0;">' +
          items.map(function(it) {
            return '<li style="padding:.45em 0;"><a href="' + it.url + '" style="text-decoration:none;color:inherit;">' +
                   escapeHtmlText(it.title) +
                   ' <span style="opacity:.55;font-size:.85em;">· ' + it.kind + '</span></a></li>';
          }).join("") + "</ul>";
        (anchor.parentNode || anchor).appendChild(box);
      })
      .catch(function() {});
  }

  // 3. Search Results Page Enhancer
  function enhanceSearchPage() {
    if (typeof window === "undefined" || window.location.pathname.indexOf("/search") === -1) return;

    var urlParams = new URLSearchParams(window.location.search);
    var q = (urlParams.get("q") || "").trim();
    var userQ = (urlParams.get("user_q") || "").trim();

    // If query arrived with pre-filtered AI handles
    if (q.indexOf("handle:") !== -1) {
      var displayQuery = userQ || q;
      if (userQ) {
        var searchInputs = document.querySelectorAll("input[name='q'], input[type='search'], .search__input");
        searchInputs.forEach(function(input) {
          input.value = userQ;
        });

        var titleHeading = document.querySelector("h1.template-search__header, h1.section-header__title, h1.title, .template-search h1");
        if (titleHeading) {
          titleHeading.textContent = 'Search results for "' + userQ + '"';
        }

        // Fix secondary surfaces that render raw search.terms (e.g. JenniHome's
        // "Search: N results found for ..." breadcrumb span) — replace the
        // handle:... query with the shopper's actual words.
        document.querySelectorAll("nav.breadcrumb span, .breadcrumb__current, [data-tool-tip-title]").forEach(function(el) {
          var t = el.textContent || "";
          if (t.indexOf("handle:") !== -1) {
            var m = t.match(/^(.*?(?:results? found for|for))\s*["'“”]?/i);
            el.textContent = (m ? m[1] : "Search results for") + ' "' + displayQuery + '"';
          }
        });
        if (document.title.indexOf("handle:") !== -1) {
          var suffix = document.title.split("»")[1] || "";
          document.title = 'Search: "' + displayQuery + '"' + (suffix ? " » " + suffix.trim() : "");
        }
        appendContentResults(displayQuery);

        // Record the final search when the submit path didn't (cached handles skip the is_final call)
        if (!urlParams.get("ai_logged")) {
          fetch(API_BASE + "/api/products/search", {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Client-Session": sessionId, "X-Shop-Domain": hostShop },
            body: JSON.stringify({ query: userQ, shop_domain: hostShop, session_id: sessionId, is_final: true, is_predictive: false })
          }).catch(function() {});
        }
      }
      return;
    }

    if (!q || q.length < 2) return;
    if (document.body && document.body.getAttribute("data-webmcp-rendered") === "true") return;

    appendContentResults(q);

    // Dim the dumb results immediately while AI processes
    var gridContainer = document.querySelector("#ProductGridContainer, #product-grid, ul.product-grid, .grid--uniform, .products-grid");
    if (gridContainer) {
      gridContainer.style.opacity = "0.2";
      gridContainer.style.transition = "opacity 0.2s ease";
    }

    // Fetch AI-curated matching products from WebMCP (is_final logs telemetry
    // server-side). Abort-bounded so a hung request can't leave the native
    // grid dimmed forever — the catch below restores opacity.
    var searchAbort = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var searchTimeout = searchAbort ? setTimeout(function() { searchAbort.abort(); }, 9000) : null;
    fetch(API_BASE + "/api/products/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Session": sessionId,
        "X-Shop-Domain": hostShop
      },
      signal: searchAbort ? searchAbort.signal : undefined,
      body: JSON.stringify({
        query: q,
        shop_domain: hostShop,
        session_id: sessionId,
        is_final: true,
        is_predictive: false
      })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (searchTimeout) clearTimeout(searchTimeout);
      var products = (data && data.products) || [];
      var handles = products.map(function(p) { return p.handle; }).filter(Boolean);
      if (handles.length === 0) {
        if (gridContainer) gridContainer.style.opacity = "1";
        return;
      }

      var handleQuery = "handle:" + handles.join(" OR handle:");
      var targetUrl = "/search?q=" + encodeURIComponent(handleQuery);

      fetch(targetUrl)
        .then(function(r) { return r.text(); })
        .then(function(html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, "text/html");

          var currentGrid = document.querySelector("#ProductGridContainer, #product-grid, ul.product-grid, .grid--uniform, .products-grid");
          var newGrid = doc.querySelector("#ProductGridContainer, #product-grid, ul.product-grid, .grid--uniform, .products-grid");

          if (currentGrid && newGrid) {
            currentGrid.innerHTML = newGrid.innerHTML;
            currentGrid.style.opacity = "1";
          } else if (currentGrid) {
            currentGrid.style.opacity = "1";
          }

          // Restore user's natural query in all search input boxes
          var searchInputs = document.querySelectorAll("input[name='q'], input[type='search'], .search__input");
          searchInputs.forEach(function(input) {
            input.value = q;
          });

          // Update result counts
          var countEls = document.querySelectorAll("#ProductCount, #ProductCountDesktop, .facets__product-count-text, .product-count, [data-search-results-count]");
          countEls.forEach(function(el) {
            var span = el.querySelector("span") || el;
            span.textContent = handles.length + " " + (handles.length === 1 ? "result" : "results");
          });

          // Hide pagination for concise AI result sets
          if (handles.length <= 16) {
            var paginations = document.querySelectorAll(".pagination-wrapper, .pagination, .infinite-scroll");
            paginations.forEach(function(pg) {
              pg.style.display = "none";
            });
          }

          document.body.setAttribute("data-webmcp-rendered", "true");
        })
        .catch(function(err) {
          if (gridContainer) gridContainer.style.opacity = "1";
          console.warn("[WebMCP] Search page render fallback:", err);
        });
    })
    .catch(function(err) {
      if (gridContainer) gridContainer.style.opacity = "1";
      console.warn("[WebMCP] Search AI query fallback:", err);
      // Fallback telemetry beacon so the final search is still recorded when the API call fails
      try {
        var telemetryPayload = { shopDomain: hostShop, eventType: "search_query", sessionId: sessionId, queryText: q, is_final: true, is_predictive: false };
        if (navigator.sendBeacon) {
          navigator.sendBeacon(API_BASE + "/api/analytics/track", new Blob([JSON.stringify(telemetryPayload)], { type: "application/json" }));
        }
      } catch(e) {}
    });
  }

  // Deferred scripts run post-parse — the DOM is already here, so run the
  // user_q scrub now rather than waiting for DOMContentLoaded (which can be
  // after first paint = visible "handle:..." flash). document.body guard
  // covers the theoretical non-deferred load.
  if (document.body) {
    enhanceSearchPage();
  } else {
    document.addEventListener("DOMContentLoaded", enhanceSearchPage);
  }

  // 4. WebMCP Tool Handlers
  var toolHandlers = {
    "find_products_by_constraints": function(args) {
      var payload = Object.assign({}, args || {}, { shop_domain: hostShop });
      return fetch(API_BASE + "/api/products/search", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json", 
          "X-Client-Session": sessionId,
          "X-Shop-Domain": hostShop 
        },
        body: JSON.stringify(payload)
      }).then(function(r) { return r.json(); });
    },
    "calculate_room_fit_and_clearance": function(args) {
      return fetch(API_BASE + "/api/tools/room-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Session": sessionId, "X-Shop-Domain": hostShop },
        body: JSON.stringify(args || {})
      }).then(function(r) { return r.json(); });
    },
    "generate_room_floorplan": function(args) {
      return fetch(API_BASE + "/api/tools/floorplan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Client-Session": sessionId, "X-Shop-Domain": hostShop },
        body: JSON.stringify(args || {})
      }).then(function(r) { return r.json(); });
    }
  };

  // 5. W3C document.modelContext Registration
  var registeredToolsList = [];
  var registeredNames = new Set();

  if (!window.document.modelContext) {
    window.document.modelContext = {};
  }

  var nativeRegisterTool = typeof window.document.modelContext.registerTool === "function" 
    ? window.document.modelContext.registerTool.bind(window.document.modelContext) 
    : null;

  window.document.modelContext.registerTool = function(toolDef) {
    if (!toolDef || !toolDef.name) return toolDef;
    if (registeredNames.has(toolDef.name)) return toolDef;
    registeredNames.add(toolDef.name);

    var wrappedTool = Object.assign({}, toolDef, {
      execute: toolDef.execute || toolHandlers[toolDef.name] || function(args) {
        return fetch(API_BASE + "/api/products/search", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Client-Session": sessionId, "X-Shop-Domain": hostShop },
          body: JSON.stringify(Object.assign({}, args || {}, { shop_domain: hostShop }))
        }).then(function(r) { return r.json(); });
      }
    });

    registeredToolsList.push(wrappedTool);

    if (nativeRegisterTool) {
      try {
        var p = nativeRegisterTool(toolDef);
        if (p && typeof p.catch === "function") p.catch(function() {});
      } catch (e) {}
    }
    return wrappedTool;
  };

  window.document.modelContext.getRegisteredTools = function() {
    return registeredToolsList;
  };

  Object.keys(toolHandlers).forEach(function(name) {
    window.document.modelContext.registerTool({
      name: name,
      description: brandName + " Search & Spatial Tool: " + name,
      parameters: { type: "object", properties: {} },
      execute: toolHandlers[name]
    });
  });

  // 6. Per-Tenant Search Placeholder
  // Sets the AI hint text on native theme search inputs (navbar + predictive search modal)
  function applySearchPlaceholder() {
    if (!searchPlaceholder) return;
    if (!document.getElementById("webmcp-search-ph-style")) {
      var st = document.createElement("style");
      st.id = "webmcp-search-ph-style";
      st.textContent = "input[name='q']::placeholder, input[type='search']::placeholder, .search__input::placeholder { font-style: italic; opacity: 0.85; } " +
                       "input[name='q']::-webkit-input-placeholder, input[type='search']::-webkit-input-placeholder, .search__input::-webkit-input-placeholder { font-style: italic; opacity: 0.85; }";
      (document.head || document.documentElement).appendChild(st);
    }
    var inputs = document.querySelectorAll("input[name='q'], input[type='search'], .search__input");
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].getAttribute("placeholder") !== searchPlaceholder) {
        inputs[i].setAttribute("placeholder", searchPlaceholder);
      }
    }
  }

  if (searchPlaceholder) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", applySearchPlaceholder);
    } else {
      applySearchPlaceholder();
    }
    if (typeof MutationObserver !== "undefined" && document.documentElement) {
      var phObserver = new MutationObserver(function(muts) {
        for (var i = 0; i < muts.length; i++) {
          if (muts[i].addedNodes.length) { applySearchPlaceholder(); return; }
        }
      });
      phObserver.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  // Clean cleanup of any legacy UI elements if present
  function cleanLegacyUI() {
    document.querySelectorAll("#jmcp-widget-container, .jmcp-trigger, .jmcp-drawer, #shop-ai-chat-bubble, #shop-ai-chat-container, #jmcp-injected-style").forEach(function(el) {
      try { el.remove(); } catch(e) {}
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", cleanLegacyUI);
  else cleanLegacyUI();
})();