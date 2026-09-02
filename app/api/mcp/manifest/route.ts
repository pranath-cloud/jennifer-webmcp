import { NextRequest, NextResponse } from "next/server";
import {
  FIND_PRODUCTS_SCHEMA,
  GET_PRODUCT_DETAILS_SCHEMA,
  CHECK_VARIANT_AVAILABILITY_SCHEMA,
  COMPARE_PRODUCTS_SCHEMA,
  CREATE_CHECKOUT_HANDOFF_SCHEMA,
  CALCULATE_ROOM_FIT_SCHEMA,
  COMPARE_PRODUCTS_DEEP_SCHEMA,
  BUILD_ROOM_BUNDLE_SCHEMA,
  ANALYZE_ROOM_PHOTO_SCHEMA,
  GET_STORE_REVENUE_SCHEMA,
  GET_INVENTORY_HEALTH_SCHEMA,
  ANALYZE_CUSTOMER_TRENDS_SCHEMA,
} from "@/lib/webmcp/schemas";

export async function GET(request: NextRequest) {
  const host = request.headers.get("host") || "illinois-practice-innovative-enterprises.trycloudflare.com";
  const proto = request.headers.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  const openApiSpec = {
    openapi: "3.1.0",
    info: {
      title: "Jennifer Furniture WebMCP Platform",
      description:
        "Agent-native capability layer for Jennifer Furniture (Shopify Plus). Exposes 14,447 catalog products, live variant stock verification, living room fit & clearance calculations, deep spec comparisons, 3-piece coordinated room bundles, and 1-click Shopify direct checkout permalinks.",
      version: "1.2.0",
    },
    servers: [
      {
        url: baseUrl,
        description: "Production WebMCP Server",
      },
    ],
    paths: {
      "/api/products/search": {
        post: {
          operationId: "find_products_by_constraints",
          summary: "Search live in-stock catalog by constraints and natural query",
          description:
            "Search Jennifer Furniture's 14,447 catalog items for in-stock products matching category, budget, material, or natural language query.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: FIND_PRODUCTS_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Matching products found",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      count: { type: "integer" },
                      products: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            id: { type: "string" },
                            title: { type: "string" },
                            handle: { type: "string" },
                            minPrice: { type: "number" },
                            inStock: { type: "boolean" },
                            matchedVariantId: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/tools/room-fit": {
        post: {
          operationId: "calculate_room_fit_and_clearance",
          summary: "Calculate living room fit & perimeter walking clearance",
          description:
            "Evaluates whether a sofa or sectional fits a customer's specific room dimensions, checking for the 30-36 inch walking clearance standard.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CALCULATE_ROOM_FIT_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Room fit verdict and clearance analysis returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          clearanceAnalysis: {
                            type: "object",
                            properties: {
                              verdict: { type: "string" },
                              fitScore: { type: "number" },
                              frontWalkwayClearanceInches: { type: "number" },
                              expertFeedback: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/tools/compare-deep": {
        post: {
          operationId: "compare_products_deep_matrix",
          summary: "Deep side-by-side spec comparison with materials & warranty",
          description:
            "Compares 2 to 4 products across frame construction, fabric grade, cushion density, dimensions, warranty, and value.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: COMPARE_PRODUCTS_DEEP_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Deep comparison matrix returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          valueWinnerTitle: { type: "string" },
                          expertRecommendation: { type: "string" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/tools/bundle-builder": {
        post: {
          operationId: "build_coordinated_room_bundle",
          summary: "Build 3-piece living room suite with 15% discount",
          description:
            "Pairs a sofa with matching ottoman and accent chair, applying a 15% promotional bundle discount and generating a 1-click checkout permalink.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: BUILD_ROOM_BUNDLE_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Coordinated bundle generated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: {
                        type: "object",
                        properties: {
                          bundleName: { type: "string" },
                          pricing: {
                            type: "object",
                            properties: {
                              bundlePrice: { type: "string" },
                              instantSavings: { type: "string" },
                            },
                          },
                          checkout: {
                            type: "object",
                            properties: {
                              oneClickBundleCheckoutUrl: { type: "string" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/tools/room-designer": {
        post: {
          operationId: "analyze_room_photo_and_recommend",
          summary: "Multimodal AI Room Designer & Photo Staging Recommendation",
          description:
            "Analyzes an uploaded photo of a living room or hall, evaluates architectural structure, color palette, and cushion comfort needs, calculates spatial clearance, and recommends in-stock sofas under budget with 1-click cart permalinks.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: ANALYZE_ROOM_PHOTO_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Room analysis, matched in-stock sofa recommendations, and bundle summary returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      data: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/products/details": {
        post: {
          operationId: "get_product_details",
          summary: "Get deep specifications and variant matrix",
          description:
            "Fetch parsed dimensions, materials, care instructions, warranty details, and complete variant matrix for a product.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: GET_PRODUCT_DETAILS_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Product details returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/products/variant-check": {
        post: {
          operationId: "check_variant_availability",
          summary: "Check variant option combination and live stock",
          description:
            "Verify live stock counts and variant IDs for specific color, size, and layout options.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CHECK_VARIANT_AVAILABILITY_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Variant availability returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/cart/checkout": {
        post: {
          operationId: "create_checkout_handoff",
          summary: "Generate 1-click Shopify direct checkout link",
          description:
            "Generate an official direct Shopify Cart Permalink URL preloading selected items and promotional discount codes.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: CREATE_CHECKOUT_HANDOFF_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Checkout URL generated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/revenue": {
        post: {
          operationId: "get_store_revenue_and_analytics",
          summary: "Executive store sales revenue report",
          description:
            "Store Owner Tool: Real-time sales revenue, average order value, category breakdowns, and WebMCP agent conversion rates.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: GET_STORE_REVENUE_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Revenue analytics returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/admin/inventory-health": {
        post: {
          operationId: "get_inventory_health_and_restock_alerts",
          summary: "Scan catalog for stockout risks and reorder counts",
          description:
            "Store Owner Tool: Scans 14,447 products for low stock levels and recommended reorder quantities.",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: GET_INVENTORY_HEALTH_SCHEMA,
              },
            },
          },
          responses: {
            "200": {
              description: "Inventory health alerts returned",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
