"use client";

import React, { useEffect, useState, useRef } from "react";
import { StoreHeader } from "@/components/StoreHeader";
import { InteractiveAgentBar } from "@/components/InteractiveAgentBar";
import { ProductGrid } from "@/components/ProductGrid";
import { AgentActivityPanel } from "@/components/AgentActivityPanel";
import { ComparisonModal } from "@/components/ComparisonModal";
import { ProductDetailModal } from "@/components/ProductDetailModal";
import { CheckoutDrawer } from "@/components/CheckoutDrawer";
import { AdminReportModal } from "@/components/AdminReportModal";
import { registerAllWebMCPTools } from "@/lib/webmcp/register";
import { WebMCPAgentRunner } from "@/lib/webmcp/client-agent";
import {
  ProductSummary,
  ProductDetailed,
  ProductComparisonMatrix,
  CheckoutHandoffResult,
  AgentTelemetryEvent,
} from "@/lib/types/shopify";
import { ShieldCheck } from "lucide-react";

export default function Home() {
  // State
  const [products, setProducts] = useState<ProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAgentRunning, setIsAgentRunning] = useState<boolean>(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [comparisonData, setComparisonData] =
    useState<ProductComparisonMatrix | null>(null);
  const [isCompareModalOpen, setIsCompareModalOpen] = useState<boolean>(false);
  const [detailedProduct, setDetailedProduct] =
    useState<ProductDetailed | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [checkoutData, setCheckoutData] = useState<CheckoutHandoffResult | null>(
    null
  );
  const [isCheckoutDrawerOpen, setIsCheckoutDrawerOpen] =
    useState<boolean>(false);
  const [isActivityOpen, setIsActivityOpen] = useState<boolean>(false);
  const [telemetryEvents, setTelemetryEvents] = useState<AgentTelemetryEvent[]>(
    []
  );
  const [registeredTools, setRegisteredTools] = useState<any[]>([]);

  // Admin Modal State
  const [adminReportData, setAdminReportData] = useState<any>(null);
  const [adminReportTitle, setAdminReportTitle] = useState<string>("");
  const [isAdminReportOpen, setIsAdminReportOpen] = useState<boolean>(false);

  const agentRunnerRef = useRef<WebMCPAgentRunner | null>(null);

  // Initialize WebMCP tools and listeners on mount
  useEffect(() => {
    const registry = registerAllWebMCPTools();
    agentRunnerRef.current = new WebMCPAgentRunner();

    setRegisteredTools(registry.getRegisteredTools());

    const unsubscribe = registry.subscribe((tools) => {
      setRegisteredTools(tools);
    });

    const handleExecuting = (e: any) => {
      const detail = e.detail;
      setTelemetryEvents((prev) => [
        {
          id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          timestamp: new Date().toISOString(),
          toolName: detail.name,
          inputs: detail.args,
          latencyMs: 0,
          status: "executing",
          summary: `WebMCP tool "${detail.name}" invoked by agent.`,
        },
        ...prev,
      ]);
    };

    const handleExecuted = (e: any) => {
      const detail = e.detail;
      setTelemetryEvents((prev) => {
        const updated = [...prev];
        const target = updated.find(
          (ev) => ev.toolName === detail.name && ev.status === "executing"
        );
        if (target) {
          target.status = detail.success ? "success" : "error";
          target.latencyMs = detail.latencyMs || 15;
          target.responsePreview = detail.result || detail.error;
        }
        return updated;
      });
    };

    window.addEventListener("modelcontext-tool-executing", handleExecuting);
    window.addEventListener("modelcontext-tool-executed", handleExecuted);

    loadInitialProducts();

    return () => {
      unsubscribe();
      window.removeEventListener("modelcontext-tool-executing", handleExecuting);
      window.removeEventListener("modelcontext-tool-executed", handleExecuted);
    };
  }, []);

  const loadInitialProducts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "sectional",
          in_stock_only: true,
          limit: 9,
        }),
      });
      const data = await res.json();
      if (data.products) {
        setProducts(data.products);
      }
    } catch (err) {
      console.error("Initial load error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Run autonomous agent scenario (Customer or Admin)
  const handleRunScenario = async (
    scenario: "sectional_budget" | "sofa_4000" | "admin_revenue" | "admin_inventory"
  ) => {
    if (!agentRunnerRef.current || isAgentRunning) return;

    setIsAgentRunning(true);
    setIsActivityOpen(true);

    try {
      await agentRunnerRef.current.runAutonomousFlow(
        scenario,
        (event) => {
          setTelemetryEvents((prev) => [
            event,
            ...prev.filter((e) => e.id !== event.id),
          ]);
        },
        (updatedProducts) => {
          setProducts(updatedProducts);
        },
        (compData) => {
          setComparisonData(compData);
          setIsCompareModalOpen(true);
        },
        (chData) => {
          setCheckoutData(chData);
          setIsCheckoutDrawerOpen(true);
        },
        (adminData, title) => {
          setAdminReportData(adminData);
          setAdminReportTitle(title);
          setIsAdminReportOpen(true);
        }
      );
    } catch (err) {
      console.error("Scenario execution error:", err);
    } finally {
      setIsAgentRunning(false);
    }
  };

  // Custom search prompt
  const handleCustomSearch = async (queryText: string) => {
    setIsLoading(true);
    setIsAgentRunning(true);
    try {
      const startTime = performance.now();
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryText,
          in_stock_only: true,
          limit: 12,
        }),
      });
      const data = await res.json();
      const lat = Math.round(performance.now() - startTime);

      if (data.products) {
        setProducts(data.products);
      }

      setTelemetryEvents((prev) => [
        {
          id: `ev-${Date.now()}`,
          timestamp: new Date().toISOString(),
          toolName: "find_products_by_constraints",
          inputs: { query: queryText },
          latencyMs: lat,
          status: "success",
          summary: `Filtered ${data.count || 0} catalog items matching "${queryText}".`,
          responsePreview: data.products,
        },
        ...prev,
      ]);
    } catch (err) {
      console.error("Search error:", err);
    } finally {
      setIsLoading(false);
      setIsAgentRunning(false);
    }
  };

  const handleToggleCompare = (id: string) => {
    setSelectedCompareIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id].slice(0, 4)
    );
  };

  const handleOpenCompareModal = async () => {
    if (selectedCompareIds.length < 2) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/products/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_ids: selectedCompareIds }),
      });
      const data = await res.json();
      if (data.data) {
        setComparisonData(data.data);
        setIsCompareModalOpen(true);
      }
    } catch (err) {
      console.error("Compare error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInspectDetails = async (id: string) => {
    try {
      const res = await fetch("/api/products/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id }),
      });
      const data = await res.json();
      if (data.product) {
        setDetailedProduct(data.product);
        setIsDetailModalOpen(true);
      }
    } catch (err) {
      console.error("Details error:", err);
    }
  };

  const handleDirectAddToCart = async (
    product: ProductSummary,
    color?: string
  ) => {
    try {
      const variantId = product.matchedVariantId || product.id;
      const res = await fetch("/api/cart/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            {
              variant_id: variantId,
              quantity: 1,
              title: `${product.title}${color ? ` - ${color}` : ""}`,
              price: product.minPrice,
            },
          ],
          discount_code: "WEBMCP10",
        }),
      });
      const data = await res.json();
      if (data.data) {
        setCheckoutData(data.data);
        setIsCheckoutDrawerOpen(true);
      }
    } catch (err) {
      console.error("Cart error:", err);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <StoreHeader
        toolCount={registeredTools.length}
        cartCount={checkoutData?.lineItems.length || 0}
        onOpenCart={() => setIsCheckoutDrawerOpen(true)}
        onOpenActivity={() => setIsActivityOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Interactive WebMCP Playground Bar */}
        <InteractiveAgentBar
          isRunning={isAgentRunning}
          onRunScenario={handleRunScenario}
          onCustomSearch={handleCustomSearch}
          onReset={loadInitialProducts}
        />

        {/* Product Catalog Grid */}
        <ProductGrid
          products={products}
          isLoading={isLoading}
          selectedCompareIds={selectedCompareIds}
          onToggleCompare={handleToggleCompare}
          onInspectDetails={handleInspectDetails}
          onOpenCompareModal={handleOpenCompareModal}
          onDirectAddToCart={handleDirectAddToCart}
        />
      </main>

      {/* Modals & Drawers */}
      <ComparisonModal
        isOpen={isCompareModalOpen}
        onClose={() => setIsCompareModalOpen(false)}
        comparison={comparisonData}
        onSelectForCheckout={(prodId) => {
          setIsCompareModalOpen(false);
          const p = products.find((item) => item.id === prodId);
          if (p) handleDirectAddToCart(p);
        }}
      />

      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        product={detailedProduct}
        onAddToCart={(variantId, title, price) => {
          setIsDetailModalOpen(false);
          fetch("/api/cart/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              items: [{ variant_id: variantId, quantity: 1, title, price }],
              discount_code: "WEBMCP10",
            }),
          })
            .then((r) => r.json())
            .then((d) => {
              if (d.data) {
                setCheckoutData(d.data);
                setIsCheckoutDrawerOpen(true);
              }
            });
        }}
      />

      <CheckoutDrawer
        isOpen={isCheckoutDrawerOpen}
        onClose={() => setIsCheckoutDrawerOpen(false)}
        checkoutData={checkoutData}
      />

      <AdminReportModal
        isOpen={isAdminReportOpen}
        onClose={() => setIsAdminReportOpen(false)}
        title={adminReportTitle}
        data={adminReportData}
      />

      <AgentActivityPanel
        isOpen={isActivityOpen}
        onClose={() => setIsActivityOpen(false)}
        events={telemetryEvents}
        registeredTools={registeredTools}
      />

      {/* Footer */}
      <footer className="mt-16 bg-navy-950 text-white border-t border-navy-800 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="font-extrabold text-base tracking-tight flex items-center gap-2">
              <span>AgentCart Enterprise</span>
              <span className="text-[10px] bg-brand-600 px-2 py-0.5 rounded font-mono">
                W3C WebMCP & MCP Standard
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Zero-Config Agent-Native Storefront connected to Shopify Plus (14,447 items).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1 text-emerald-400 font-mono">
              <ShieldCheck className="w-4 h-4" />
              Shopify Plus Staging
            </span>
            <span>|</span>
            <span className="font-mono text-cyan-300">AWS EC2 & Cloudflare Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
