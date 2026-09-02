import { NextResponse } from "next/server";

export async function GET() {
  const plugin = {
    schema_version: "v1",
    name_for_model: "jennifer_furniture_store",
    name_for_human: "Jennifer Furniture AI Shopping & Store Management",
    description_for_model:
      "Search 14,447 furniture items, verify exact variant stock, compare specifications, and generate direct 1-click checkout links for Jennifer Furniture Shopify store. Store owners can query sales analytics and stock health.",
    description_for_human: "AI shopping and management for Jennifer Furniture.",
    auth: {
      type: "none",
    },
    api: {
      type: "openapi",
      url: "/api/mcp/manifest",
      is_user_authenticated: false,
    },
    logo_url: "https://jenniferfurniturestaging.myshopify.com/cdn/shop/files/logo.png",
    contact_email: "support@jenniferfurniture.com",
    legal_info_url: "https://jenniferfurniturestaging.myshopify.com/pages/terms",
  };

  return NextResponse.json(plugin, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
