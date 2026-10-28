const fs = require('fs');

let content = fs.readFileSync('c:/webmcp/clean_corrected_theme.liquid', 'utf8');

const oldWebmcpRegex = /<!-- WebMCP AI Search Script & Direct Styling -->[\s\S]*?<\/style>/;

const newWebmcpBlock = `<!-- WebMCP AI Search & Shopping Assistant -->
    <script 
      src="https://webmcp.tendrilsioservices.com/widget.js" 
      data-shop="jennifercomfortfurniture.myshopify.com" 
      data-brand="Comfort Design Furniture"
      data-theme="warm-artisan"
      data-discount="COMFORT10" 
      defer="defer">
    </script>
    <style>
      /* 1. Suppress Shopify native predictive search dropdown */
      predictive-search,
      .predictive-search,
      #predictive-search-results,
      .predictive-search-dropdown,
      [id*="predictive-search"] {
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
      #Search-In-Modal,
      .search__input,
      .header__search input[type="search"] {
        padding-right: 230px !important;
      }
      .search-modal,
      .search-modal__content,
      .search-modal__form,
      .field {
        overflow: visible !important;
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
    </style>`;

content = content.replace(oldWebmcpRegex, newWebmcpBlock);

fs.writeFileSync('c:/webmcp/theme_complete.liquid', content, 'utf8');
console.log('Successfully generated theme_complete.liquid! Lines:', content.split('\n').length);
