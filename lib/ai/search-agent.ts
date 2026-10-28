const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-2.5-flash";

/** Canonical category synonyms — applied to Gemini/regex output so
 *  "couch" always becomes "sofa" downstream regardless of extractor. */
const CATEGORY_SYNONYMS: Record<string, string> = {
  couch: "sofa", couches: "sofa", sofas: "sofa",
  sectionals: "sectional", recliners: "recliner",
  loveseats: "loveseat", chairs: "chair", beds: "bed",
  tables: "dining table", desks: "desk", ottomans: "ottoman",
  dressers: "dresser", nightstands: "nightstand", rugs: "rug", lamps: "lamp",
};
export function normalizeCategory(cat?: string): string {
  const c = (cat || "").toLowerCase().trim();
  return CATEGORY_SYNONYMS[c] || c;
}

export interface AISearchConstraints {
  is_furniture_search?: boolean;
  category?: string;
  features?: string[];
  color?: string;
  material?: string;
  brand?: string;
  max_price?: number;
  min_price?: number;
  search_keywords?: string;
  shopify_query?: string;
  interpreted_query?: string;
}

const SEARCH_TOOL_DEFINITION = {
  type: "function" as const,
  function: {
    name: "find_products_by_constraints",
    description: "Understand user natural language intent, extract structured furniture search constraints, functional features, and target keywords for catalog retrieval.",
    parameters: {
      type: "object",
      properties: {
        is_furniture_search: {
          type: "boolean",
          description: "Set to true if user is searching for furniture products, decor, materials, colors, room pieces, or attributes. Set to false for greetings, casual chat, filler, or gibberish with no furniture intent.",
        },
        category: {
          type: "string",
          description: "Primary furniture category in singular form (e.g. 'sectional', 'sofa', 'recliner', 'dining table', 'coffee table', 'desk', 'bed', 'accent chair', 'dresser', 'nightstand', 'lamp', 'rug', 'ottoman', 'loveseat')",
        },
        features: {
          type: "array",
          items: { type: "string" },
          description: "Specific functional attributes, mechanisms, or sub-types (e.g. ['sleeper'], ['power reclining'], ['storage'], ['modular'], ['chaise'], ['swivel'], ['glider'], ['lift top'])",
        },
        color: {
          type: "string",
          description: "Normalized color name if requested (e.g. 'blue', 'green', 'brown', 'black', 'white', 'gray', 'tan', 'cognac', 'beige', 'cream', 'red', 'yellow')",
        },
        material: {
          type: "string",
          description: "Material or upholstery if requested (e.g. 'leather', 'velvet', 'fabric', 'linen', 'wood', 'marble', 'metal', 'chenille')",
        },
        brand: {
          type: "string",
          description: "Furniture brand, vendor, or manufacturer if requested (e.g. 'bernhardt', 'flexsteel', 'fjords', 'ashley', 'klaussner', 'la-z-boy', 'natuzzi', 'parker living'). Only set when the user names a brand.",
        },
        max_price: {
          type: "number",
          description: "Maximum price in USD if specified by user (e.g. 1500)",
        },
        min_price: {
          type: "number",
          description: "Minimum price in USD if specified by user (e.g. 500)",
        },
        search_keywords: {
          type: "string",
          description: "Clean target product noun keywords for catalog matching (e.g. 'blue leather sofa', 'sleeper sectional', 'dining table', 'brown recliner')",
        },
        shopify_query: {
          type: "string",
          description: "Compiled clean Shopify GraphQL query (e.g. 'status:active AND (title:*sofa* OR tag:*sofa* OR product_type:*sofa*)')",
        },
      },
      required: ["is_furniture_search"],
    },
  },
};

const intentCache = new Map<string, { data: AISearchConstraints; ts: number }>();

