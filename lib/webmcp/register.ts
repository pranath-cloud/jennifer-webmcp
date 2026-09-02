import { initializeWebMCP, ModelContextRegistry } from "./polyfill";
import {
  FIND_PRODUCTS_SCHEMA,
  GET_PRODUCT_DETAILS_SCHEMA,
  CHECK_VARIANT_AVAILABILITY_SCHEMA,
  COMPARE_PRODUCTS_SCHEMA,
  CREATE_CHECKOUT_HANDOFF_SCHEMA,
  CALCULATE_ROOM_FIT_SCHEMA,
  COMPARE_PRODUCTS_DEEP_SCHEMA,
  BUILD_ROOM_BUNDLE_SCHEMA,
  AUTHENTICATE_ADMIN_SCHEMA,
  GET_STORE_REVENUE_SCHEMA,
  GET_INVENTORY_HEALTH_SCHEMA,
  ANALYZE_CUSTOMER_TRENDS_SCHEMA,
} from "./schemas";

let currentAdminSessionToken: string | null = null;

export function registerAllWebMCPTools(): ModelContextRegistry {
  const registry = initializeWebMCP();

  // ==========================================
  // 1. CUSTOMER-FACING CAPABILITIES (Public)
  // ==========================================

  // Tool 1: find_products_by_constraints
  registry.registerTool({
    name: "find_products_by_constraints",
    description:
      "Search the Jennifer Furniture catalog by category, budget (e.g. under $4000), materials, features (e.g. sleeper, power-reclining), and stock availability. Returns structured product listings with available colors and prices.",
    inputSchema: FIND_PRODUCTS_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to search products");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 2: calculate_room_fit_and_clearance (NEW)
  registry.registerTool({
    name: "calculate_room_fit_and_clearance",
    description:
      "Calculate whether a sofa or sectional will comfortably fit into a customer's living room dimensions, evaluating the 30-36 inch walking clearance standard.",
    inputSchema: CALCULATE_ROOM_FIT_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/tools/room-fit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to calculate room fit");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 3: compare_products_deep_matrix (NEW)
  registry.registerTool({
    name: "compare_products_deep_matrix",
    description:
      "Generate an aligned side-by-side specification comparison matrix for 2 to 4 products across frame construction, fabric grade, cushion density, dimensions, and warranty.",
    inputSchema: COMPARE_PRODUCTS_DEEP_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/tools/compare-deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate deep comparison matrix");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 4: build_coordinated_room_bundle (NEW)
  registry.registerTool({
    name: "build_coordinated_room_bundle",
    description:
      "Automatically pairs an anchor sofa with matching ottoman and accent chair, applying an automated 15% promotional bundle discount and creating a 1-click cart permalink.",
    inputSchema: BUILD_ROOM_BUNDLE_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/tools/bundle-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to build coordinated bundle");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 5: get_product_details
  registry.registerTool({
    name: "get_product_details",
    description:
      "Fetch full technical specifications, parsed dimensions, materials, care instructions, warranty info, and the complete variant matrix for a specific furniture product.",
    inputSchema: GET_PRODUCT_DETAILS_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/products/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch product details");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 6: check_variant_availability
  registry.registerTool({
    name: "check_variant_availability",
    description:
      "Verify whether a specific variant option combination (Color, Size, Layout) is currently in stock with live quantities.",
    inputSchema: CHECK_VARIANT_AVAILABILITY_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/products/variant-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check variant availability");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 7: create_checkout_handoff
  registry.registerTool({
    name: "create_checkout_handoff",
    description:
      "Convert selected product variants into an instant 1-click Shopify direct-to-checkout Cart Permalink URL with pre-applied promotional discount codes.",
    inputSchema: CREATE_CHECKOUT_HANDOFF_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout handoff");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // ==========================================
  // 2. STORE OWNER & STAFF CAPABILITIES (Admin)
  // ==========================================

  // Tool 8: authenticate_admin
  registry.registerTool({
    name: "authenticate_admin",
    description:
      "Authenticate as the Jennifer Furniture Store Owner / Staff to unlock executive sales analytics, inventory health, and trends.",
    inputSchema: AUTHENTICATE_ADMIN_SCHEMA,
    execute: async (args) => {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Admin authentication failed");
      }
      currentAdminSessionToken = data.sessionToken;
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 9: get_store_revenue_and_analytics
  registry.registerTool({
    name: "get_store_revenue_and_analytics",
    description:
      "Admin tool: Returns real-time sales revenue, estimated order counts, AOV, top-selling categories, and WebMCP agent conversion rates.",
    inputSchema: GET_STORE_REVENUE_SCHEMA,
    execute: async (args) => {
      const payload = {
        ...args,
        session_token: args.session_token || currentAdminSessionToken,
      };
      const res = await fetch("/api/admin/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch revenue analytics");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 10: get_inventory_health_and_restock_alerts
  registry.registerTool({
    name: "get_inventory_health_and_restock_alerts",
    description:
      "Admin tool: Detects low stock items, critical stockouts, and recommended reorder quantities across the 14,447 catalog products.",
    inputSchema: GET_INVENTORY_HEALTH_SCHEMA,
    execute: async (args) => {
      const payload = {
        ...args,
        session_token: args.session_token || currentAdminSessionToken,
      };
      const res = await fetch("/api/admin/inventory-health", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch inventory health");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  // Tool 11: analyze_customer_behavior_and_trends
  registry.registerTool({
    name: "analyze_customer_behavior_and_trends",
    description:
      "Admin tool: Analyzes popular customer search queries, conversion rates, and stock availability rates.",
    inputSchema: ANALYZE_CUSTOMER_TRENDS_SCHEMA,
    execute: async (args) => {
      const payload = {
        ...args,
        session_token: args.session_token || currentAdminSessionToken,
      };
      const res = await fetch("/api/admin/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to analyze customer trends");
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    },
  });

  return registry;
}
