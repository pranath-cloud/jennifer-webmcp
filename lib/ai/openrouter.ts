import { shopifyGraphQL } from "../shopify/client";
import { SEARCH_PRODUCTS_QUERY } from "../shopify/queries";
import { normalizeProductSummary } from "../shopify/normalizer";
import { generateCartPermalink } from "../shopify/permalinks";
import { ProductSummary } from "../types/shopify";

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

// Tool Declarations for OpenRouter / Gemini Function Calling
export const WEBMCP_AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "find_products_by_constraints",
      description: "Search the live Jennifer Furniture catalog for sofas, sectionals, recliners, gliding recliners, study tables, desks, coffee tables, dining sets, accent chairs, beds, and living room suites with full support for color, material, price range, and dimensions in any unit.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "Furniture category: sofa, sectional, recliner, glider, table, desk, sleeper, dining, bedroom, chair",
          },
          color: {
            type: "string",
            description: "Color preference (e.g. blue, navy, grey, charcoal, brown, cognac, white, beige, cream)",
          },
          material: {
            type: "string",
            description: "Material preference (e.g. leather, velvet, linen, hardwood, solid wood, fabric)",
          },
          max_price: {
            type: "number",
            description: "Maximum budget constraint in USD (e.g. 2000)",
          },
          min_price: {
            type: "number",
            description: "Minimum budget constraint in USD (e.g. 500)",
          },
          query: {
            type: "string",
            description: "Search query keywords (e.g. blue leather sofa, modern desk, gliding recliner)",
          },
          dimensions: {
            type: "string",
            description: "Customer dimensions in any unit (e.g. 28 cm x 42 cm, 84 x 38 in, 2m x 3m)",
          },
          limit: {
            type: "number",
            description: "Maximum number of items to return (default: 6)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_custom_shopify_graphql",
      description: "Dynamically query the live Shopify Plus database with custom search syntax, tags, color filters, vendor collections, or multi-attribute filters.",
      parameters: {
        type: "object",
        properties: {
          query_string: {
            type: "string",
            description: "Shopify search query syntax (e.g. 'status:active AND (title:blue* OR tag:blue*) AND variants.price:<=2000')",
          },
          limit: {
            type: "number",
            description: "Number of products to fetch (default: 10)",
          },
        },
        required: ["query_string"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate_room_fit_and_clearance",
      description: "Calculate spatial clearance, walkway gaps, and fit feasibility for a product in a room. Accepts room dimensions in feet, centimeters, or meters.",
      parameters: {
        type: "object",
        properties: {
          room_width_feet: {
            type: "number",
            description: "Room width in feet (e.g. 14)",
          },
          room_length_feet: {
            type: "number",
            description: "Room length in feet (e.g. 12)",
          },
          room_width_cm: {
            type: "number",
            description: "Room width in centimeters (e.g. 400)",
          },
          room_length_cm: {
            type: "number",
            description: "Room length in centimeters (e.g. 350)",
          },
          product_handle: {
            type: "string",
            description: "Shopify product handle (e.g. mason-leather-89-sofa-1, monika-sleeper-sofa, kirby-chaise)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_room_floorplan",
      description: "Generate a top-down architectural blueprint floorplan layout for a room (in feet, cm, or meters) and sofa configuration.",
      parameters: {
        type: "object",
        properties: {
          room_width_feet: {
            type: "number",
            description: "Room width in feet (e.g. 15)",
          },
          room_length_feet: {
            type: "number",
            description: "Room length in feet (e.g. 12)",
          },
          room_width_cm: {
            type: "number",
            description: "Room width in centimeters",
          },
          room_length_cm: {
            type: "number",
            description: "Room length in centimeters",
          },
          product_title: {
            type: "string",
            description: "Product name or title (e.g. Mason Leather Sofa, Luonto Monika Sleeper)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_fabric_and_lighting",
      description: "Harmonize upholstery fabrics, leather finishes, and lighting color temperatures (Kelvin) based on wall paint color and natural window exposure.",
      parameters: {
        type: "object",
        properties: {
          wall_color: {
            type: "string",
            description: "Wall paint color or tone (e.g. warm beige, navy blue, charcoal, crisp white, sage green)",
          },
          window_exposure: {
            type: "string",
            description: "Natural light direction: South-Facing, North-Facing, East-Facing, West-Facing, or Low Ambient",
          },
        },
        required: ["wall_color"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "build_coordinated_room_bundle",
      description: "Build an aesthetically coordinated 3-piece living room or study bundle (e.g., Desk + Gliding Recliner + Lamp or Sofa + Chair + Table) with an automated 15% discount.",
      parameters: {
        type: "object",
        properties: {
          base_product_handle: {
            type: "string",
            description: "Anchor product handle (e.g. monika-sleeper-sofa, mason-leather-89-sofa-1, kirby-chaise)",
          },
          budget_cap: {
            type: "number",
            description: "Target bundle budget cap in USD (e.g. 3500)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_products_deep_matrix",
      description: "Generate an aligned side-by-side spec comparison matrix for 2 or 3 products.",
      parameters: {
        type: "object",
        properties: {
          product_handles: {
            type: "array",
            items: { type: "string" },
            description: "Array of 2-3 product handles to compare (e.g. [\"kirby-chaise\", \"mason-leather-89-sofa-1\"])",
          },
        },
        required: ["product_handles"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_checkout_handoff",
      description: "Generate a 1-click Shopify checkout permalink with WEBMCP10 discount code applied.",
      parameters: {
        type: "object",
        properties: {
          variant_id: {
            type: "string",
            description: "Shopify Variant ID",
          },
          quantity: {
            type: "number",
            description: "Quantity (default 1)",
          },
        },
        required: ["variant_id"],
      },
    },
  },
];

const SYSTEM_PROMPT = `You are the official Jennifer Furniture AI Assistant, delivering an elite, 7-star luxury concierge experience.
You have direct, unrestricted access to the live Shopify Plus database, spatial clearance calculators, architectural floorplan generators, and bundle builders via WebMCP tools.

CRITICAL OPERATIONAL RULES:
1. UNIVERSAL UNIT CONVERSION & ZERO-FRICTION ASSISTANCE:
   - When a customer provides dimensions in centimeters (cm), millimeters (mm), meters (m), or inches (in), ALWAYS convert them automatically (1 ft = 30.48 cm, 1 in = 2.54 cm, 1 m = 3.28 ft).
   - NEVER ask the customer to convert units! Calculate the converted values and pass them directly to the appropriate tools (find_products_by_constraints, calculate_room_fit_and_clearance, generate_room_floorplan).

2. COLOR, MATERIAL & BUDGET FILTERING:
   - You CAN and MUST filter by color (e.g., blue, navy, grey, charcoal, cognac, brown, beige, emerald), material (e.g., leather, velvet, linen, solid hardwood), and budget.
   - NEVER say "I cannot filter by color" or "I cannot search by material". Pass color, material, query, and budget into find_products_by_constraints or execute_custom_shopify_graphql to retrieve live matching products.
   - If the user provides multiple currency mentions (e.g. "under 4000 rupees $2000"), prioritize the USD constraint ($2000) or convert (1 USD ≈ 87 INR) and search immediately.

3. DYNAMIC DATABASE SEARCH:
   - If standard filters do not match, use execute_custom_shopify_graphql to search the live Shopify catalog using dynamic queries (e.g. 'status:active AND (title:blue* OR tag:blue*) AND variants.price:<=2000').

4. TOOL INVOCATION & SPATIAL FIT:
   - When a user asks if a sofa/furniture fits in a room or mentions room dimensions (e.g. "15x12", "14x12", "400x350 cm", "fit in my room"), ALWAYS invoke calculate_room_fit_and_clearance.
   - When a user asks for furniture, sofas, chairs, tables, or bundles, ALWAYS invoke find_products_by_constraints or build_coordinated_room_bundle.

5. DIRECT, REFINED & LUXURY RESPONSE:
   - Keep answers concise, sophisticated, and formatting-clean (bold headings, bullet points, clean prices).
   - Always present verified in-stock options with instant cart actions.`;

function sanitizeAndTruncateHistory(messages: Array<{ role: string; content: string }>, maxTurns = 10) {
  const recent = messages.slice(-maxTurns);
  return recent.map((m) => {
    let content = m.content || "";
    if (content.length > 2000) {
      content = content.substring(0, 2000) + "... [truncated]";
    }
    return {
      role: m.role,
      content,
    };
  });
}

export async function runOpenRouterAgent(
  messages: Array<{ role: string; content: string }>,
  cachedContextPrompt?: string
) {
  const trimmedHistory = sanitizeAndTruncateHistory(messages, 10);
  
  let fullSystemPrompt = SYSTEM_PROMPT;
  if (cachedContextPrompt && cachedContextPrompt.trim().length > 0) {
    fullSystemPrompt += `\n\n${cachedContextPrompt}`;
  }

  const formattedMessages = [
    { role: "system", content: fullSystemPrompt },
    ...trimmedHistory,
  ];

  if (!OPENROUTER_KEY) {
    throw new Error("OPENROUTER_API_KEY env var is not set");
  }

  const payload = {
    model: OPENROUTER_MODEL,
    messages: formattedMessages,
    tools: WEBMCP_AI_TOOLS,
    tool_choice: "auto",
    temperature: 0.3,
    max_tokens: 500,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://webmcp.tendrilsioservices.com",
      "X-Title": "Jennifer Furniture WebMCP",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("OpenRouter Error:", res.status, errText);
    throw new Error(`OpenRouter API failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const message = choice?.message;

  return {
    raw: data,
    message: message,
    toolCalls: message?.tool_calls || [],
    text: message?.content || "",
  };
}
