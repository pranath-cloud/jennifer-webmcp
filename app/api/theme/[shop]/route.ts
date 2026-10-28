import { NextRequest, NextResponse } from "next/server";
import { getStoreByDomain } from "@/lib/tenants/registry";
import { THEME_PRESETS } from "@/lib/tenants/presets";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Shop-Domain, *",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ shop: string }> }
) {
  try {
    const { shop } = await context.params;
    const { searchParams } = new URL(request.url);
    const presetId = searchParams.get("preset");

    const store = getStoreByDomain(shop);
    let theme = store.theme;

    if (presetId && THEME_PRESETS[presetId]) {
      theme = THEME_PRESETS[presetId];
    }

    const cssVariables = {
      "--jmcp-primary": theme.primaryColor,
      "--jmcp-primary-hover": theme.primaryHover,
      "--jmcp-accent": theme.accentColor,
      "--jmcp-bg": theme.backgroundColor,
      "--jmcp-header-bg": theme.headerBackground,
      "--jmcp-card-bg": theme.cardBackground,
      "--jmcp-card-hover": theme.cardHoverBackground,
      "--jmcp-text": theme.textPrimary,
      "--jmcp-text-muted": theme.textMuted,
      "--jmcp-border": theme.borderColor,
      "--jmcp-radius": theme.borderRadius,
      "--jmcp-btn-radius": theme.buttonRadius,
      "--jmcp-font": theme.fontFamily,
      "--jmcp-shadow": theme.shadowStyle,
    };

    return NextResponse.json({
      success: true,
      shop: store.shopDomain,
      brandName: store.brandName,
      currency: store.currency,
      discountCode: store.discountCode,
      theme,
      persona: store.persona,
      cssVariables,
    }, {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || "Failed to fetch theme",
    }, {
      status: 500,
      headers: corsHeaders,
    });
  }
}