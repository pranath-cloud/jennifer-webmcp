const fs = require('fs');

let content = fs.readFileSync('c:/webmcp/extracted_user_theme.liquid', 'utf8');

// Strip out user request wrapper if any
content = content.replace(/^<USER_REQUEST>\s*/, '');
content = content.replace(/\s*give me the updated code for this\s*<\/USER_REQUEST>[\s\S]*$/, '');

const snippet = `
    <!-- WebMCP AI Search & Shopping Assistant -->
    <script
      src="https://webmcp.tendrilsioservices.com/widget.js"
      data-shop="jennifercomfortfurniture.myshopify.com"
      data-brand="Comfort Design Furniture"
      data-discount="COMFORT10"
      data-theme="warm-artisan"
      defer="defer">
    </script>

    <style>
      /* WebMCP AI Search: Suppress Shopify native predictive search dropdown & eliminate collision */
      predictive-search,
      .predictive-search,
      #predictive-search-results,
      .predictive-search-dropdown,
      [id*="predictive-search"] {
        display: none !important;
        visibility: hidden !important;
        pointer-events: none !important;
      }

      /* Comfort Furniture Search Bar: Position AI pill nicely with zero overlap */
      .jmcp-ai-toggle-btn {
        right: 110px !important;
        top: 50% !important;
        transform: translateY(-50%) !important;
        z-index: 10 !important;
      }

      .header__search input[type="search"],
      .search-modal__form input[type="search"],
      form.search input[type="search"] {
        padding-right: 230px !important;
      }
    </style>
`;

content = content.replace('{{ content_for_header }}', '{{ content_for_header }}\n' + snippet);

fs.writeFileSync('c:/webmcp/final_theme.liquid', content, 'utf8');
console.log('Successfully generated final_theme.liquid! Total lines:', content.split('\n').length);
