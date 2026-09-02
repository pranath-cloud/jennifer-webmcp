import { NextRequest, NextResponse } from "next/server";
import { handleMCPMessage, ALL_MCP_TOOLS } from "@/lib/webmcp/server-protocol";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const host = request.headers.get("host") || "localhost:3000";
    const proto = request.headers.get("x-forwarded-proto") || "http";
    const baseUrl = `${proto}://${host}`;

    const response = await handleMCPMessage(body, baseUrl);
    return NextResponse.json(response, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32700, message: "Parse error / Invalid JSON" },
      },
      { status: 400 }
    );
  }
}

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") || "http";

  return NextResponse.json(
    {
      status: "online",
      server: "Jennifer Furniture WebMCP Server",
      protocol: "Model Context Protocol (JSON-RPC 2.0)",
      mcp_endpoint: `${proto}://${host}/api/mcp`,
      available_tools_count: ALL_MCP_TOOLS.length,
      tools: ALL_MCP_TOOLS.map((t) => ({
        name: t.name,
        description: t.description,
        role: t.role,
      })),
      usage: "POST JSON-RPC 2.0 requests to this endpoint with method 'tools/list' or 'tools/call'",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Key",
    },
  });
}
