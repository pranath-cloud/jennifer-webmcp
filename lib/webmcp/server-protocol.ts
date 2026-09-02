import {
  FIND_PRODUCTS_SCHEMA,
  GET_PRODUCT_DETAILS_SCHEMA,
  CHECK_VARIANT_AVAILABILITY_SCHEMA,
  COMPARE_PRODUCTS_SCHEMA,
  CREATE_CHECKOUT_HANDOFF_SCHEMA,
  AUTHENTICATE_ADMIN_SCHEMA,
  GET_STORE_REVENUE_SCHEMA,
  GET_INVENTORY_HEALTH_SCHEMA,
  ANALYZE_CUSTOMER_TRENDS_SCHEMA,
} from "./schemas";
import { validateAdminCredentials, generateAdminSessionToken } from "@/lib/auth/admin";
import { getStoreRevenueMetrics, getInventoryHealthAlerts, getCustomerSearchTrends } from "@/lib/shopify/analytics";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, any>;
  role?: "customer" | "admin";
}

export const ALL_MCP_TOOLS: MCPToolDefinition[] = [
  // Customer Tools
  {
    name: "find_products_by_constraints",
    description:
      "Search the Jennifer Furniture catalog by category, budget (e.g. under $4000), material, features, and stock availability.",
    inputSchema: FIND_PRODUCTS_SCHEMA,
    role: "customer",
  },
  {
    name: "get_product_details",
    description:
      "Fetch full technical specifications, parsed dimensions, materials, care instructions, and variant matrix for a product.",
    inputSchema: GET_PRODUCT_DETAILS_SCHEMA,
    role: "customer",
  },
  {
    name: "check_variant_availability",
    description:
      "Verify whether a specific variant option combination (Color, Size, Layout) is currently in stock with live quantities.",
    inputSchema: CHECK_VARIANT_AVAILABILITY_SCHEMA,
    role: "customer",
  },
  {
    name: "compare_products",
    description:
      "Generate an aligned side-by-side specification comparison matrix for 2 to 4 products across dimensions, materials, and price.",
    inputSchema: COMPARE_PRODUCTS_SCHEMA,
    role: "customer",
  },
  {
    name: "create_checkout_handoff",
    description:
      "Convert selected product variants into an instant 1-click Shopify direct-to-checkout Cart Permalink URL with discounts.",
    inputSchema: CREATE_CHECKOUT_HANDOFF_SCHEMA,
    role: "customer",
  },

  // Store Owner / Admin Tools
  {
    name: "authenticate_admin",
    description:
      "Authenticate as the Jennifer Furniture Store Owner / Staff to unlock executive sales analytics, inventory health, and trends.",
    inputSchema: AUTHENTICATE_ADMIN_SCHEMA,
    role: "admin",
  },
  {
    name: "get_store_revenue_and_analytics",
    description:
      "Admin tool: Returns real-time sales revenue, estimated order counts, AOV, top-selling categories, and WebMCP agent conversion rates.",
    inputSchema: GET_STORE_REVENUE_SCHEMA,
    role: "admin",
  },
  {
    name: "get_inventory_health_and_restock_alerts",
    description:
      "Admin tool: Detects low stock items, critical stockouts, and recommended reorder quantities across the 14,447 catalog products.",
    inputSchema: GET_INVENTORY_HEALTH_SCHEMA,
    role: "admin",
  },
  {
    name: "analyze_customer_behavior_and_trends",
    description:
      "Admin tool: Analyzes popular customer search queries, conversion rates, and stock availability rates.",
    inputSchema: ANALYZE_CUSTOMER_TRENDS_SCHEMA,
    role: "admin",
  },
];

export async function handleMCPMessage(message: any, baseUrl: string): Promise<any> {
  const { jsonrpc = "2.0", id, method, params = {} } = message;

  // 1. initialize
  if (method === "initialize") {
    return {
      jsonrpc,
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: {
          tools: { listChanged: true },
          resources: {},
          prompts: {},
        },
        serverInfo: {
          name: "jennifer-furniture-webmcp",
          version: "1.0.0",
        },
      },
    };
  }

  // 2. tools/list
  if (method === "tools/list") {
    return {
      jsonrpc,
      id,
      result: {
        tools: ALL_MCP_TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      },
    };
  }

  // 3. tools/call
  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;

    try {
      if (name === "authenticate_admin") {
        const isValid = validateAdminCredentials(args.password);
        if (!isValid) {
          return {
            jsonrpc,
            id,
            error: { code: -32001, message: "Invalid admin password. Access denied." },
          };
        }
        const token = generateAdminSessionToken();
        return {
          jsonrpc,
          id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  message: "Admin authenticated! Executive tools unlocked.",
                  sessionToken: token,
                }),
              },
            ],
          },
        };
      }

      if (name === "get_store_revenue_and_analytics") {
        const metrics = await getStoreRevenueMetrics(args.timeframe, args.category);
        return {
          jsonrpc,
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(metrics, null, 2) }],
          },
        };
      }

      if (name === "get_inventory_health_and_restock_alerts") {
        const alerts = await getInventoryHealthAlerts(args.threshold);
        return {
          jsonrpc,
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(alerts, null, 2) }],
          },
        };
      }

      if (name === "analyze_customer_behavior_and_trends") {
        const trends = getCustomerSearchTrends();
        return {
          jsonrpc,
          id,
          result: {
            content: [{ type: "text", text: JSON.stringify(trends, null, 2) }],
          },
        };
      }

      // Delegate customer tools to internal API routes
      let apiPath = "";
      if (name === "find_products_by_constraints") apiPath = "/api/products/search";
      else if (name === "get_product_details") apiPath = "/api/products/details";
      else if (name === "check_variant_availability") apiPath = "/api/products/variant-check";
      else if (name === "compare_products") apiPath = "/api/products/compare";
      else if (name === "create_checkout_handoff") apiPath = "/api/cart/checkout";

      if (!apiPath) {
        return {
          jsonrpc,
          id,
          error: { code: -32601, message: `Tool not found: ${name}` },
        };
      }

      const res = await fetch(`${baseUrl}${apiPath}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args),
      });
      const data = await res.json();

      return {
        jsonrpc,
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(data, null, 2),
            },
          ],
        },
      };
    } catch (err: any) {
      return {
        jsonrpc,
        id,
        error: { code: -32603, message: err.message || "Internal error executing tool" },
      };
    }
  }

  // Unknown method
  return {
    jsonrpc,
    id,
    error: { code: -32601, message: `Method not supported: ${method}` },
  };
}
