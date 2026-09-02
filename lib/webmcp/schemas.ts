// Customer-Facing Capabilities
export const FIND_PRODUCTS_SCHEMA = {
  type: "object" as const,
  properties: {
    category: {
      type: "string",
      description: "Furniture category to search (e.g., 'sectional', 'sofa', 'loveseat', 'dining table', 'bed', 'recliner', 'accent chair')",
    },
    max_price: {
      type: "number",
      description: "Maximum budget in USD (e.g., 4000)",
    },
    min_price: {
      type: "number",
      description: "Minimum price in USD (e.g., 500)",
    },
    material: {
      type: "string",
      description: "Material or upholstery type (e.g., 'leather', 'fabric', 'velvet', 'microfiber', 'wood')",
    },
    features: {
      type: "array",
      items: { type: "string" },
      description: "List of desired features (e.g., ['sleeper', 'power-reclining', 'storage', 'chaise'])",
    },
    in_stock_only: {
      type: "boolean",
      description: "Whether to return only in-stock items with inventory > 0 (defaults to true)",
      default: true,
    },
    query: {
      type: "string",
      description: "Conversational natural query (e.g. 'sofa under $4000 for family with pets')",
    },
    limit: {
      type: "integer",
      description: "Maximum number of results to return (1-25, defaults to 10)",
      default: 10,
    },
  },
};

export const GET_PRODUCT_DETAILS_SCHEMA = {
  type: "object" as const,
  properties: {
    product_id: {
      type: "string",
      description: "The Shopify Product ID (e.g., 'gid://shopify/Product/5826780551' or numeric ID)",
    },
    handle: {
      type: "string",
      description: "The Shopify product URL handle (e.g., 'tess-3-piece-sleeper-sectional')",
    },
  },
};

export const CHECK_VARIANT_AVAILABILITY_SCHEMA = {
  type: "object" as const,
  properties: {
    product_id: {
      type: "string",
      description: "The Shopify Product ID to check variants for",
    },
    selected_options: {
      type: "object",
      description: "Key-value dictionary of desired variant options (e.g., { 'Color': 'Gray', 'Mattress': 'Memory Foam', 'Size': 'Queen' })",
      additionalProperties: { type: "string" },
    },
  },
  required: ["product_id"],
};

export const COMPARE_PRODUCTS_SCHEMA = {
  type: "object" as const,
  properties: {
    product_ids: {
      type: "array",
      items: { type: "string" },
      description: "Array of 2 to 4 Shopify Product IDs to compare side-by-side",
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ["product_ids"],
};

export const CREATE_CHECKOUT_HANDOFF_SCHEMA = {
  type: "object" as const,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          variant_id: {
            type: "string",
            description: "The Shopify ProductVariant GID or numeric ID",
          },
          quantity: {
            type: "integer",
            description: "Quantity to purchase (defaults to 1)",
            default: 1,
          },
          title: {
            type: "string",
            description: "Item title for receipt/cart summary",
          },
          price: {
            type: "number",
            description: "Item unit price",
          },
        },
        required: ["variant_id"],
      },
      description: "Array of line items to add to the checkout cart",
    },
    discount_code: {
      type: "string",
      description: "Optional promotional code to apply at checkout (e.g., 'WEBMCP10')",
    },
    note: {
      type: "string",
      description: "Optional delivery instructions to attach to the order",
    },
  },
  required: ["items"],
};

// 1. Room Fit & Walking Clearance Calculator Schema
export const CALCULATE_ROOM_FIT_SCHEMA = {
  type: "object" as const,
  properties: {
    room_width_feet: {
      type: "number",
      description: "Width of the living room space in feet (e.g. 12)",
    },
    room_length_feet: {
      type: "number",
      description: "Length of the living room space in feet (e.g. 10)",
    },
    product_handle: {
      type: "string",
      description: "Product handle (e.g. 'monika-sleeper-sofa' or 'mason-leather-89-sofa-1')",
    },
    include_coffee_table: {
      type: "boolean",
      description: "Whether a standard 36x24 inch coffee table is placed in front of the sofa",
      default: true,
    },
  },
  required: ["room_width_feet", "room_length_feet", "product_handle"],
};

