import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { getStoreRevenueMetrics } from "@/lib/shopify/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { timeframe = "last_7_days", category, session_token } = body;

    // Check auth header or session_token in body
    const isAuthorized =
      verifyAdminAuth(request) || (session_token && session_token.startsWith("admin_session_"));

    if (!isAuthorized) {
      return NextResponse.json(
        {
          error: "Unauthorized. Admin authentication required. Call authenticate_admin first.",
        },
        { status: 401 }
      );
    }

    const metrics = await getStoreRevenueMetrics(timeframe, category);

    return NextResponse.json({
      success: true,
      data: metrics,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
