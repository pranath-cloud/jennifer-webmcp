import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { getCustomerSearchTrends } from "@/lib/shopify/analytics";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { session_token } = body;

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

    const trends = getCustomerSearchTrends();

    return NextResponse.json({
      success: true,
      trends,
      summary: "High demand observed for sleeper sectionals under $2000 and leather recliners.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
