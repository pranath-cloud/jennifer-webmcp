import { NextRequest, NextResponse } from "next/server";
import { getAllStores, saveStore } from "@/lib/tenants/registry";
import { THEME_PRESETS } from "@/lib/tenants/presets";
import { TenantConfig } from "@/lib/types/tenant";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET() {
  try {
    const stores = getAllStores();
    return NextResponse.json({ success: true, count: stores.length, stores }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (!body.shopDomain || !body.brandName) {
      return NextResponse.json({ success: false, error: "shopDomain and brandName are required" }, { status: 400, headers: corsHeaders });
    }

    const cleanDomain = body.shopDomain.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    const storeId = body.id || cleanDomain.replace(/[^a-z0-9]/g, "-");
    const presetId = body.presetId || "luxury-minimalist";
    const selectedTheme = THEME_PRESETS[presetId] || THEME_PRESETS["luxury-minimalist"];

    const newStore: TenantConfig = {
      id: storeId,
      shopDomain: cleanDomain,
      brandName: body.brandName.trim(),
      shopifyAccessToken: body.shopifyAccessToken || undefined,
      shopifyStoreDomain: cleanDomain,
      currency: body.currency || "USD",
      discountCode: body.discountCode || "WELCOME10",
      theme: body.theme || selectedTheme,
      persona: body.persona || {
        greeting: `Welcome to ${body.brandName}. I am your personal shopping and spatial design concierge.`,
        starterChips: ["Top In-Stock Picks", "Best Sellers", "Room Dimensions Fit"],
        tone: "luxury",
        voiceGender: "male",
        voiceRate: 0.98,
      },
      customSearchSelector: body.customSearchSelector,
      customResultsGridSelector: body.customResultsGridSelector,
      allowedOrigins: ["*"],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = saveStore(newStore);
    return NextResponse.json({ success: true, store: saved }, { status: 201, headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}