import { NextRequest, NextResponse } from "next/server";
import { recordTelemetryEvent } from "@/lib/analytics/collector";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Client-Session, X-Shop-Domain, *",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const shopDomain = body.shopDomain || request.headers.get("x-shop-domain") || "jenniferfurniturestaging.myshopify.com";

    const event = await recordTelemetryEvent({
      shopDomain,
      eventType: body.eventType || "search_query",
      queryText: body.queryText,
      interpretedQuery: body.interpretedQuery,
      extractedConstraints: body.extractedConstraints,
      resultCount: body.resultCount,
      zeroResult: body.zeroResult || (typeof body.resultCount === "number" && body.resultCount === 0),
      clickedProductId: body.clickedProductId,
      clickedProductTitle: body.clickedProductTitle,
      sessionId: body.sessionId || request.headers.get("x-client-session") || undefined,
    });

    return NextResponse.json({ success: true, eventId: event.id }, { status: 200, headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}