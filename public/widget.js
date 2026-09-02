/**
 * Jennifer Furniture WebMCP Next-Gen Luxury Voice Concierge & Multimodal Room Vision
 * Features:
 * 1. Apple Intelligence / Siri Cosmic Voice Orb
 * 2. Embedded Voice Mic & Camera Photo Upload inside Search Bar
 * 3. Multimodal Room Staging & Architectural Fit Analysis (under $2,500 budget)
 * 4. Cushion & Comfort Spec Matrix + Coordinated 3-Piece Suite with 15% Discount
 * 5. W3C document.modelContext & OpenAPI 3.1.0 Tool Standards
 */
(function() {
  if (window.__JENNIFER_VOICE_WEBMCP_V4__) return;
  window.__JENNIFER_VOICE_WEBMCP_V4__ = true;

  // Cleanup legacy instances
  var oldNodes = document.querySelectorAll("#jmcp-widget-container, #jvoice-container, .jvoice-search-mic-btn, .jvoice-search-cam-btn");
  oldNodes.forEach(function(n) { if (n.parentNode) n.parentNode.removeChild(n); });

  var API_BASE = "https://jennifer-webmcp.vercel.app";
  var isVoiceMuted = false;
  var isListening = false;
  var isSpeaking = false;
  var recognition = null;
  var activeTargetInput = null;

  var sessionContext = {
    chatHistory: [],
    activeProducts: [],
    selectedProduct: null,
    roomDimensions: { width: 14, length: 12 },
    uploadedImage: null
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

  // Register the 5 Core WebMCP Tools
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
    },
    {
      name: "analyze_room_photo_and_recommend",
      description: "Analyzes uploaded room photo, evaluates color palette, cushion comfort, and spatial clearance under budget.",
      inputSchema: { type: "object", properties: { image_data: { type: "string" }, budget_cap: { type: "number" }, comfort_type: { type: "string" } } },
      execute: function(args) {
        return fetch(API_BASE + "/api/tools/room-designer", {
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

  // Next-Gen Luxury Glassmorphism Styles
  var CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap');

    .jvoice-container {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* Embedded Search Bar Controls */
    .jvoice-search-mic-btn {
      position: absolute; right: 46px; top: 50%; transform: translateY(-50%);
      z-index: 15; background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.2));
      border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 50%;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      color: #6366f1; cursor: pointer; transition: all 0.25s ease; font-size: 15px;
    }
    .jvoice-search-mic-btn:hover {
      background: linear-gradient(135deg, #6366f1, #a855f7); color: #ffffff;
      transform: translateY(-50%) scale(1.12); box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }
    .jvoice-search-mic-btn.jvoice-search-listening {
      background: linear-gradient(135deg, #ef4444, #f97316); color: white;
      animation: jvoice-orb-pulse 1.2s infinite; border-color: #ef4444;
    }

    .jvoice-search-cam-btn {
      position: absolute; right: 84px; top: 50%; transform: translateY(-50%);
      z-index: 15; background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 50%;
      width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
      color: #94a3b8; cursor: pointer; transition: all 0.25s ease; font-size: 14px;
    }
    .jvoice-search-cam-btn:hover {
      background: rgba(99, 102, 241, 0.25); color: #ffffff; border-color: #6366f1;
      transform: translateY(-50%) scale(1.12);
    }

    /* Floating Apple Intelligence Orb */
    .jvoice-orb {
      position: fixed; bottom: 32px; right: 32px; z-index: 2147483640;
      width: 68px; height: 68px; border-radius: 50%;
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.9), rgba(168, 85, 247, 0.9), rgba(236, 72, 153, 0.9));
      box-shadow: 0 12px 35px rgba(99, 102, 241, 0.45), 0 0 40px rgba(168, 85, 247, 0.35);
      border: 2px solid rgba(255, 255, 255, 0.45);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(16px);
    }
    .jvoice-orb:hover {
      transform: scale(1.1) translateY(-4px);
      box-shadow: 0 20px 45px rgba(99, 102, 241, 0.65), 0 0 60px rgba(236, 72, 153, 0.5);
    }
    .jvoice-orb::before {
      content: ''; position: absolute; inset: -4px; border-radius: 50%;
      background: radial-gradient(circle at center, transparent 30%, rgba(168, 85, 247, 0.4) 70%, transparent 100%);
      animation: jvoice-orb-glow 4s ease-in-out infinite alternate; pointer-events: none;
    }
    @keyframes jvoice-orb-glow {
      0% { transform: scale(0.95); opacity: 0.5; }
      100% { transform: scale(1.25); opacity: 1; }
    }
    .jvoice-orb.jvoice-listening {
      background: linear-gradient(135deg, #ef4444, #f97316, #eab308);
      animation: jvoice-orb-pulse 1.2s infinite;
      box-shadow: 0 0 50px rgba(239, 68, 68, 0.75);
    }
    @keyframes jvoice-orb-pulse {
      0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
      70% { transform: scale(1.14); box-shadow: 0 0 0 22px rgba(239, 68, 68, 0); }
      100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .jvoice-orb-icon { font-size: 28px; color: #ffffff; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.3)); z-index: 1; }

    /* Top HUD Pill */
    .jvoice-hud {
      position: fixed; top: 28px; left: 50%; transform: translateX(-50%) translateY(-120px);
      z-index: 2147483646; background: rgba(11, 15, 25, 0.92); backdrop-filter: blur(24px);
      color: #f8fafc; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 9999px;
      padding: 10px 22px; font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(99, 102, 241, 0.25);
      display: flex; align-items: center; gap: 12px; pointer-events: none;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); opacity: 0;
    }
    .jvoice-hud.jvoice-hud-visible { transform: translateX(-50%) translateY(0); opacity: 1; }
    .jvoice-hud-dot {
      width: 8px; height: 8px; border-radius: 50%; background: #10b981;
      box-shadow: 0 0 12px #10b981; animation: jvoice-dot-pulse 1.5s infinite;
    }
    @keyframes jvoice-dot-pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }

    /* Luxury Glassmorphic Slide-Out Drawer */
    .jvoice-drawer {
      position: fixed; top: 0; right: -520px; width: 480px; max-width: 100vw; height: 100vh;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.98) 0%, rgba(10, 14, 26, 0.99) 100%);
      backdrop-filter: blur(30px); z-index: 2147483645;
      box-shadow: -20px 0 60px rgba(0, 0, 0, 0.8), -1px 0 0 rgba(255, 255, 255, 0.1);
      display: flex; flex-direction: column;
      transition: right 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .jvoice-drawer.jvoice-open { right: 0; }

    .jvoice-header {
      padding: 22px 24px; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.02);
    }
    .jvoice-brand { display: flex; align-items: center; gap: 12px; }
    .jvoice-avatar {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #a855f7);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }
    .jvoice-brand-text { display: flex; flex-direction: column; }
    .jvoice-brand-title { font-size: 15px; font-weight: 700; color: #ffffff; letter-spacing: -0.02em; }
    .jvoice-brand-sub { font-size: 11px; font-family: 'JetBrains Mono', monospace; color: #94a3b8; }
    
    .jvoice-controls { display: flex; align-items: center; gap: 8px; }
    .jvoice-icon-btn {
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1);
      color: #e2e8f0; border-radius: 8px; padding: 6px 10px; font-size: 12px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease; display: flex; align-items: center; gap: 6px;
    }
    .jvoice-icon-btn:hover { background: rgba(255, 255, 255, 0.12); color: #ffffff; }

    /* Live Waveform Banner */
    .jvoice-wave-bar {
      height: 24px; padding: 0 24px; display: flex; align-items: center; gap: 4px;
      background: rgba(99, 102, 241, 0.08); border-bottom: 1px solid rgba(99, 102, 241, 0.15);
    }
    .jvoice-wave-line {
      flex: 1; height: 3px; background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 9999px; transition: height 0.2s ease;
    }
    .jvoice-wave-active .jvoice-wave-line {
      animation: jvoice-wave-dance 1s infinite alternate ease-in-out;
    }
    @keyframes jvoice-wave-dance {
      0% { height: 2px; } 50% { height: 12px; } 100% { height: 4px; }
    }

    /* Message Stream */
    .jvoice-messages {
      flex: 1; overflow-y: auto; padding: 20px 24px; display: flex; flex-direction: column; gap: 16px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent;
    }
    .jvoice-messages::-webkit-scrollbar { width: 5px; }
    .jvoice-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 9999px; }

    .jvoice-msg { max-width: 90%; font-size: 13.5px; line-height: 1.55; border-radius: 16px; padding: 14px 18px; }
    .jvoice-msg-user {
      align-self: flex-end; background: linear-gradient(135deg, #4f46e5, #6366f1);
      color: #ffffff; font-weight: 500; border-bottom-right-radius: 4px;
      box-shadow: 0 8px 25px rgba(79, 70, 229, 0.35);
    }
    .jvoice-msg-assistant {
      align-self: flex-start; background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.09); color: #e2e8f0;
      border-bottom-left-radius: 4px; backdrop-filter: blur(12px);
    }

    .jvoice-tool-badge {
      display: inline-flex; align-items: center; gap: 6px;
      background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.25);
      color: #38bdf8; font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600;
      padding: 3px 9px; border-radius: 6px; margin-bottom: 10px;
    }

    /* Multimodal Upload Thumbnail */
    .jvoice-uploaded-preview {
      width: 100%; max-height: 160px; object-fit: cover; border-radius: 12px;
      margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.15);
    }

    /* Bento Product Cards */
    .jvoice-products-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 12px; }
    .jvoice-card {
      background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px; padding: 12px; display: flex; gap: 14px; transition: all 0.25s ease;
    }
    .jvoice-card:hover {
      background: rgba(255, 255, 255, 0.06); border-color: rgba(99, 102, 241, 0.4);
      transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    }
    .jvoice-card-img {
      width: 90px; height: 90px; object-fit: cover; border-radius: 10px;
      background: #1e293b; border: 1px solid rgba(255,255,255,0.08);
    }
    .jvoice-card-info { flex: 1; display: flex; flex-direction: column; justify-content: space-between; }
    .jvoice-card-title { font-weight: 600; font-size: 13px; color: #f8fafc; line-height: 1.35; }
    .jvoice-card-price-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
    .jvoice-card-price { font-size: 15px; font-weight: 700; color: #38bdf8; }
    .jvoice-card-stock {
      font-size: 10px; font-weight: 700; color: #10b981;
      background: rgba(16, 185, 129, 0.12); padding: 2px 6px; border-radius: 4px;
    }

    .jvoice-card-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .jvoice-btn-spot {
      background: rgba(99, 102, 241, 0.15); border: 1px solid rgba(99, 102, 241, 0.35);
      color: #818cf8; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
      transition: all 0.2s ease;
    }
    .jvoice-btn-spot:hover { background: #4f46e5; color: #ffffff; }

    .jvoice-btn-bag {
      background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.15);
      color: #f1f5f9; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 6px; cursor: pointer;
      transition: all 0.2s ease;
    }
    .jvoice-btn-bag:hover { background: rgba(255, 255, 255, 0.18); color: #ffffff; }

    .jvoice-btn-checkout {
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: #ffffff; font-size: 11px; font-weight: 700; padding: 5px 10px; border-radius: 6px; text-decoration: none;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3); transition: all 0.2s ease;
    }
    .jvoice-btn-checkout:hover { transform: scale(1.03); }

    /* Suggestion Pills */
    .jvoice-chips-wrap { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .jvoice-chip {
      background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
      color: #cbd5e1; border-radius: 9999px; padding: 5px 12px; font-size: 11.5px; font-weight: 600;
      cursor: pointer; transition: all 0.2s ease;
    }
    .jvoice-chip:hover {
      background: rgba(99, 102, 241, 0.2); border-color: rgba(99, 102, 241, 0.45); color: #ffffff;
      transform: translateY(-1px);
    }

    /* Modern Bottom Input Bar with Camera & Mic */
    .jvoice-input-container {
      padding: 18px 24px; background: rgba(255, 255, 255, 0.02);
      border-top: 1px solid rgba(255, 255, 255, 0.08); display: flex; gap: 8px; align-items: center;
    }
    .jvoice-input-pill {
      flex: 1; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 12px; padding: 11px 16px; font-size: 13.5px; color: #ffffff; outline: none;
      transition: all 0.2s ease;
    }
    .jvoice-input-pill:focus {
      background: rgba(255, 255, 255, 0.08); border-color: #6366f1;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
    }
    .jvoice-input-pill::placeholder { color: #64748b; }

    .jvoice-mic-trigger {
      background: linear-gradient(135deg, #6366f1, #a855f7); border: none; border-radius: 12px;
      width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
      color: white; font-size: 18px; cursor: pointer; transition: all 0.2s ease;
      box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
    }
    .jvoice-mic-trigger:hover { transform: scale(1.05); }

    .jvoice-cam-trigger {
      background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center;
      color: #cbd5e1; font-size: 18px; cursor: pointer; transition: all 0.2s ease;
    }
    .jvoice-cam-trigger:hover { background: rgba(99, 102, 241, 0.2); color: white; border-color: #6366f1; }

    /* Laser Spotlight Target Animation */
    .jvoice-spotlight-target {
      position: relative; animation: jvoice-laser-pulse 4.5s ease-out forwards;
      border-radius: 14px; scroll-margin-top: 120px;
    }
    @keyframes jvoice-laser-pulse {
      0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.95), 0 0 40px rgba(168, 85, 247, 0.85); outline: 3px solid #818cf8; }
      35% { box-shadow: 0 0 0 20px rgba(99, 102, 241, 0.4), 0 0 60px rgba(236, 72, 153, 0.5); outline: 3px solid #c084fc; }
      100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); outline: 2px solid transparent; }
    }
  `;

  var hudTimer = null;
  function showHUD(text, isDone) {
    var hud = document.getElementById("jvoice-action-hud");
    if (!hud) return;
    hud.innerHTML = `
      <div class="jvoice-hud-dot" style="${isDone ? 'background:#10b981; box-shadow:0 0 12px #10b981;' : 'background:#38bdf8; box-shadow:0 0 12px #38bdf8;'}"></div>
      <span>${text}</span>
    `;
    hud.classList.add("jvoice-hud-visible");
    if (hudTimer) clearTimeout(hudTimer);
    if (isDone) {
      hudTimer = setTimeout(function() { hud.classList.remove("jvoice-hud-visible"); }, 3800);
    }
  }

  function setWaveform(active) {
    var bar = document.getElementById("jvoice-wave-bar");
    if (!bar) return;
    if (active) bar.classList.add("jvoice-wave-active");
    else bar.classList.remove("jvoice-wave-active");
  }

  // Text to Speech
  function speakResponse(text) {
    if (isVoiceMuted || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    var cleanText = text
      .replace(/###|\*\*|__|```|•|🛒|⚡|🎁|⚖️|📐|🛋️|🎯|🛍️|📸|🏛️/g, "")
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
      .replace(/https?:\/\/\S+/g, "")
      .trim();

    var utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.05;
    utterance.pitch = 1.0;
    utterance.onstart = function() { isSpeaking = true; setWaveform(true); };
    utterance.onend = function() { isSpeaking = false; setWaveform(false); };
    utterance.onerror = function() { isSpeaking = false; setWaveform(false); };
    window.speechSynthesis.speak(utterance);
  }

  function runVisualAutopilot(handle, title) {
    showHUD("🎯 Spotlighting " + title + "...", false);
    var selector = 'a[href*="/products/' + handle + '"], [data-product-handle="' + handle + '"]';
    var targetLink = document.querySelector(selector);
    if (targetLink) {
      var card = targetLink.closest('.card, .product-card, .grid__item, li, div') || targetLink;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
      card.classList.add("jvoice-spotlight-target");
      showHUD("✨ Spotlighted " + title + "!", true);
      setTimeout(function() { card.classList.remove("jvoice-spotlight-target"); }, 4500);
    } else {
      showHUD("🚀 Navigating to: " + title + "...", false);
      setTimeout(function() { window.location.href = "/products/" + handle; }, 800);
    }
  }

  function triggerNativeShopifyCart(variantId, title) {
    var numericId = String(variantId).includes("/") ? variantId.split("/").pop() : variantId;
    showHUD("🛒 Adding " + title + " to Bag...", false);
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

  // Multi-Turn Execution with Image Support
  function executeUserQuery(query, imageBase64) {
    var msgContainer = document.getElementById("jvoice-msg-container");
    var userMsg = document.createElement("div");
    userMsg.className = "jvoice-msg jvoice-msg-user";

    if (imageBase64) {
      userMsg.innerHTML = `<img src="${imageBase64}" class="jvoice-uploaded-preview" /><br/><span>${query || "Analyze this room and recommend a sofa under $2,500"}</span>`;
    } else {
      userMsg.textContent = query;
    }

    msgContainer.appendChild(userMsg);
    sessionContext.chatHistory.push({ role: "user", content: query || "Analyze room photo" });

    showHUD("🧠 WebMCP Room Vision & Aesthetic Analysis...", false);
    setWaveform(true);

    fetch(API_BASE + "/api/agent/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: query || "Analyze this room photo and recommend the best fitting sofa under $2,500",
        image: imageBase64 || null,
        history: sessionContext.chatHistory.slice(-6),
        context: sessionContext
      })
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
      showHUD("✔ WebMCP Agent Ready!", true);
      setWaveform(false);

      if (data.contextUpdate) {
        if (data.contextUpdate.selectedProduct) sessionContext.selectedProduct = data.contextUpdate.selectedProduct;
        if (data.contextUpdate.roomDimensions) sessionContext.roomDimensions = data.contextUpdate.roomDimensions;
      }

      var botMsg = document.createElement("div");
      botMsg.className = "jvoice-msg jvoice-msg-assistant";

      var textFormatted = (data.text || "")
        .replace(/\n/g, "<br/>")
        .replace(/\*\*(.*?)\*\*/g, "<strong style='color:#ffffff;'>$1</strong>");
      var html = `<div>${textFormatted}</div>`;

      // Product Cards
      if (data.products && data.products.length > 0) {
        sessionContext.activeProducts = data.products;
        if (!sessionContext.selectedProduct) sessionContext.selectedProduct = data.products[0];

        html += `<div class="jvoice-products-grid">`;
        data.products.forEach(function(p) {
          var numericVar = String(p.variantId || p.id).split("/").pop();
          var priceFormatted = (p.price != null ? Number(p.price) : 0).toFixed(2);
          html += `
            <div class="jvoice-card">
              <img src="${p.image || 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=600&q=80'}" class="jvoice-card-img" />
              <div class="jvoice-card-info">
                <div>
                  <div class="jvoice-card-title">${p.title}</div>
                  <div class="jvoice-card-price-row">
                    <span class="jvoice-card-price">$${priceFormatted}</span>
                    <span class="jvoice-card-stock">● In Stock</span>
                  </div>
                </div>
                <div class="jvoice-card-actions">
                  <button class="jvoice-btn-spot" data-action="spotlight" data-handle="${p.handle}" data-title="${p.title.replace(/"/g, '&quot;')}" data-id="${numericVar}">🎯 Spotlight</button>
                  <button class="jvoice-btn-bag" data-action="add-cart" data-variant="${numericVar}" data-title="${p.title.replace(/"/g, '&quot;')}">🛍️ Add to Bag</button>
                  <a href="${p.checkoutUrl || '#'}" class="jvoice-btn-checkout" target="_top">⚡ 1-Click Buy</a>
                </div>
              </div>
            </div>
          `;
        });
        html += `</div>`;
      }

      // Smart Suggestion Chips
      if (data.chips && data.chips.length > 0) {
        html += `<div class="jvoice-chips-wrap">`;
        data.chips.forEach(function(c) {
          html += `<button class="jvoice-chip" data-chip="${c.replace(/"/g, '&quot;')}">${c}</button>`;
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
      setWaveform(false);
      var errBubble = document.createElement("div");
      errBubble.className = "jvoice-msg jvoice-msg-assistant";
      errBubble.textContent = "Error executing WebMCP agent: " + err.message;
      msgContainer.appendChild(errBubble);
    });
  }

  function handlePhotoFile(file) {
    if (!file) return;
    showHUD("📸 Processing room photo...", false);
    var reader = new FileReader();
    reader.onload = function(e) {
      var base64 = e.target.result;
      sessionContext.uploadedImage = base64;
      var drawer = document.getElementById("jvoice-drawer");
      if (drawer) drawer.classList.add("jvoice-open");
      executeUserQuery("Analyze this room photo and recommend a sofa under $2,500 that matches my layout and cushion comfort", base64);
    };
    reader.readAsDataURL(file);
  }

  function startVoiceListening(targetInputElement) {
    var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice input is supported in Chrome, Safari, and modern mobile browsers.");
      return;
    }

    if (isListening) {
      if (recognition) recognition.stop();
      return;
    }

    activeTargetInput = targetInputElement || null;
    recognition = new SpeechRec();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = function() {
      isListening = true;
      var orb = document.getElementById("jvoice-orb-btn");
      var micBtns = document.querySelectorAll("#jvoice-mic-btn, .jvoice-search-mic-btn");
      if (orb) orb.classList.add("jvoice-listening");
      micBtns.forEach(function(b) { b.classList.add("jvoice-search-listening"); b.innerHTML = '🛑'; });
      showHUD("🎙️ Listening... Speak naturally now", false);
    };

    recognition.onresult = function(event) {
      var speechResult = event.results[0][0].transcript;
      if (activeTargetInput) activeTargetInput.value = speechResult;
      if (event.results[0].isFinal) {
        showHUD("🗣️ \"" + speechResult + "\"", false);
        var drawer = document.getElementById("jvoice-drawer");
        if (drawer) drawer.classList.add("jvoice-open");
        executeUserQuery(speechResult);
      }
    };

    recognition.onerror = function(e) {
      showHUD("Voice error: " + e.error, true);
    };

    recognition.onend = function() {
      isListening = false;
      var orb = document.getElementById("jvoice-orb-btn");
      var micBtns = document.querySelectorAll("#jvoice-mic-btn, .jvoice-search-mic-btn");
      if (orb) orb.classList.remove("jvoice-listening");
      micBtns.forEach(function(b) { b.classList.remove("jvoice-search-listening"); b.innerHTML = '🎙️'; });
    };

    recognition.start();
  }

  // Inject Voice Mic & Camera Photo Buttons into all theme search bars
  function injectSearchControls() {
    var searchInputs = document.querySelectorAll('input[type="search"], input[name="q"], .search__input, #Search-In-Modal, #Search-In-Template');
    searchInputs.forEach(function(input) {
      if (input.dataset.jvoiceInjected) return;
      input.dataset.jvoiceInjected = "true";

      var parent = input.parentElement;
      if (parent) {
        var computedPos = window.getComputedStyle(parent).position;
        if (computedPos === "static") parent.style.position = "relative";

        // 1. Camera Photo Upload Button
        var camBtn = document.createElement("button");
        camBtn.type = "button";
        camBtn.className = "jvoice-search-cam-btn";
        camBtn.title = "Upload Room Photo for AI Fit & Styling Recommendation";
        camBtn.innerHTML = '📷';

        var hiddenFileInput = document.createElement("input");
        hiddenFileInput.type = "file";
        hiddenFileInput.accept = "image/*";
        hiddenFileInput.style.display = "none";
        hiddenFileInput.addEventListener("change", function(e) {
          if (e.target.files && e.target.files[0]) handlePhotoFile(e.target.files[0]);
        });
        parent.appendChild(hiddenFileInput);

        camBtn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          hiddenFileInput.click();
        });

        // 2. Microphone Voice Button
        var micBtn = document.createElement("button");
        micBtn.type = "button";
        micBtn.className = "jvoice-search-mic-btn";
        micBtn.title = "Speak with Jennifer Furniture AI Voice Agent";
        micBtn.innerHTML = '🎙️';

        micBtn.addEventListener("click", function(e) {
          e.preventDefault();
          e.stopPropagation();
          startVoiceListening(input);
        });

        parent.appendChild(camBtn);
        parent.appendChild(micBtn);
      }

      // Handle Enter key in search bar to execute via WebMCP
      input.addEventListener("keydown", function(e) {
        if (e.key === "Enter" && input.value.trim().length > 3) {
          var val = input.value.trim();
          var lower = val.toLowerCase();
          if (lower.includes("fit") || lower.includes("dimension") || lower.includes("under") || lower.includes("bundle") || lower.includes("compare") || lower.includes("room")) {
            e.preventDefault();
            e.stopPropagation();
            var drawer = document.getElementById("jvoice-drawer");
            if (drawer) drawer.classList.add("jvoice-open");
            executeUserQuery(val);
          }
        }
      });
    });
  }

  function init() {
    if (document.getElementById("jvoice-container")) return;

    var styleTag = document.createElement("style");
    styleTag.innerHTML = CSS;
    document.head.appendChild(styleTag);

    var container = document.createElement("div");
    container.id = "jvoice-container";
    container.className = "jvoice-container";

    // Hidden global file input for camera uploads
    var globalFileInput = document.createElement("input");
    globalFileInput.type = "file";
    globalFileInput.id = "jvoice-global-file-input";
    globalFileInput.accept = "image/*";
    globalFileInput.style.display = "none";
    globalFileInput.addEventListener("change", function(e) {
      if (e.target.files && e.target.files[0]) handlePhotoFile(e.target.files[0]);
    });
    container.appendChild(globalFileInput);

    // Glowing Apple Intelligence Voice Orb
    var orb = document.createElement("div");
    orb.id = "jvoice-orb-btn";
    orb.className = "jvoice-orb";
    orb.title = "Tap to speak with Jennifer Furniture WebMCP AI";
    orb.innerHTML = '<div class="jvoice-orb-icon">✨</div>';
    container.appendChild(orb);

    // Top HUD Action Bar
    var hud = document.createElement("div");
    hud.id = "jvoice-action-hud";
    hud.className = "jvoice-hud";
    container.appendChild(hud);

    // Luxury Glassmorphic Slide-out Drawer
    var drawer = document.createElement("div");
    drawer.id = "jvoice-drawer";
    drawer.className = "jvoice-drawer";
    drawer.innerHTML = `
      <div class="jvoice-header">
        <div class="jvoice-brand">
          <div class="jvoice-avatar">✨</div>
          <div class="jvoice-brand-text">
            <span class="jvoice-brand-title">Jennifer AI Concierge</span>
            <span class="jvoice-brand-sub">W3C WebMCP & Vision Engine</span>
          </div>
        </div>
        <div class="jvoice-controls">
          <button class="jvoice-icon-btn" id="jvoice-mute-toggle">🔊 Voice: ON</button>
          <button class="jvoice-icon-btn" id="jvoice-close-btn" style="padding:6px 9px;">✕</button>
        </div>
      </div>
      
      <!-- Waveform Audio Visualizer -->
      <div class="jvoice-wave-bar" id="jvoice-wave-bar">
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
        <div class="jvoice-wave-line"></div>
      </div>

      <div class="jvoice-messages" id="jvoice-msg-container">
        <div class="jvoice-msg jvoice-msg-assistant">
          <div class="jvoice-tool-badge">📷 Multimodal Room Vision Connected</div>
          Welcome! I am your <strong>Voice Concierge & Interior Designer</strong>. 
          <br/><br/>
          📷 <strong>Upload a photo of your living room/hall</strong> or tap 🎙️ to ask for the best fitting sofa under your budget!
          
          <div class="jvoice-chips-wrap" style="margin-top:14px;">
            <button class="jvoice-chip" data-chip="Analyze my room photo for a sofa under $2,500">📸 Room Photo Consultation</button>
            <button class="jvoice-chip" data-chip="Find in-stock sleeper sofas under $2,000">🛋️ In-Stock Sofas &lt; $2k</button>
            <button class="jvoice-chip" data-chip="Will Monika sleeper fit my 12x10 living room?">📐 12x10 Room Fit Check</button>
            <button class="jvoice-chip" data-chip="Build a 3-piece living room bundle with 15% discount">🎁 3-Piece Suite (-15%)</button>
          </div>
        </div>
      </div>

      <div class="jvoice-input-container">
        <button class="jvoice-cam-trigger" id="jvoice-cam-btn" title="Upload Room Photo">📷</button>
        <button class="jvoice-mic-trigger" id="jvoice-mic-btn" title="Tap to Speak">🎙️</button>
        <input type="text" class="jvoice-input-pill" placeholder="Speak, type, or upload room..." id="jvoice-user-input" />
        <button class="jvoice-icon-btn" id="jvoice-send-btn" style="background:#6366f1; color:white; border:none; padding:11px 16px; border-radius:12px; font-weight:700;">Send</button>
      </div>
    `;
    container.appendChild(drawer);
    document.body.appendChild(container);

    var inputEl = document.getElementById("jvoice-user-input");
    var sendBtn = document.getElementById("jvoice-send-btn");
    var micBtn = document.getElementById("jvoice-mic-btn");
    var camBtn = document.getElementById("jvoice-cam-btn");
    var closeBtn = document.getElementById("jvoice-close-btn");
    var muteBtn = document.getElementById("jvoice-mute-toggle");

    orb.addEventListener("click", function() {
      drawer.classList.add("jvoice-open");
      startVoiceListening();
    });

    camBtn.addEventListener("click", function() {
      globalFileInput.click();
    });

    micBtn.addEventListener("click", function() {
      startVoiceListening(inputEl);
    });

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
      var chipBtn = target.closest(".jvoice-chip");
      if (chipBtn) {
        var chipText = chipBtn.dataset.chip || chipBtn.innerText;
        if (chipText.includes("Room Photo Consultation")) {
          globalFileInput.click();
        } else {
          executeUserQuery(chipText);
        }
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

    // Inject Search Bar Controls immediately & watch for dynamic modals
    injectSearchControls();
    setInterval(injectSearchControls, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