export async function parseSearchWithAITool(userQuery: string, isPredictive: boolean = false): Promise<AISearchConstraints> {
  const trimmed = (userQuery || "").trim();
  if (!trimmed) {
    return { is_furniture_search: false, search_keywords: "", interpreted_query: "" };
  }

  const cacheKey = trimmed.toLowerCase();
  const cached = intentCache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < 1000 * 60 * 60) { // 1 hour cache
    return cached.data;
  }

  // Predictive Fast-Path: On live keystrokes, return high-speed regex intent extraction in <1ms
  if (isPredictive) {
    const fastExtracted = fallbackExtraction(trimmed);
    if (fastExtracted.category || fastExtracted.color || fastExtracted.material || fastExtracted.brand || (fastExtracted.features && fastExtracted.features.length > 0)) {
      intentCache.set(cacheKey, { data: fastExtracted, ts: Date.now() });
      return fastExtracted;
    }
  }

  if (!OPENROUTER_KEY) {
    console.warn("OPENROUTER_API_KEY not set — using regex extraction only");
    const fallback = fallbackExtraction(trimmed);
    intentCache.set(cacheKey, { data: fallback, ts: Date.now() });
    return fallback;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const payload = {
        model: OPENROUTER_MODEL,
        messages: [
          {
            role: "system",
            content: "You are the Furniture & E-Commerce AI Search Classifier for a premier furniture catalog. Your job is to understand natural conversational English queries from shoppers. Understand typos (e.g. 'secyional' -> 'sectional', 'lether' -> 'leather', 'sleper' -> 'sleeper'), understand complex requests (e.g. 'Check blue sofas for me which are having leather' -> category: sofa, color: blue, material: leather), identify furniture brands/vendors (e.g. 'bernhardt recliner' -> brand: bernhardt; 'show me fjords' -> brand: fjords; 'flexsteel sofa' -> brand: flexsteel), identify compound features (e.g. sleeper, power reclining, swivel), accurately extract price and budget constraints (e.g. 'with 1000', 'under 1000', '1000 max', 'for 1000', 'budget 1500', 'under 2k' -> max_price: 1000/1500/2000; 'above 500' -> min_price: 500), and determine if the query is a genuine furniture search (is_furniture_search: true) or non-furniture chatter/greeting/gibberish (is_furniture_search: false). You MUST call find_products_by_constraints with your extraction."
          },
          {
            role: "user",
            content: trimmed
          }
        ],
        tools: [SEARCH_TOOL_DEFINITION],
        tool_choice: { type: "function", function: { name: "find_products_by_constraints" } },
        temperature: 0.1,
        max_tokens: 300
      };

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://webmcp.tendrilsioservices.com",
          "X-Title": "Jennifer Furniture WebMCP Search AI",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        if (res.status === 429 && attempt === 0) {
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        console.warn("OpenRouter Search AI returned non-200:", res.status);
        const fallback = fallbackExtraction(trimmed);
        intentCache.set(cacheKey, { data: fallback, ts: Date.now() });
        return fallback;
      }

      const data = await res.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall || !toolCall.function?.arguments) {
        const fallback = fallbackExtraction(trimmed);
        intentCache.set(cacheKey, { data: fallback, ts: Date.now() });
        return fallback;
      }

      const args = JSON.parse(toolCall.function.arguments);
      
      const parts: string[] = [];
      if (args.category) parts.push(`Type: ${String(args.category).toUpperCase()}`);
      if (Array.isArray(args.features) && args.features.length > 0) parts.push(`Features: ${args.features.join(", ")}`);
      if (args.color) parts.push(`Color: ${args.color}`);
      if (args.material) parts.push(`Material: ${args.material}`);
      if (args.brand) parts.push(`Brand: ${String(args.brand).toUpperCase()}`);
      if (args.max_price) parts.push(`Max: $${Number(args.max_price).toLocaleString()}`);
      if (args.min_price) parts.push(`Min: $${Number(args.min_price).toLocaleString()}`);

      args.interpreted_query = parts.length > 0 ? parts.join(" • ") : trimmed;
      const finalConstraints = args as AISearchConstraints;
      intentCache.set(cacheKey, { data: finalConstraints, ts: Date.now() });
      return finalConstraints;
    } catch (error) {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 300));
        continue;
      }
      console.error("AI Search Tool Call Error:", error);
      const fallback = fallbackExtraction(trimmed);
      intentCache.set(cacheKey, { data: fallback, ts: Date.now() });
      return fallback;
    }
  }

  const fallback = fallbackExtraction(trimmed);
  intentCache.set(cacheKey, { data: fallback, ts: Date.now() });
  return fallback;
}

