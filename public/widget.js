/**
 * Jennifer Furniture Voice-Driven WebMCP Concierge
 * Dual-Engine: Voice-to-Voice (Speech Recognition + Synthesis) + W3C WebMCP Protocol
 * Live on Shopify Plus (JF Staging) & Vercel
 */
(function() {
  if (window.__JENNIFER_VOICE_WEBMCP_INIT__) return;
  window.__JENNIFER_VOICE_WEBMCP_INIT__ = true;

  var API_BASE = "https://jennifer-webmcp.vercel.app";
  var isVoiceMuted = false;
  var isListening = false;
  var recognition = null;

  // Session context for multi-turn reasoning
  var sessionContext = {
    chatHistory: [],
    activeProducts: [],
    selectedProduct: null,
    roomDimensions: { width: 12, length: 10 }
  };

  // 1. Initialize W3C document.modelContext in browser
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

  // Register the 4 Core WebMCP Tools
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

  var registeredToolMap = {};
  toolDefs.forEach(function(t) {
    try {
      var reg = window.document.modelContext.registerTool(t);
      registeredToolMap[t.name] = reg || t;
    } catch(e) {
      registeredToolMap[t.name] = t;
    }
  });

  // Styles
  var CSS = `
    .jvoice-orb {
      position: fixed; bottom: 28px; right: 28px; z-index: 2147483640;
      width: 64px; height: 64px; border-radius: 50%;
      background: radial-gradient(circle at 30% 30%, #3b82f6, #1e1b4b);
      box-shadow: 0 10px 30px rgba(37, 99, 235, 0.45), 0 0 20px rgba(59, 130, 246, 0.3);
      border: 2px solid rgba(255, 255, 255, 0.35); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .jvoice-orb:hover { transform: scale(1.08) translateY(-3px); box-shadow: 0 15px 35px rgba(37, 99, 235, 0.6); }
    .jvoice-orb.jvoice-listening {
      animation: jvoice-pulse-ring 1.4s infinite;
      background: radial-gradient(circle at 30% 30%, #ef4444, #7f1d1d);
      box-shadow: 0 0 35px rgba(239, 68, 68, 0.8);
      border-color: #fca5a5;
    }
    @keyframes jvoice-pulse-ring {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.12); box-shadow: 0 0 0 18px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .jvoice-orb-icon { font-size: 26px; color: white; user-select: none; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }

    .jvoice-hud {
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-100px);
      z-index: 2147483645; background: rgba(15, 23, 42, 0.96); backdrop-filter: blur(16px);
      color: #ffffff; border: 1px solid rgba(59, 130, 246, 0.5); border-radius: 9999px;
      padding: 10px 24px; font-family: monospace; font-size: 13px; font-weight: 600;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6); display: flex; align-items: center; gap: 12px;
      pointer-events: none; transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease; opacity: 0;
    }
    .jvoice-hud.jvoice-hud-visible { transform: translateX(-50%) translateY(0); opacity: 1; }
    .jvoice-hud-spinner {
      width: 14px; height: 14px; border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #38bdf8; border-radius: 50%; animation: jvoice-spin 0.8s linear infinite;
    }
    @keyframes jvoice-spin { to { transform: rotate(360deg); } }

    .jvoice-drawer {
      position: fixed; top: 0; right: -490px; width: 450px; max-width: 100vw; height: 100vh;
      background: #ffffff; z-index: 2147483644; box-shadow: -15px 0 45px rgba(0,0,0,0.35);
      display: flex; flex-direction: column; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      transition: right 0.35s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .jvoice-drawer.jvoice-open { right: 0; }
    .jvoice-header {
      background: #0f172a; color: #ffffff; padding: 18px 20px;
      display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .jvoice-title { font-size: 15px; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .jvoice-badge { font-size: 10px; background: #2563eb; color: white; padding: 2px 7px; border-radius: 4px; font-family: monospace; }
    .jvoice-header-actions { display: flex; align-items: center; gap: 12px; }
    .jvoice-mute-btn { background: transparent; border: 1px solid rgba(255,255,255,0.25); color: #e2e8f0; font-size: 12px; border-radius: 6px; padding: 4px 8px; cursor: pointer; }
    .jvoice-close { background: transparent; border: none; color: #94a3b8; font-size: 24px; cursor: pointer; }

    .jvoice-messages {
      flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 14px; background: #f8fafc;
    }
    .jvoice-msg { max-width: 92%; padding: 12px 14px; border-radius: 12px; font-size: 13px; line-height: 1.5; }
    .jvoice-msg-user { align-self: flex-end; background: #2563eb; color: #ffffff; }
    .jvoice-msg-assistant { align-self: flex-start; background: #ffffff; color: #1e293b; border: 1px solid #e2e8f0; }

    .jvoice-tool-tag {
      display: inline-flex; align-items: center; gap: 6px; background: #0f172a; color: #38bdf8;
      font-family: monospace; font-size: 11px; padding: 4px 8px; border-radius: 6px; margin-bottom: 8px;
    }

    .jvoice-products { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
    .jvoice-card { background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; display: flex; gap: 12px; }
    .jvoice-img { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; }
    .jvoice-card-body { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .jvoice-card-title { font-weight: 600; font-size: 12px; color: #0f172a; }
    .jvoice-card-price { font-size: 14px; font-weight: 700; color: #2563eb; }
    .jvoice-card-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }

    .jvoice-btn-spotlight { background: #2563eb; color: white; border: none; font-size: 11px; padding: 5px 9px; border-radius: 6px; cursor: pointer; }
    .jvoice-btn-cart-native { background: #0f172a; color: white; border: none; font-size: 11px; padding: 5px 9px; border-radius: 6px; cursor: pointer; }
    .jvoice-btn-buy { background: #f1f5f9; color: #334155; text-decoration: none; font-size: 11px; padding: 5px 8px; border-radius: 6px; display: inline-block; }

    .jvoice-input-wrap { padding: 14px; background: #ffffff; border-top: 1px solid #e2e8f0; display: flex; gap: 8px; align-items: center; }
    .jvoice-input { flex: 1; border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px 12px; font-size: 13px; outline: none; }
    .jvoice-mic-input-btn { background: #eff6ff; border: 1px solid #bfdbfe; color: #2563eb; border-radius: 8px; padding: 8px 12px; font-size: 16px; cursor: pointer; }
    .jvoice-send { background: #2563eb; color: white; border: none; border-radius: 8px; padding: 10px 16px; font-weight: 600; cursor: pointer; }

    .jvoice-spotlight-target {
      position: relative; animation: jvoice-laser-pulse 4s ease-out forwards; border-radius: 12px; scroll-margin-top: 120px;
    }
    @keyframes jvoice-laser-pulse {
      0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.9), 0 0 35px rgba(59, 130, 246, 0.7); outline: 3px solid #3b82f6; }
      30% { box-shadow: 0 0 0 18px rgba(59, 130, 246, 0.35); outline: 3px solid #60a5fa; }
      100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); outline: 2px solid transparent; }
    }
  `;

  var hudTimer = null;
  function showHUD(text, isDone) {
    var hud = document.getElementById("jvoice-action-hud");
    if (!hud) return;
    hud.innerHTML = `
      ${isDone ? '<span style="color:#4ade80;">✔</span>' : '<div class="jvoice-hud-spinner"></div>'}
      <span>${text}</span>
    `;
    hud.classList.add("jvoice-hud-visible");
    if (hudTimer) clearTimeout(hudTimer);
    if (isDone) {
      hudTimer = setTimeout(function() { hud.classList.remove("jvoice-hud-visible"); }, 3500);
    }
  }

  // Text to Speech
  function speakResponse(text) {
    if (isVoiceMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var cleanText = text
      .replace(/###|\*\*|__|```|•|🛒|⚡|🎁|⚖️|📐|🛋️|🎯|🛍️/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    var utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }

  function runVisualAutopilot(handle, title) {
    showHUD("🎯 Voice Agent spotlighting " + title + "...", false);
    var selector = 'a[href*="/products/' + handle + '"], [data-product-handle="' + handle + '"]';
    var targetLink = document.querySelector(selector);
    if (targetLink) {
      var card = targetLink.closest('.card, .product-card, .grid__item, li, div') || targetLink;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("jvoice-spotlight-target");
      showHUD("✨ Spotlighted " + title + "!", true);
      setTimeout(function() { card.classList.remove("jvoice-spotlight-target"); }, 4000);
    } else {
      showHUD("🚀 Opening product: " + title + "...", false);
      setTimeout(function() { window.location.href = "/products/" + handle; }, 800);
    }
  }

  function triggerNativeShopifyCart(variantId, title) {
    var numericId = String(variantId).includes("/") ? variantId.split("/").pop() : variantId;
    showHUD("🛒 WebMCP Adding " + title + " to Bag...", false);
    fetch("/cart/add.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: numericId, quantity: 1 })
    })
    .then(function(r) { return r.json(); })
    .then(function() {
      showHUD("🛍️ " + title + " added to bag!", true);
      speakResponse(title + " added to your shopping bag with promotional discount applied.");
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

  // Multi-Turn Execution
  function executeUserQuery(query) {
    var msgContainer = document.getElementById("jvoice-msg-container");
    var userMsg = document.createElement("div");
    userMsg.className = "jvoice-msg jvoice-msg-user";
    userMsg.textContent = query;
    msgContainer.appendChild(userMsg);
    sessionContext.chatHistory.push({ role: "user", content: query });

    showHUD("🧠 WebMCP reasoning: " + query + "...", false);

    fetch(API_BASE + "/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: query,
        history: sessionContext.chatHistory.slice(-6),
        context: sessionContext
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showHUD("✔ WebMCP completed!", true);

      if (data.contextUpdate) {
        if (data.contextUpdate.selectedProduct) sessionContext.selectedProduct = data.contextUpdate.selectedProduct;
        if (data.contextUpdate.roomDimensions) sessionContext.roomDimensions = data.contextUpdate.roomDimensions;
      }

      var botMsg = document.createElement("div");
      botMsg.className = "jvoice-msg jvoice-msg-assistant";

      var textFormatted = (data.text || "").replace(/\n/g, "<br/>").replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      var html = `<div>${textFormatted}</div>`;

      if (data.products && data.products.length > 0) {
        sessionContext.activeProducts = data.products;
        if (!sessionContext.selectedProduct) sessionContext.selectedProduct = data.products[0];

        html += `<div class="jvoice-products">`;
        data.products.forEach(function(p) {
          var numericVar = String(p.variantId || p.id).split("/").pop();
          var priceFormatted = (p.price != null ? Number(p.price) : 0).toFixed(2);
          html += `
            <div class="jvoice-card">
              <img src="${p.image || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80'}" class="jvoice-img" />
              <div class="jvoice-card-body">
                <div class="jvoice-card-title">${p.title}</div>
                <div class="jvoice-card-price">$${priceFormatted}</div>
                <div class="jvoice-card-actions">
                  <button class="jvoice-btn-spotlight" data-action="spotlight" data-handle="${p.handle}" data-title="${p.title.replace(/"/g, '&quot;')}" data-id="${numericVar}">🎯 Spotlight</button>
                  <button class="jvoice-btn-cart-native" data-action="add-cart" data-variant="${numericVar}" data-title="${p.title.replace(/"/g, '&quot;')}">🛍️ Add to Bag</button>
                  <a href="${p.checkoutUrl || '#'}" class="jvoice-btn-buy" target="_top">⚡ 1-Click Buy</a>
                </div>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      if (data.chips && data.chips.length > 0) {
        html += `<div style="display:flex; flex-wrap:wrap; gap:6px; margin-top:12px;">`;
        data.chips.forEach(function(c) {
          html += `<button class="jvoice-chip-btn" style="background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; border-radius:9999px; padding:4px 10px; font-size:11px; font-weight:600; cursor:pointer;" data-chip="${c.replace(/"/g, '&quot;')}">${c}</button>`;
        });
        html += `</div>`;
      }

      botMsg.innerHTML = html;
      msgContainer.appendChild(botMsg);
      sessionContext.chatHistory.push({ role: "assistant", content: data.text });
      msgContainer.scrollTop = msgContainer.scrollHeight;

      // Speak back
      speakResponse(data.text);
    })
    .catch(function(err) {
      showHUD("Error: " + err.message, true);
      var errBubble = document.createElement("div");
      errBubble.className = "jvoice-msg jvoice-msg-assistant";
      errBubble.textContent = "Error executing WebMCP agent: " + err.message;
      msgContainer.appendChild(errBubble);
    });
  }

  function startVoiceListening() {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice input is supported in Chrome, Safari, and modern mobile browsers.");
      return;
    }

    if (isListening) {
      if (recognition) recognition.stop();
      return;
    }

    recognition = new SpeechRec();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
      isListening = true;
      var orb = document.getElementById("jvoice-orb-btn");
      var micBtn = document.getElementById("jvoice-mic-btn");
      if (orb) orb.classList.add("jvoice-listening");
      if (micBtn) micBtn.innerText = "🛑";
      showHUD("🎙️ Listening... Speak naturally now", false);
    };

    recognition.onresult = function(event) {
      var speechResult = event.results[0][0].transcript;
      showHUD("🗣️ \"" + speechResult + "\"", false);
      var drawer = document.getElementById("jvoice-drawer");
      if (drawer) drawer.classList.add("jvoice-open");
      executeUserQuery(speechResult);
    };

    recognition.onerror = function(e) {
      showHUD("Voice error: " + e.error, true);
    };

    recognition.onend = function() {
      isListening = false;
      var orb = document.getElementById("jvoice-orb-btn");
      var micBtn = document.getElementById("jvoice-mic-btn");
      if (orb) orb.classList.remove("jvoice-listening");
      if (micBtn) micBtn.innerText = "🎙️";
    };

    recognition.start();
  }

  function init() {
    if (document.getElementById("jvoice-container")) return;

    var styleTag = document.createElement("style");
    styleTag.innerHTML = CSS;
    document.head.appendChild(styleTag);

    var container = document.createElement("div");
    container.id = "jvoice-container";

    // Glowing Voice Orb
    var orb = document.createElement("div");
    orb.id = "jvoice-orb-btn";
    orb.className = "jvoice-orb";
    orb.innerHTML = '<div class="jvoice-orb-icon">🎙️</div>';
    container.appendChild(orb);

    // Action HUD
    var hud = document.getElementById("jvoice-action-hud");
    if (!hud) {
      hud = document.createElement("div");
      hud.id = "jvoice-action-hud";
      hud.className = "jvoice-hud";
      container.appendChild(hud);
    }

    // Slide-out Drawer
    var drawer = document.createElement("div");
    drawer.id = "jvoice-drawer";
    drawer.className = "jvoice-drawer";
    drawer.innerHTML = `
      <div class="jvoice-header">
        <div class="jvoice-title">
          <span>🎙️ Voice Concierge</span>
          <span class="jvoice-badge">WebMCP Protocol</span>
        </div>
        <div class="jvoice-header-actions">
          <button class="jvoice-mute-btn" id="jvoice-mute-toggle">🔊 Voice: ON</button>
          <button class="jvoice-close" id="jvoice-close-btn">&times;</button>
        </div>
      </div>
      <div class="jvoice-messages" id="jvoice-msg-container">
        <div class="jvoice-msg jvoice-msg-assistant">
          Welcome to the <strong>Jennifer Furniture Voice Concierge</strong>. Tap the microphone 🎙️ and speak naturally:
          <div style="margin-top:10px; font-size:12px; color:#475569;">
            • <em>"Find me a sleeper sectional under $2,000"</em><br/>
            • <em>"Will this Monika sofa fit a 12 by 10 room?"</em><br/>
            • <em>"Build a 3-piece living room bundle with 15% discount"</em>
          </div>
        </div>
      </div>
      <div class="jvoice-input-wrap">
        <button class="jvoice-mic-input-btn" id="jvoice-mic-btn" title="Click to speak">🎙️</button>
        <input type="text" class="jvoice-input" placeholder="Speak or type prompt..." id="jvoice-user-input" />
        <button class="jvoice-send" id="jvoice-send-btn">Send</button>
      </div>
    `;
    container.appendChild(drawer);
    document.body.appendChild(container);

    var inputEl = document.getElementById("jvoice-user-input");
    var sendBtn = document.getElementById("jvoice-send-btn");
    var micBtn = document.getElementById("jvoice-mic-btn");
    var closeBtn = document.getElementById("jvoice-close-btn");
    var muteBtn = document.getElementById("jvoice-mute-toggle");

    orb.addEventListener("click", function() {
      drawer.classList.add("jvoice-open");
      startVoiceListening();
    });

    micBtn.addEventListener("click", startVoiceListening);

    muteBtn.addEventListener("click", function() {
      isVoiceMuted = !isVoiceMuted;
      muteBtn.innerText = isVoiceMuted ? "🔇 Voice: OFF" : "🔊 Voice: ON";
      if (isVoiceMuted && window.speechSynthesis) window.speechSynthesis.cancel();
    });

    closeBtn.addEventListener("click", function() {
      drawer.classList.remove("jvoice-open");
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    });

    function onSubmit() {
      var q = inputEl.value.trim();
      if (!q) return;
      inputEl.value = "";
      executeUserQuery(q);
    }

    sendBtn.addEventListener("click", onSubmit);
    inputEl.addEventListener("keypress", function(e) {
      if (e.key === "Enter") onSubmit();
    });

    container.addEventListener("click", function(e) {
      var target = e.target;
      var chipBtn = target.closest(".jvoice-chip-btn");
      if (chipBtn) {
        var chipText = chipBtn.dataset.chip || chipBtn.innerText;
        executeUserQuery(chipText);
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
