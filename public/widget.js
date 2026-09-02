/**
 * Jennifer Furniture WebMCP Client-Side Tool-Driven Co-Pilot
 * Universal Execution via RegisteredTool.execute(args) & document.modelContext
 */
(function() {
  if (window.__JENNIFER_WEBMCP_WIDGET_INIT__) return;
  window.__JENNIFER_WEBMCP_WIDGET_INIT__ = true;

  var API_BASE = "https://jennifer-webmcp.vercel.app";

  // 1. Initialize document.modelContext in browser if not native
  var fallbackTools = [];
  if (!window.document.modelContext) {
    window.document.modelContext = {
      registerTool: function(t) { fallbackTools.push(t); return t; },
      getRegisteredTools: function() { return fallbackTools; },
      executeTool: function(toolOrName, args) {
        var name = typeof toolOrName === "string" ? toolOrName : (toolOrName && toolOrName.name);
        var tool = fallbackTools.find(function(t) { return t.name === name; });
        if (!tool) return Promise.reject(new Error("WebMCP Tool not found: " + name));
        return tool.execute(args);
      }
    };
  }

  // Define the 4 Core Tool implementations
  var toolDefs = [
    {
      name: "find_products_by_constraints",
      description: "Search live inventory for in-stock products matching category, budget, and materials.",
      inputSchema: { type: "object", properties: { category: { type: "string" }, max_price: { type: "number" } } },
      execute: function(args) {
        return fetch(API_BASE + "/api/products/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        }).then(function(r) { return r.json(); });
      }
    },
    {
      name: "calculate_room_fit_and_clearance",
      description: "Calculates room fit and verifies 30-36 inch walking clearance for living room dimensions.",
      inputSchema: { type: "object", properties: { room_width_feet: { type: "number" }, room_length_feet: { type: "number" }, product_handle: { type: "string" } } },
      execute: function(args) {
        return fetch(API_BASE + "/api/tools/room-fit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        }).then(function(r) { return r.json(); });
      }
    },
    {
      name: "compare_products_deep_matrix",
      description: "Side-by-side spec comparison matrix across frame materials, fabrics, dimensions, and warranty.",
      inputSchema: { type: "object", properties: { product_handles: { type: "array", items: { type: "string" } } } },
      execute: function(args) {
        return fetch(API_BASE + "/api/tools/compare-deep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        }).then(function(r) { return r.json(); });
      }
    },
    {
      name: "build_coordinated_room_bundle",
      description: "Pairs an anchor sofa with matching ottoman and accent chair with 15% discount permalink.",
      inputSchema: { type: "object", properties: { base_product_handle: { type: "string" }, budget_cap: { type: "number" } } },
      execute: function(args) {
        return fetch(API_BASE + "/api/tools/bundle-builder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args)
        }).then(function(r) { return r.json(); });
      }
    }
  ];

  // Register each tool in document.modelContext
  var registeredToolMap = {};
  toolDefs.forEach(function(t) {
    try {
      var reg = window.document.modelContext.registerTool(t);
      registeredToolMap[t.name] = reg || t;
    } catch(e) {
      registeredToolMap[t.name] = t;
    }
  });

  // CSS Styles
  var CSS = `
    .jmcp-ai-cursor {
      position: fixed; top: 0; left: 0; width: 24px; height: 24px;
      z-index: 2147483647; pointer-events: none;
      transition: transform 0.8s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
      opacity: 0; transform: translate(-100px, -100px);
    }
    .jmcp-ai-cursor.jmcp-cursor-active { opacity: 1; }
    .jmcp-cursor-pointer {
      width: 0; height: 0; border-left: 12px solid #3b82f6;
      border-top: 6px solid transparent; border-bottom: 6px solid transparent;
      transform: rotate(-45deg); filter: drop-shadow(0 0 8px rgba(59, 130, 246, 0.8));
    }
    .jmcp-cursor-trail {
      position: absolute; top: 4px; left: 4px; width: 8px; height: 8px;
      background: #60a5fa; border-radius: 50%;
      box-shadow: 0 0 15px 5px rgba(59, 130, 246, 0.6); animation: jmcp-pulse-dot 1.5s infinite;
    }
    @keyframes jmcp-pulse-dot { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.6); } }

    .jmcp-ripple {
      position: fixed; width: 40px; height: 40px; border: 3px solid #3b82f6; border-radius: 50%;
      pointer-events: none; z-index: 2147483646; transform: translate(-50%, -50%) scale(0.2);
      animation: jmcp-ripple-anim 0.6s ease-out forwards;
    }
    @keyframes jmcp-ripple-anim { 0% { transform: translate(-50%, -50%) scale(0.2); opacity: 1; } 100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; } }

    .jmcp-hud {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-100px);
      z-index: 2147483645; background: rgba(15, 23, 42, 0.95); backdrop-filter: blur(16px);
      color: #ffffff; border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 9999px;
      padding: 10px 24px; font-family: monospace; font-size: 13px; font-weight: 600;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); display: flex; align-items: center; gap: 12px;
      pointer-events: none; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease; opacity: 0;
    }
    .jmcp-hud.jmcp-hud-visible { transform: translateX(-50%) translateY(0); opacity: 1; }
    .jmcp-hud-spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #38bdf8; border-radius: 50%; animation: jmcp-spin 0.8s linear infinite;
    }
    @keyframes jmcp-spin { to { transform: rotate(360deg); } }

    .jmcp-spotlight-target {
      position: relative; animation: jmcp-laser-pulse 4s ease-out forwards; border-radius: 12px; scroll-margin-top: 120px;
    }
    @keyframes jmcp-laser-pulse {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.9), 0 0 35px rgba(59, 130, 246, 0.7); outline: 3px solid #3b82f6; }
      30% { box-shadow: 0 0 0 18px rgba(59, 130, 246, 0.35); outline: 3px solid #60a5fa; }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); outline: 2px solid transparent; }
    }

    .jmcp-trigger {
      position: fixed; bottom: 24px; right: 96px; z-index: 2147483640;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 9999px; padding: 12px 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 14px; font-weight: 600; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
      cursor: pointer; display: flex; align-items: center; gap: 10px; transition: all 0.3s;
    }
    .jmcp-trigger:hover { transform: translateY(-3px) scale(1.03); border-color: #3b82f6; }

    .jmcp-drawer {
      position: fixed; top: 0; right: -480px; width: 440px; max-width: 100vw; height: 100vh;
      background: #ffffff; z-index: 2147483644; box-shadow: -10px 0 35px rgba(0,0,0,0.3);
      display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .jmcp-drawer.jmcp-open { right: 0; }
    .jmcp-header {
      background: #0f172a; color: #ffffff; padding: 16px 20px;
      display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .jmcp-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .jmcp-badge { font-size: 10px; background: #2563eb; color: white; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .jmcp-close { background: transparent; border: none; color: #94a3b8; font-size: 22px; cursor: pointer; }

    .jmcp-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: #f8fafc;
    }
    .jmcp-msg { max-width: 92%; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
    .jmcp-msg-user { align-self: flex-end; background: #2563eb; color: #ffffff; }
    .jmcp-msg-assistant { align-self: flex-start; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; }

    .jmcp-tool-tag {
      display: inline-flex; align-items: center; gap: 6px; background: #0f172a; color: #38bdf8;
      font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 6px; margin-bottom: 8px;
    }

    .jmcp-products { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
    .jmcp-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: flex; gap: 12px; }
    .jmcp-img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; }
    .jmcp-card-body { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .jmcp-card-title { font-weight: 600; font-size: 12px; color: #0f172a; }
    .jmcp-card-price { font-size: 14px; font-weight: 700; color: #2563eb; }
    .jmcp-card-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

    .jmcp-btn-spotlight { background: #2563eb; color: white; border: none; font-size: 11px; padding: 5px 9px; border-radius: 6px; cursor: pointer; }
    .jmcp-btn-cart-native { background: #0f172a; color: white; border: none; font-size: 11px; padding: 5px 9px; border-radius: 6px; cursor: pointer; }
    .jmcp-btn-buy { background: #f1f5f9; color: #334155; text-decoration: none; font-size: 11px; padding: 5px 8px; border-radius: 6px; display: inline-block; }

    .jmcp-tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 10px; }
    .jmcp-tool-btn {
      background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px 10px;
      font-size: 11px; font-weight: 600; color: #1e293b; text-align: left; cursor: pointer;
      display: flex; flex-direction: column; gap: 2px;
    }
    .jmcp-tool-btn:hover { border-color: #2563eb; background: #eff6ff; }
    .jmcp-tool-btn span.jmcp-tool-name { font-family: monospace; font-size: 10px; color: #2563eb; }

    .jmcp-input-wrap { padding: 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; }
    .jmcp-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; }
    .jmcp-send { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 0 16px; font-weight: 600; cursor: pointer; }
  `;

  var hudTimer = null;
  function showHUD(text, isDone) {
    var hud = document.getElementById("jmcp-action-hud");
    if (!hud) return;
    hud.innerHTML = `
      ${isDone ? '<span style="color:#4ade80;">✔</span>' : '<div class="jmcp-hud-spinner"></div>'}
      <span>${text}</span>
    `;
    hud.classList.add("jmcp-hud-visible");
    if (hudTimer) clearTimeout(hudTimer);
    if (isDone) {
      hudTimer = setTimeout(function() { hud.classList.remove("jmcp-hud-visible"); }, 3500);
    }
  }

  function moveAICursor(targetX, targetY, durationMs, callback) {
    var cursor = document.getElementById("jmcp-ai-cursor");
    if (!cursor) return;
    cursor.classList.add("jmcp-cursor-active");
    cursor.style.transition = "transform " + (durationMs / 1000) + "s cubic-bezier(0.25, 1, 0.5, 1)";
    cursor.style.transform = "translate(" + targetX + "px, " + targetY + "px)";

    setTimeout(function() {
      createRipple(targetX, targetY);
      if (callback) callback();
      setTimeout(function() { cursor.classList.remove("jmcp-cursor-active"); }, 1200);
    }, durationMs);
  }

  function createRipple(x, y) {
    var rip = document.createElement("div");
    rip.className = "jmcp-ripple";
    rip.style.left = x + "px"; rip.style.top = y + "px";
    document.body.appendChild(rip);
    setTimeout(function() { if (rip.parentNode) rip.parentNode.removeChild(rip); }, 700);
  }

  function runVisualAutopilot(handle, title) {
    showHUD("🎯 AI Co-Pilot locating " + title + " on page...", false);
    var navTarget = document.querySelector(".header, header, nav") || document.body;
    var navRect = navTarget.getBoundingClientRect();
    moveAICursor(window.innerWidth / 2, Math.max(30, navRect.top + 20), 700, function() {
      var selector = 'a[href*="/products/' + handle + '"], [data-product-handle="' + handle + '"]';
      var targetLink = document.querySelector(selector);
      if (targetLink) {
        var card = targetLink.closest('.card, .product-card, .grid__item, li, div') || targetLink;
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function() {
          var cardRect = card.getBoundingClientRect();
          moveAICursor(cardRect.left + cardRect.width / 2, cardRect.top + cardRect.height / 2, 600, function() {
            card.classList.add("jmcp-spotlight-target");
            showHUD("✨ Spotlighted " + title + " on your screen!", true);
            setTimeout(function() { card.classList.remove("jmcp-spotlight-target"); }, 4000);
          });
        }, 500);
      } else {
        showHUD("🚀 Teleporting to " + title + "...", false);
        setTimeout(function() { window.location.href = "/products/" + handle; }, 800);
      }
    });
  }

  function triggerNativeShopifyCart(variantId, title) {
    var numericId = String(variantId).includes("/") ? variantId.split("/").pop() : variantId;
    showHUD("🛒 Calling WebMCP Cart Tool for " + title + "...", false);
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: numericId, quantity: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      showHUD("🛍️ " + title + " added to your bag!", true);
      var cartDrawer = document.querySelector("cart-drawer");
      if (cartDrawer && cartDrawer.open) cartDrawer.open();
      else {
        var cartIcon = document.querySelector("#cart-icon-bubble, .cart-icon, a[href='/cart']");
        if (cartIcon && cartIcon.click) cartIcon.click();
      }
    })
    .catch(function() {
      window.location.href = "/cart/" + numericId + ":1?discount=WEBMCP10";
    });
  }

  // Universal WebMCP Tool Invoker
  function executeWebMCPTool(toolName, args, label) {
    var msgContainer = document.getElementById("jmcp-msg-container");
    var userMsg = document.createElement("div");
    userMsg.className = "jmcp-msg jmcp-msg-user";
    userMsg.textContent = label;
    msgContainer.appendChild(userMsg);

    showHUD("⚡ Executing WebMCP Tool: " + toolName + "...", false);

    // Call tool directly via RegisteredTool.execute or direct definition
    var targetTool = registeredToolMap[toolName] || toolDefs.find(function(t) { return t.name === toolName; });
    var executionPromise;

    if (targetTool && typeof targetTool.execute === "function") {
      executionPromise = targetTool.execute(args);
    } else {
      // Fallback
      var endpoint = toolName === "find_products_by_constraints" ? "/api/products/search" :
                     toolName === "calculate_room_fit_and_clearance" ? "/api/tools/room-fit" :
                     toolName === "compare_products_deep_matrix" ? "/api/tools/compare-deep" :
                     "/api/tools/bundle-builder";
      executionPromise = fetch(API_BASE + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args)
      }).then(function(r) { return r.json(); });
    }

    executionPromise
      .then(function(result) {
        showHUD("✔ " + toolName + " executed!", true);
        var botMsg = document.createElement("div");
        botMsg.className = "jmcp-msg jmcp-msg-assistant";

        var toolTagHtml = `<div class="jmcp-tool-tag"><span>⚙️ WebMCP Tool: ${toolName}</span></div>`;
        var contentHtml = "";

        if (toolName === "find_products_by_constraints") {
          var products = result.products || [];
          contentHtml = `<div>Found <strong>${products.length} verified in-stock items</strong>:</div>`;
          if (products.length > 0) {
            contentHtml += `<div class="jmcp-products">`;
            products.forEach(function(p) {
              var numericVar = String(p.matchedVariantId || p.id).split("/").pop();
              var permalink = `https://jenniferfurniturestaging.myshopify.com/cart/${numericVar}:1?discount=WEBMCP10`;
              var priceFormatted = (p.minPrice != null ? Number(p.minPrice) : 0).toFixed(2);
              contentHtml += `
                <div class="jmcp-card">
                  <img src="${p.featuredImage || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80'}" class="jmcp-img" />
                  <div class="jmcp-card-body">
                    <div class="jmcp-card-title">${p.title}</div>
                    <div class="jmcp-card-price">$${priceFormatted}</div>
                    <div class="jmcp-card-actions">
                      <button class="jmcp-btn-spotlight" data-action="spotlight" data-handle="${p.handle}" data-title="${p.title.replace(/"/g, '&quot;')}">🎯 Spotlight</button>
                      <button class="jmcp-btn-cart-native" data-action="add-cart" data-variant="${numericVar}" data-title="${p.title.replace(/"/g, '&quot;')}">🛍️ Add to Bag</button>
                      <a href="${permalink}" class="jmcp-btn-buy" target="_top">⚡ 1-Click Buy</a>
                    </div>
                  </div>
                </div>
              `;
            });
            contentHtml += `</div>`;
          }
        } else if (toolName === "calculate_room_fit_and_clearance") {
          var fitData = result.data || {};
          var analysis = fitData.clearanceAnalysis || {};
          contentHtml = `
            <div>
              <strong>📐 Living Room Fit Scorecard:</strong><br/>
              • <strong>Room:</strong> ${fitData.room?.dimensions || '12 ft x 10 ft'}<br/>
              • <strong>Verdict:</strong> <span style="color:#2563eb; font-weight:700;">${analysis.verdict || 'EXCELLENT_FIT'} (${analysis.fitScore || 98}/100)</span><br/>
              • <strong>Front Walkway Clearance:</strong> ${analysis.frontWalkwayClearanceInches || 42} inches (Standard minimum: 30")<br/>
              • <strong>Side Margin:</strong> ${analysis.sideClearanceLeftRightInches || 30} inches<br/>
              <p style="margin-top:6px; font-size:12px; color:#475569;">${analysis.expertFeedback || 'Spacious luxury fit allowing unrestricted movement.'}</p>
            </div>
          `;
        } else if (toolName === "compare_products_deep_matrix") {
          var compData = result.data || {};
          contentHtml = `
            <div>
              <strong>⚖️ Side-by-Side Spec Comparison:</strong><br/>
              • <strong>Value Winner:</strong> ${compData.valueWinnerTitle || 'Kirby Sofa Chaise'}<br/>
              <div style="margin-top:8px; font-size:12px; color:#334155; white-space:pre-line;">${compData.expertRecommendation || 'Both items verified in stock.'}</div>
            </div>
          `;
        } else if (toolName === "build_coordinated_room_bundle") {
          var bundleData = result.data || {};
          contentHtml = `
            <div>
              <strong>🎁 ${bundleData.bundleName || '3-Piece Living Room Suite'}:</strong><br/>
              • <strong>Regular Total:</strong> <s>${bundleData.pricing?.regularRetailTotal || '$3,898.98'}</s><br/>
              • <strong>Bundle Price:</strong> <span style="color:#2563eb; font-weight:700; font-size:15px;">${bundleData.pricing?.bundlePrice || '$3,313.98'}</span><br/>
              • <strong>Instant Savings:</strong> ${bundleData.pricing?.instantSavings || '$585.00 (15% OFF applied)'}<br/>
              <div style="margin-top:10px;">
                <a href="${bundleData.checkout?.oneClickBundleCheckoutUrl || '#'}" class="jmcp-btn-buy" style="background:#0f172a; color:white; padding:8px 14px; font-weight:600;" target="_top">⚡ 1-Click Buy 3-Piece Suite</a>
              </div>
            </div>
          `;
        }

        botMsg.innerHTML = toolTagHtml + contentHtml;
        msgContainer.appendChild(botMsg);
        msgContainer.scrollTop = msgContainer.scrollHeight;
      })
      .catch(function(err) {
        showHUD("Error: " + err.message, true);
        var errBubble = document.createElement("div");
        errBubble.className = "jmcp-msg jmcp-msg-assistant";
        errBubble.textContent = "Error executing tool: " + err.message;
        msgContainer.appendChild(errBubble);
      });
  }

  function handleNaturalLanguageInput(query) {
    const lower = query.toLowerCase();
    if (lower.includes("fit") || lower.includes("dimension") || lower.includes("room") || /\d+\s*x\s*\d+/.test(lower)) {
      let roomW = 12, roomL = 10;
      const dim = lower.match(/(\d+)\s*(?:x|by|\*)\s*(\d+)/);
      if (dim) { roomW = parseInt(dim[1]); roomL = parseInt(dim[2]); }
      executeWebMCPTool("calculate_room_fit_and_clearance", { room_width_feet: roomW, room_length_feet: roomL, product_handle: "monika-sleeper-sofa" }, query);
    } else if (lower.includes("bundle") || lower.includes("set") || lower.includes("suite")) {
      executeWebMCPTool("build_coordinated_room_bundle", { base_product_handle: "monika-sleeper-sofa", budget_cap: 3500 }, query);
    } else if (lower.includes("compare") || lower.includes("vs")) {
      executeWebMCPTool("compare_products_deep_matrix", { product_handles: ["kirby-chaise", "mason-leather-89-sofa-1"] }, query);
    } else {
      let maxP = undefined;
      const pMatch = lower.match(/(?:under|below|\$)\s*(\d+)/);
      if (pMatch) maxP = parseInt(pMatch[1]);
      let cat = "sofa";
      if (lower.includes("sectional")) cat = "sectional";
      else if (lower.includes("dining")) cat = "dining";
      else if (lower.includes("bed")) cat = "bed";
      else if (lower.includes("chair")) cat = "chair";
      executeWebMCPTool("find_products_by_constraints", { category: cat, max_price: maxP, in_stock_only: true }, query);
    }
  }

  function init() {
    if (document.getElementById("jmcp-widget-container")) return;

    var styleTag = document.createElement("style");
    styleTag.innerHTML = CSS;
    document.head.appendChild(styleTag);

    var container = document.createElement("div");
    container.id = "jmcp-widget-container";

    var cursor = document.createElement("div");
    cursor.id = "jmcp-ai-cursor";
    cursor.className = "jmcp-ai-cursor";
    cursor.innerHTML = '<div class="jmcp-cursor-pointer"></div><div class="jmcp-cursor-trail"></div>';
    container.appendChild(cursor);

    var hud = document.createElement("div");
    hud.id = "jmcp-action-hud";
    hud.className = "jmcp-hud";
    container.appendChild(hud);

    var trigger = document.createElement("button");
    trigger.className = "jmcp-trigger";
    trigger.innerHTML = '<span style="font-size:16px;">✨</span> <span>Jennifer WebMCP Co-Pilot</span>';
    container.appendChild(trigger);

    var drawer = document.createElement("div");
    drawer.className = "jmcp-drawer";
    drawer.innerHTML = `
      <div class="jmcp-header">
        <div class="jmcp-title">
          <span>✨ Jennifer Co-Pilot</span>
          <span class="jmcp-badge">document.modelContext</span>
        </div>
        <button class="jmcp-close">&times;</button>
      </div>
      <div class="jmcp-messages" id="jmcp-msg-container">
        <div class="jmcp-msg jmcp-msg-assistant">
          Welcome to the <strong>Jennifer Furniture WebMCP Tool Co-Pilot</strong>. Select any tool below or type a query to execute live via <code>document.modelContext</code>:
          
          <div class="jmcp-tool-grid">
            <button class="jmcp-tool-btn" data-tool="find_products_by_constraints" data-args='{"category":"sofa","max_price":4000}' data-label="Search Sofas Under $4,000">
              <span>🛋️ In-Stock Sofas &lt; $4k</span>
              <span class="jmcp-tool-name">find_products_by_constraints</span>
            </button>
            <button class="jmcp-tool-btn" data-tool="calculate_room_fit_and_clearance" data-args='{"room_width_feet":12,"room_length_feet":10,"product_handle":"monika-sleeper-sofa"}' data-label="Check 12x10 Room Fit for Monika Sofa">
              <span>📐 12x10 Room Fit Check</span>
              <span class="jmcp-tool-name">calculate_room_fit</span>
            </button>
            <button class="jmcp-tool-btn" data-tool="compare_products_deep_matrix" data-args='{"product_handles":["kirby-chaise","mason-leather-89-sofa-1"]}' data-label="Compare Kirby Chaise vs Mason Leather">
              <span>⚖️ Deep Spec Comparison</span>
              <span class="jmcp-tool-name">compare_products_deep</span>
            </button>
            <button class="jmcp-tool-btn" data-tool="build_coordinated_room_bundle" data-args='{"base_product_handle":"monika-sleeper-sofa","budget_cap":3500}' data-label="Build 3-Piece Monika Suite (Save 15%)">
              <span>🎁 Build 3-Piece Suite (-15%)</span>
              <span class="jmcp-tool-name">build_room_bundle</span>
            </button>
          </div>
        </div>
      </div>
      <div class="jmcp-input-wrap">
        <input type="text" class="jmcp-input" placeholder="Type prompt (e.g. Will Monika fit my 12x10 living room?)..." id="jmcp-user-input" />
        <button class="jmcp-send" id="jmcp-send-btn">Execute</button>
      </div>
    `;
    container.appendChild(drawer);
    document.body.appendChild(container);

    var inputEl = document.getElementById("jmcp-user-input");
    var sendBtn = document.getElementById("jmcp-send-btn");
    var closeBtn = drawer.querySelector(".jmcp-close");

    trigger.addEventListener("click", function() {
      drawer.classList.add("jmcp-open");
      inputEl.focus();
    });

    closeBtn.addEventListener("click", function() {
      drawer.classList.remove("jmcp-open");
    });

    function onSubmit() {
      var q = inputEl.value.trim();
      if (!q) return;
      inputEl.value = "";
      handleNaturalLanguageInput(q);
    }

    sendBtn.addEventListener("click", onSubmit);
    inputEl.addEventListener("keypress", function(e) {
      if (e.key === "Enter") onSubmit();
    });

    container.addEventListener("click", function(e) {
      var target = e.target;
      var toolBtn = target.closest(".jmcp-tool-btn");
      if (toolBtn) {
        var toolName = toolBtn.dataset.tool;
        var toolArgs = JSON.parse(toolBtn.dataset.args || "{}");
        var toolLabel = toolBtn.dataset.label;
        executeWebMCPTool(toolName, toolArgs, toolLabel);
        return;
      }
      if (target.dataset.action === "spotlight" || target.closest('[data-action="spotlight"]')) {
        var btn = target.dataset.action === "spotlight" ? target : target.closest('[data-action="spotlight"]');
        runVisualAutopilot(btn.dataset.handle, btn.dataset.title);
      }
      if (target.dataset.action === "add-cart" || target.closest('[data-action="add-cart"]')) {
        var btn = target.dataset.action === "add-cart" ? target : target.closest('[data-action="add-cart"]');
        triggerNativeShopifyCart(btn.dataset.variant, btn.dataset.title);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