function fallbackExtraction(query: string): AISearchConstraints {
  const q = query.toLowerCase().trim();
  const colors = ["blue", "navy", "turquoise", "teal", "green", "sage", "olive", "emerald", "brown", "cognac", "espresso", "chocolate", "white", "black", "gray", "grey", "charcoal", "slate", "tan", "beige", "cream", "red", "yellow"];
  const materials = ["leather", "velvet", "fabric", "linen", "wood", "marble", "metal", "chenille"];
  const featuresList = ["sleeper", "power reclining", "reclining", "power", "swivel", "glider", "rocker", "storage", "modular", "chaise", "lift", "futon"];
  const categoryMap: Record<string, string> = {
    "sectional": "sectional", "sectionals": "sectional",
    "sofa": "sofa", "sofas": "sofa", "couch": "sofa", "couches": "sofa",
    "recliner": "recliner", "recliners": "recliner",
    "loveseat": "loveseat", "loveseats": "loveseat",
    "chair": "chair", "chairs": "chair",
    "bed": "bed", "beds": "bed",
    "table": "dining table", "tables": "dining table",
    "desk": "desk", "desks": "desk",
    "ottoman": "ottoman", "ottomans": "ottoman",
    "dresser": "dresser", "dressers": "dresser",
    "nightstand": "nightstand", "nightstands": "nightstand",
    "rug": "rug", "rugs": "rug",
    "lamp": "lamp", "lamps": "lamp"
  };
  const brandMap: Record<string, string> = {
    "bernhardt": "bernhardt", "klaussner": "klaussner",
    "stone & leigh": "stone & leigh", "stone and leigh": "stone & leigh",
    "ashley": "ashley", "esf": "esf",
    "fjords": "fjords", "fjord": "fjords",
    "flexsteel": "flexsteel", "flex steel": "flexsteel",
    "jennifer": "jennifer furniture",
    "coaster": "coaster", "steve silver": "steve silver",
    "parker house": "parker house", "parker living": "parker living",
    "hooker": "hooker", "catnapper": "catnapper",
    "southern motion": "southern motion",
    "best home furnishings": "best home furnishings", "best home": "best home furnishings",
    "jofran": "jofran", "jonathan louis": "jonathan louis",
    "la-z-boy": "la-z-boy", "lazboy": "la-z-boy", "la z boy": "la-z-boy",
    "natuzzi": "natuzzi", "palliser": "palliser", "omnia": "omnia",
    "american leather": "american leather",
    "aico": "aico", "michael amini": "michael amini", "amini": "michael amini",
    "acme": "acme", "homelegance": "homelegance", "crown mark": "crown mark",
    "elements international": "elements international",
    "prime resources": "prime resources", "urban roads": "urban roads",
    "universal": "universal", "luonto": "luonto",
    "gio italia": "gio italia", "innovation living": "innovation living",
    "innovation": "innovation living", "serveco": "serveco"
  };

  // Typo correction against the furniture vocabulary — "gree"→"green",
  // "secyional"→"sectional", "lether"→"leather". Levenshtein with a tight
  // cap so real words are never rewritten.
  const vocab = new Set<string>([
    ...colors, ...materials, ...featuresList.flatMap((f) => f.split(" ")),
    ...Object.keys(categoryMap), ...Object.values(categoryMap),
    ...Object.keys(brandMap).flatMap((b) => b.split(/[^a-z0-9]+/)),
  ].filter((w) => w.length >= 4 && /^[a-z]+$/.test(w)));

  const lev = (a: string, b: string): number => {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 99;
    const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      let prev = dp[0]; dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const t = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = t;
      }
    }
    return dp[n];
  };

  const correctToken = (tok: string): string => {
    if (!/^[a-z]{4,}$/.test(tok) || vocab.has(tok)) return tok;
    const maxDist = tok.length >= 7 ? 2 : 1;
    let best = tok, bestD = Infinity;
    for (const w of vocab) {
      if (w === tok) continue;
      const d = lev(tok, w);
      if (d <= maxDist && d < bestD) { bestD = d; best = w; }
    }
    return best;
  };

  const qFixed = q.split(/\s+/).map(correctToken).join(" ");
  const qMatch = qFixed; // all attribute matching runs on the corrected query

  let extractedColor: string | undefined;
  for (const c of colors) {
    if (new RegExp(`\\b${c}\\b`, "i").test(qMatch)) {
      extractedColor = c === "navy" || c === "turquoise" || c === "teal" ? "blue" : (c === "sage" || c === "olive" || c === "emerald" ? "green" : (c === "espresso" || c === "cognac" || c === "chocolate" ? "brown" : (c === "charcoal" || c === "slate" || c === "grey" ? "gray" : c)));
      break;
    }
  }

  let extractedMaterial: string | undefined;
  for (const m of materials) {
    if (new RegExp(`\\b${m}\\b`, "i").test(qMatch)) {
      extractedMaterial = m;
      break;
    }
  }

  let extractedCategory: string | undefined;
  for (const catKey of Object.keys(categoryMap)) {
    if (new RegExp(`\\b${catKey}\\b`, "i").test(qMatch)) {
      extractedCategory = categoryMap[catKey];
      break;
    }
  }

  let extractedBrand: string | undefined;
  for (const brandKey of Object.keys(brandMap).sort((a, b) => b.length - a.length)) {
    const escaped = brandKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(qMatch)) {
      extractedBrand = brandMap[brandKey];
      break;
    }
  }

  const extractedFeatures: string[] = [];
  for (const f of featuresList) {
    if (new RegExp(`\\b${f}\\b`, "i").test(qMatch) && !extractedFeatures.includes(f)) {
      extractedFeatures.push(f);
    }
  }

  // Range first ("between 2000 and 5000"), then explicit min-price keywords
  // ("above 5000", "over 2k", "at least 3000", "starting at 500"), then max-price.
  const rangeMatch = q.match(/between\s*\$?(\d+(?:\.\d+)?)(k)?\s*(?:and|to|-)\s*\$?(\d+(?:\.\d+)?)(k)?/i);
  const minKMatch = q.match(/(?:above|over|more than|at least|starting\s+(?:at|from)|min(?:imum)?)\s*\$?(\d+(?:\.\d+)?)k\b/i);
  const minMatch = q.match(/(?:above|over|more than|at least|starting\s+(?:at|from)|min(?:imum)?)\s*\$?(\d+(?:\.\d+)?)/i);
  const priceKMatch = q.match(/(?:under|below|<|\$|with|for|budget|max|around|up to)\s*(\d+)k\b/i);
  const priceMatch = q.match(/(?:under|below|<|\$|with|for|budget|max|around|up to)\s*(\d+)/i) || q.match(/\b(\d{3,5})\b/);

  let min_price: number | undefined;
  let max_price: number | undefined;
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1]) * (rangeMatch[2] ? 1000 : 1);
    const b = parseFloat(rangeMatch[3]) * (rangeMatch[4] ? 1000 : 1);
    min_price = Math.min(a, b);
    max_price = Math.max(a, b);
  } else if (minKMatch || minMatch) {
    min_price = minKMatch ? parseFloat(minKMatch[1]) * 1000 : parseFloat(minMatch![1]);
    // An explicit max keyword may still be present ("above 500 under 3000") —
    // but never let the bare-number fallback reuse the same digits as a max.
    const candidateMax = priceKMatch ? parseInt(priceKMatch[1], 10) * 1000 : (priceMatch ? parseInt(priceMatch[1], 10) : undefined);
    if (candidateMax && candidateMax > min_price) max_price = candidateMax;
  } else {
    max_price = priceKMatch ? parseInt(priceKMatch[1], 10) * 1000 : (priceMatch ? parseInt(priceMatch[1], 10) : undefined);
  }

  const greetingsAndNoise = new Set([
    "hi", "hello", "hey", "howdy", "greetings", "yo", "sup", "good", "morning", "afternoon", "evening",
    "please", "thanks", "thank", "you", "can", "could", "would", "ok", "okay", "yes", "no", "test", "testing",
    "what", "where", "who", "which", "how", "why", "when", "is", "are", "do", "does", "any", "some", "buy", "me", "a", "an", "the", "for", "show", "i", "want", "looking", "in", "with", "and", "under", "below", "to", "get", "of", "from", "color", "colour",
    "check", "having", "have", "has", "had", "got", "give", "tell", "need", "needs", "needed", "type", "types", "kind", "kinds", "made", "without", "or", "that", "this", "these", "those"
  ]);

  const meaningfulTokens = qFixed
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t: string) => t.length > 0 && !greetingsAndNoise.has(t));

  const cleanKeywords = meaningfulTokens.join(" ").trim();

  // If user query was just greetings / conversational filler with no product nouns
  if (!cleanKeywords && !extractedCategory && !extractedColor && !extractedMaterial && !extractedBrand && extractedFeatures.length === 0) {
    return {
      search_keywords: "",
      category: "",
      features: [],
      interpreted_query: query.trim(),
    };
  }

  return {
    search_keywords: cleanKeywords || extractedCategory || extractedBrand || "",
    category: extractedCategory || cleanKeywords,
    color: extractedColor,
    material: extractedMaterial,
    brand: extractedBrand,
    features: extractedFeatures,
    max_price,
    min_price,
    interpreted_query: query.trim(),
  };
}