// 2. Deep Spec Comparison Matrix Schema
export const COMPARE_PRODUCTS_DEEP_SCHEMA = {
  type: "object" as const,
  properties: {
    product_handles: {
      type: "array",
      items: { type: "string" },
      description: "Array of 2 to 4 product handles to compare (e.g. ['kirby-chaise', 'mason-leather-89-sofa-1'])",
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ["product_handles"],
};

// 3. Smart Room Bundle Builder Schema
export const BUILD_ROOM_BUNDLE_SCHEMA = {
  type: "object" as const,
  properties: {
    base_product_handle: {
      type: "string",
      description: "Anchor sofa or sectional handle (e.g. 'monika-sleeper-sofa')",
    },
    budget_cap: {
      type: "number",
      description: "Maximum budget cap for the entire 3-piece room bundle in USD (e.g. 3500)",
    },
  },
  required: ["base_product_handle"],
};

// 4. Multimodal AI Room Designer & Photo Staging Schema
export const ANALYZE_ROOM_PHOTO_SCHEMA = {
  type: "object" as const,
  properties: {
    image_data: {
      type: "string",
      description: "Base64 encoded image string or publicly accessible URL of the customer's room or living hall photo.",
    },
    budget_cap: {
      type: "number",
      description: "Maximum budget in USD for the sofa/furniture piece (e.g., 2500). Defaults to 2500.",
      default: 2500,
    },
    material_preference: {
      type: "string",
      enum: ["any", "leather", "fabric", "velvet", "performance"],
      description: "Desired upholstery material. If omitted or 'any', the AI will recommend the ideal material based on room lighting and flooring.",
    },
    comfort_type: {
      type: "string",
      description: "Desired comfort profile (e.g. 'deep-seating', 'plush-cushions', 'firm-lumbar', 'sofa-bed', 'pillows').",
    },
    has_sleeper_need: {
      type: "boolean",
      description: "Whether the customer requires a sleeper / sofa bed function for overnight guests.",
    },
    room_dimensions: {
      type: "object",
      properties: {
        width_feet: { type: "number" },
        length_feet: { type: "number" },
      },
      description: "Optional estimated room dimensions in feet (e.g. 12x10 or 15x12).",
    },
  },
};

// 5. First-Class Product Visual Asset & Geometry Bridge Schema
export const GET_PRODUCT_VISUAL_ASSET_SCHEMA = {
  type: "object" as const,
  properties: {
    handle: {
      type: "string",
      description: "The Shopify product URL handle (e.g., 'stacey-sofa' or 'monika-sleeper-sofa').",
    },
    product_id: {
      type: "string",
      description: "The Shopify Product ID (e.g., '5408176341160' or 'gid://shopify/Product/5408176341160').",
    },
  },
};

// Admin & Staff Capabilities
export const AUTHENTICATE_ADMIN_SCHEMA = {
  type: "object" as const,
  properties: {
    password: {
      type: "string",
      description: "Store Owner / Staff Admin Password or Key",
    },
  },
  required: ["password"],
};

export const GET_STORE_REVENUE_SCHEMA = {
  type: "object" as const,
  properties: {
    timeframe: {
      type: "string",
      enum: ["today", "last_7_days", "this_month"],
      description: "Timeframe for revenue and order breakdown (defaults to 'last_7_days')",
      default: "last_7_days",
    },
    category: {
      type: "string",
      description: "Optional category filter (e.g., 'Sectional', 'Dining')",
    },
    session_token: {
      type: "string",
      description: "Admin session token returned by authenticate_admin",
    },
  },
};

export const GET_INVENTORY_HEALTH_SCHEMA = {
  type: "object" as const,
  properties: {
    threshold: {
      type: "number",
      description: "Stock count threshold to flag as low stock (defaults to 3)",
      default: 3,
    },
    session_token: {
      type: "string",
      description: "Admin session token returned by authenticate_admin",
    },
  },
};

export const ANALYZE_CUSTOMER_TRENDS_SCHEMA = {
  type: "object" as const,
  properties: {
    session_token: {
      type: "string",
      description: "Admin session token returned by authenticate_admin",
    },
  },
};
