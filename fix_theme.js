const fs = require('fs');

const raw = fs.readFileSync('c:/webmcp/extracted_user_theme.liquid', 'utf8');

// Strip any user request wrappers
let content = raw.replace(/^<USER_REQUEST>\s*/, '')
                 .replace(/\s*their is a fucking issue with this code[\s\S]*$/, '')
                 .replace(/\s*give me the updated code for this[\s\S]*$/, '');

// Clean any previous broken injected blocks
content = content.replace(/<!-- WebMCP AI Search[\s\S]*?<\/style>\s*/gi, '');

// Fabric snippet inside body
const fabricSnippet = `{% if template.name == 'product' %}
    {% if product.metafields.custom.choose_fabrics.value %}
      {% assign fabric_jsons = product.metafields.custom.choose_fabrics.value %}
      <div class="fabric_json">
        {% for fabric_json in fabric_jsons %}
          <div class="popup_design metafield-rich_text_field popup_{{ forloop.index }}">
            <div class="close_popup">x</div>
            {% assign richtext = fabric_json.description.value %}
            {% if richtext %}
              {{ fabric_json.description | metafield_tag }}
            {% endif %}
          </div>
        {% endfor %}
      </div>
    {% endif %}
  {% endif %}`;

content = content.replace(/<\/head>[\s\S]*?<body/i, '</head>\n\n  <body');
content = content.replace(/(<body[^>]*>)/i, `$1\n    ${fabricSnippet}\n`);

const webmcpBlock = `    <!-- WebMCP AI Search & Shopping Assistant -->
    <script 
      src="https://webmcp.tendrilsioservices.com/widget.js" 
      data-shop="jennifercomfortfurniture.myshopify.com" 
      data-brand="Comfort Design Furniture"
      data-theme="warm-artisan"
      data-discount="COMFORT10" 
      defer="defer">
    </script>
    <style>
      /* 1. Suppress ONLY the native predictive search dropdown popup (keep search bar visible!) */
      #predictive-search-results,
      .predictive-search__results-groups-wrapper,
      .predictive-search__loading-state,
      predictive-search .predictive-search,
      .predictive-search-results {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* 2. WebMCP Theme Colors & AI Search Pill Positioning */
      :root {
        --jmcp-primary: #e84c24 !important;
        --jmcp-accent: #ea580c !important;
        --jmcp-toggle-bg: #ffffff !important;
        --jmcp-toggle-border: #fed7aa !important;
        --jmcp-toggle-text: #7c2d12 !important;
      }
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

      /* 3. Header & Wishlist Icon Fixes */
      .wishlist-header-icon:hover {
        opacity: 1 !important;
        transform: none !important;
      }
      .header .header__icons a.wishlist-header-icon, 
      .header__icons a.wishlist-header-icon, 
      a.wishlist-header-icon {
        padding: 0 15px 0 0 !important;
      }
    </style>
  </head>`;

content = content.replace('</head>', webmcpBlock);
content = content.replace(/<\/html>[\s\S]*$/, '</html>\n');

fs.writeFileSync('c:/webmcp/theme_complete.liquid', content, 'utf8');
fs.writeFileSync('C:/Users/prana/.gemini/antigravity/brain/6959f981-fa8d-455b-8d41-91f978e503a1/theme.liquid', content, 'utf8');
console.log('Fixed theme liquid generated. Lines:', content.split('\n').length);
