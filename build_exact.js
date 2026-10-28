const fs = require('fs');

const original = fs.readFileSync('c:/webmcp/extracted_user_theme.liquid', 'utf8');

// Strip user prompt tags
let content = original.replace(/^<USER_REQUEST>\s*/, '')
                      .replace(/\s*this is the original theme\.css we just have to add that pint please help me out wuth it[\s\S]*$/, '');

const injection = `
    <!-- WebMCP AI Search & Shopping Assistant -->
    <script 
      src="https://webmcp.tendrilsioservices.com/widget.js" 
      data-shop="jennifercomfortfurniture.myshopify.com" 
      data-brand="Comfort Design Furniture"
      data-theme="warm-artisan"
      data-discount="COMFORT10" 
      defer="defer">
    </script>
    <style>
      /* Suppress only the native predictive search dropdown results popup */
      #predictive-search-results,
      .predictive-search__results-groups-wrapper,
      .predictive-search__loading-state,
      predictive-search .predictive-search {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* Position the AI pill cleanly inside the search bar */
      .jmcp-ai-toggle-btn {
        right: 110px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        height: 26px !important;
        z-index: 10 !important;
        border-radius: 9999px !important;
        background: #ffffff !important;
        border: 1px solid #fed7aa !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
      }
      .jmcp-ai-quota-badge {
        background: #ffedd5 !important;
        color: #c2410c !important;
        border: 1px solid #fdba74 !important;
      }
      form[action*="/search"] input[name="q"],
      form.search input[name="q"],
      .search__input,
      .header__search input[type="search"] {
        padding-right: 230px !important;
      }
    </style>
  </head>`;

// Insert right before </head>
content = content.replace('</head>', injection);

fs.writeFileSync('c:/webmcp/theme_final_exact.liquid', content, 'utf8');
fs.writeFileSync('C:/Users/prana/.gemini/antigravity/brain/6959f981-fa8d-455b-8d41-91f978e503a1/theme_final_exact.liquid', content, 'utf8');
console.log('Saved exact merged file. Lines:', content.split('\n').length);
