import { NextResponse } from "next/server";

export async function GET() {
  const manifest = {
    schema_version: "v1",
    name_for_model: "jennifer_furniture_webmcp",
    name_for_human: "Jennifer Furniture WebMCP Platform",
    description_for_model:
      "Official WebMCP and MCP Server for Jennifer Furniture (Shopify Plus). Allows AI agents to perform zero-scraping product search, live variant stock verification, side-by-side spec comparisons, 1-click checkout handoffs, and store owner analytics.",
    description_for_human:
      "Agent-native e-commerce capability layer for Jennifer Furniture.",
    protocol_version: "2024-11-05",
    mcp_endpoint: "/api/mcp",
    sse_endpoint: "/api/mcp",
    manifest_endpoint: "/api/mcp/manifest",
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    },
    roles: {
      customer: {
        auth_required: false,
        tools: [
          "find_products_by_constraints",
          "get_product_details",
          "check_variant_availability",
          "compare_products",
          "create_checkout_handoff",
        ],
      },
      admin: {
        auth_required: true,
        auth_type: "bearer_or_tool",
        auth_tool: "authenticate_admin",
        tools: [
          "get_store_revenue_and_analytics",
          "get_inventory_health_and_restock_alerts",
          "analyze_customer_behavior_and_trends",
        ],
      },
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
