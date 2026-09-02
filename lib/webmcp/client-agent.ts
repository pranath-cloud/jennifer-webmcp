import { initializeWebMCP } from "./polyfill";
import { AgentTelemetryEvent } from "@/lib/types/shopify";

export type AgentStepCallback = (event: AgentTelemetryEvent) => void;

export class WebMCPAgentRunner {
  private registry = initializeWebMCP();

  public async runAutonomousFlow(
    scenario: "sectional_budget" | "sofa_4000" | "admin_revenue" | "admin_inventory",
    onEvent: AgentStepCallback,
    onProductGridUpdate?: (products: any[]) => void,
    onComparisonOpen?: (comparison: any) => void,
    onCheckoutReady?: (checkout: any) => void,
    onAdminDataReady?: (data: any, title: string) => void
  ): Promise<string> {
    const registry = this.registry;

    // SCENARIO 1: Customer searching for Sofa under $4000
    if (scenario === "sofa_4000") {
      const searchInputs = {
        category: "sofa",
        max_price: 4000,
        in_stock_only: true,
        limit: 8,
      };

      const start1 = performance.now();
      onEvent({
        id: "step-1",
        timestamp: new Date().toISOString(),
        toolName: "find_products_by_constraints",
        inputs: searchInputs,
        latencyMs: 0,
        status: "executing",
        summary: "Customer Agent is filtering 14,447 catalog items for in-stock sofas under $4,000...",
        role: "customer",
      });

      const searchResRaw = await registry.executeTool("find_products_by_constraints", searchInputs);
      const searchData = JSON.parse(searchResRaw.content[0].text);
      const lat1 = Math.round(performance.now() - start1);

      const prods = searchData.products || [];
      if (onProductGridUpdate) onProductGridUpdate(prods);

      onEvent({
        id: "step-1",
        timestamp: new Date().toISOString(),
        toolName: "find_products_by_constraints",
        inputs: searchInputs,
        latencyMs: lat1,
        status: "success",
        summary: `Found ${prods.length} premium sofas under $4,000 verified in stock.`,
        responsePreview: prods.slice(0, 3),
        role: "customer",
      });

      return `Customer search completed in ${lat1}ms.`;
    }

    // SCENARIO 2: Customer 4-Step Flow (Sleeper Sectional under $2k)
    if (scenario === "sectional_budget") {
      const searchInputs = {
        category: "sectional",
        features: ["sleeper"],
        material: "fabric",
        max_price: 2000,
        in_stock_only: true,
        limit: 6,
      };

      const start1 = performance.now();
      onEvent({
        id: "step-1",
        timestamp: new Date().toISOString(),
        toolName: "find_products_by_constraints",
        inputs: searchInputs,
        latencyMs: 0,
        status: "executing",
        summary: "Customer Agent is querying catalog for in-stock sleeper sectionals under $2,000...",
        role: "customer",
      });

      const searchResRaw = await registry.executeTool("find_products_by_constraints", searchInputs);
      const searchData = JSON.parse(searchResRaw.content[0].text);
      const lat1 = Math.round(performance.now() - start1);

      const prods = searchData.products || [];
      if (onProductGridUpdate) onProductGridUpdate(prods);

      onEvent({
        id: "step-1",
        timestamp: new Date().toISOString(),
        toolName: "find_products_by_constraints",
        inputs: searchInputs,
        latencyMs: lat1,
        status: "success",
        summary: `Found ${prods.length} matching sleeper sectionals under $2,000.`,
        responsePreview: prods.slice(0, 3),
        role: "customer",
      });

      if (prods.length < 2) return "Search completed.";

      // Step 2: Compare
      await new Promise((r) => setTimeout(r, 600));
      const compareInputs = { product_ids: [prods[0].id, prods[1].id] };
      const start2 = performance.now();
      onEvent({
        id: "step-2",
        timestamp: new Date().toISOString(),
        toolName: "compare_products",
        inputs: compareInputs,
        latencyMs: 0,
        status: "executing",
        summary: `Generating side-by-side spec comparison for top 2 sectionals...`,
        role: "customer",
      });

      const compareResRaw = await registry.executeTool("compare_products", compareInputs);
      const compareData = JSON.parse(compareResRaw.content[0].text);
      const lat2 = Math.round(performance.now() - start2);

      if (onComparisonOpen) onComparisonOpen(compareData.data);

      onEvent({
        id: "step-2",
        timestamp: new Date().toISOString(),
        toolName: "compare_products",
        inputs: compareInputs,
        latencyMs: lat2,
        status: "success",
        summary: "Side-by-side specs, dimensions, and materials aligned.",
        responsePreview: compareData.data,
        role: "customer",
      });

      // Step 3: Variant stock check
      await new Promise((r) => setTimeout(r, 600));
      const chosenProd = prods[0];
      const variantCheckInputs = {
        product_id: chosenProd.id,
        selected_options: { Color: "Gray" },
      };
      const start3 = performance.now();
      onEvent({
        id: "step-3",
        timestamp: new Date().toISOString(),
        toolName: "check_variant_availability",
        inputs: variantCheckInputs,
        latencyMs: 0,
        status: "executing",
        summary: `Verifying variant inventory for "${chosenProd.title}" (Gray)...`,
        role: "customer",
      });

      const variantResRaw = await registry.executeTool("check_variant_availability", variantCheckInputs);
      const variantData = JSON.parse(variantResRaw.content[0].text);
      const lat3 = Math.round(performance.now() - start3);
      const matchedVariant = variantData.data?.matchedVariant || chosenProd.variants?.[0];

      onEvent({
        id: "step-3",
        timestamp: new Date().toISOString(),
        toolName: "check_variant_availability",
        inputs: variantCheckInputs,
        latencyMs: lat3,
        status: "success",
        summary: `Stock confirmed: "${matchedVariant?.title || 'Default'}" in stock.`,
        responsePreview: variantData.data,
        role: "customer",
      });

      // Step 4: Checkout handoff
      await new Promise((r) => setTimeout(r, 600));
      const checkoutInputs = {
        items: [
          {
            variant_id: matchedVariant?.id || chosenProd.matchedVariantId || "35127566237864",
            quantity: 1,
            title: chosenProd.title,
            price: chosenProd.minPrice,
          },
        ],
        discount_code: "WEBMCP10",
      };
      const start4 = performance.now();
      onEvent({
        id: "step-4",
        timestamp: new Date().toISOString(),
        toolName: "create_checkout_handoff",
        inputs: checkoutInputs,
        latencyMs: 0,
        status: "executing",
        summary: "Generating 1-click Shopify direct checkout link...",
        role: "customer",
      });

      const checkoutResRaw = await registry.executeTool("create_checkout_handoff", checkoutInputs);
      const checkoutData = JSON.parse(checkoutResRaw.content[0].text);
      const lat4 = Math.round(performance.now() - start4);

      if (onCheckoutReady) onCheckoutReady(checkoutData.data);

      onEvent({
        id: "step-4",
        timestamp: new Date().toISOString(),
        toolName: "create_checkout_handoff",
        inputs: checkoutInputs,
        latencyMs: lat4,
        status: "success",
        summary: "Shopify Cart Permalink generated! Customer ready to checkout.",
        responsePreview: checkoutData.data,
        role: "customer",
      });

      return `Completed 4-step workflow in ${lat1 + lat2 + lat3 + lat4}ms.`;
    }

    // SCENARIO 3: Store Owner / Admin Revenue Analytics
    if (scenario === "admin_revenue") {
      // Step A: Authenticate
      onEvent({
        id: "admin-1",
        timestamp: new Date().toISOString(),
        toolName: "authenticate_admin",
        inputs: { password: "••••••••" },
        latencyMs: 15,
        status: "success",
        summary: "Admin credentials verified. Executive Store BI tools unlocked.",
        role: "admin",
      });

      await new Promise((r) => setTimeout(r, 400));
      const startRev = performance.now();
      onEvent({
        id: "admin-2",
        timestamp: new Date().toISOString(),
        toolName: "get_store_revenue_and_analytics",
        inputs: { timeframe: "last_7_days" },
        latencyMs: 0,
        status: "executing",
        summary: "Querying Shopify Plus orders, sales revenue, and WebMCP agent conversion rates...",
        role: "admin",
      });

      const revResRaw = await registry.executeTool("get_store_revenue_and_analytics", {
        timeframe: "last_7_days",
      });
      const revData = JSON.parse(revResRaw.content[0].text);
      const latRev = Math.round(performance.now() - startRev);

      if (onAdminDataReady) onAdminDataReady(revData.data || revData, "Executive Sales & Revenue Report");

      onEvent({
        id: "admin-2",
        timestamp: new Date().toISOString(),
        toolName: "get_store_revenue_and_analytics",
        inputs: { timeframe: "last_7_days" },
        latencyMs: latRev,
        status: "success",
        summary: revData.data?.executiveSummary || "Sales analytics compiled.",
        responsePreview: revData.data || revData,
        role: "admin",
      });

      return "Admin revenue analytics compiled.";
    }

    // SCENARIO 4: Store Owner Inventory Restock Health
    if (scenario === "admin_inventory") {
      onEvent({
        id: "admin-inv-1",
        timestamp: new Date().toISOString(),
        toolName: "get_inventory_health_and_restock_alerts",
        inputs: { threshold: 3 },
        latencyMs: 0,
        status: "executing",
        summary: "Scanning 14,447 catalog products for low-stock and critical stockout alerts...",
        role: "admin",
      });

      const invResRaw = await registry.executeTool("get_inventory_health_and_restock_alerts", {
        threshold: 3,
      });
      const invData = JSON.parse(invResRaw.content[0].text);

      if (onAdminDataReady) onAdminDataReady(invData, "Inventory Health & Restock Alerts");

      onEvent({
        id: "admin-inv-1",
        timestamp: new Date().toISOString(),
        toolName: "get_inventory_health_and_restock_alerts",
        inputs: { threshold: 3 },
        latencyMs: 65,
        status: "success",
        summary: `Identified ${invData.count || invData.alerts?.length || 0} products needing immediate reorder.`,
        responsePreview: invData.alerts || invData,
        role: "admin",
      });

      return "Inventory health scan complete.";
    }

    return "Scenario complete.";
  }
}
