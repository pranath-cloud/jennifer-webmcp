"use client";

import React from "react";
import { ProductSummary } from "@/lib/types/shopify";
import { ProductCard } from "./ProductCard";
import { SlidersHorizontal, ArrowUpDown, Filter, Sparkles } from "lucide-react";

interface ProductGridProps {
  products: ProductSummary[];
  isLoading: boolean;
  selectedCompareIds: string[];
  onToggleCompare: (id: string) => void;
  onInspectDetails: (id: string) => void;
  onOpenCompareModal: () => void;
  onDirectAddToCart: (product: ProductSummary, color?: string) => void;
}

export const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  isLoading,
  selectedCompareIds,
  onToggleCompare,
  onInspectDetails,
  onOpenCompareModal,
  onDirectAddToCart,
}) => {
  return (
    <div>
      {/* Grid Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 mb-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900 tracking-tight">
            Curated Catalog Products
          </h2>
          <span className="bg-gray-100 text-gray-700 text-xs font-semibold px-2.5 py-0.5 rounded-full">
            {products.length} Items Displayed
          </span>
        </div>

        {/* Floating Compare Action Trigger */}
        <div className="flex items-center gap-3">
          {selectedCompareIds.length >= 2 && (
            <button
              onClick={onOpenCompareModal}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-brand-500/20 animate-bounce transition"
            >
              <Sparkles className="w-4 h-4" />
              <span>Compare {selectedCompareIds.length} Products Side-by-Side</span>
            </button>
          )}

          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1 font-medium">
              <Filter className="w-3.5 h-3.5" />
              Filter: In Stock
            </span>
          </div>
        </div>
      </div>

      {/* Grid Display */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-4 h-96 animate-pulse flex flex-col justify-between"
            >
              <div className="bg-gray-200 h-48 rounded-xl w-full mb-4"></div>
              <div className="space-y-2">
                <div className="bg-gray-200 h-4 rounded w-1/3"></div>
                <div className="bg-gray-200 h-5 rounded w-full"></div>
                <div className="bg-gray-200 h-4 rounded w-1/2"></div>
              </div>
              <div className="bg-gray-200 h-8 rounded-xl w-full mt-4"></div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Filter className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-gray-900 text-base mb-1">
            No products match the selected criteria
          </h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Try adjusting your budget or click one of the demo prompts above to trigger the WebMCP search agent.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              isSelectedForCompare={selectedCompareIds.includes(p.id)}
              onToggleCompare={onToggleCompare}
              onInspectDetails={onInspectDetails}
              onDirectAddToCart={onDirectAddToCart}
            />
          ))}
        </div>
      )}
    </div>
  );
};
