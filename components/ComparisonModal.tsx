"use client";

import React from "react";
import { X, Check, ShoppingBag, Sparkles, Award, Star } from "lucide-react";
import { ProductComparisonMatrix } from "@/lib/types/shopify";

interface ComparisonModalProps {
  isOpen: boolean;
  onClose: () => void;
  comparison: ProductComparisonMatrix | null;
  onSelectForCheckout: (productId: string) => void;
}

export const ComparisonModal: React.FC<ComparisonModalProps> = ({
  isOpen,
  onClose,
  comparison,
  onSelectForCheckout,
}) => {
  if (!isOpen || !comparison || comparison.products.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-5xl w-full border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-600 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                Agent-Generated Product Comparison
                <span className="text-[10px] bg-brand-500/20 text-brand-300 font-mono px-2 py-0.5 rounded border border-brand-500/30">
                  compare_products
                </span>
              </h2>
              <p className="text-xs text-gray-300">
                Side-by-side aligned dimensional, material, and value analysis
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-navy-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Summary Banner */}
        <div className="bg-brand-50 p-4 border-b border-brand-100 flex items-start gap-3">
          <Award className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 block">
              AI Recommendation & Key Takeaway:
            </span>
            <p className="text-xs text-brand-900 font-medium mt-0.5">
              {comparison.summaryRecommendation}
            </p>
          </div>
        </div>

        {/* Comparison Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className={`grid gap-6 ${
              comparison.products.length === 2
                ? "grid-cols-1 md:grid-cols-2"
                : comparison.products.length === 3
                ? "grid-cols-1 md:grid-cols-3"
                : "grid-cols-1 md:grid-cols-4"
            }`}
          >
            {comparison.products.map((p) => {
              const isBestValue = p.id === comparison.bestValueId;
              const isPremium = p.id === comparison.mostPremiumId;

              return (
                <div
                  key={p.id}
                  className={`rounded-2xl border p-5 flex flex-col justify-between transition-all ${
                    isBestValue
                      ? "border-brand-500 bg-brand-50/20 shadow-md ring-1 ring-brand-500/30"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div>
                    {/* Badge */}
                    <div className="mb-3 flex items-center justify-between">
                      {isBestValue && (
                        <span className="bg-brand-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                          Best Value
                        </span>
                      )}
                      {isPremium && !isBestValue && (
                        <span className="bg-navy-900 text-amber-300 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                          Premium Pick
                        </span>
                      )}
                      <span className="text-[11px] font-semibold text-gray-400">
                        {p.vendor}
                      </span>
                    </div>

                    {/* Image */}
                    <div className="aspect-[4/3] rounded-xl bg-gray-100 overflow-hidden mb-4">
                      {p.featuredImage ? (
                        <img
                          src={p.featuredImage}
                          alt={p.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                          Jennifer Furniture
                        </div>
                      )}
                    </div>

                    <h4 className="font-bold text-sm text-gray-900 line-clamp-2 mb-2">
                      {p.title}
                    </h4>

                    {/* Price */}
                    <div className="text-xl font-extrabold text-gray-900 mb-4">
                      ${p.price.toFixed(2)}
                      {p.compareAtPrice && p.compareAtPrice > p.price && (
                        <span className="text-xs text-gray-400 line-through ml-2">
                          ${p.compareAtPrice.toFixed(2)}
                        </span>
                      )}
                    </div>

                    {/* Specs List */}
                    <div className="space-y-2.5 text-xs text-gray-600 border-t border-gray-100 pt-3">
                      <div>
                        <span className="font-bold text-gray-900 block text-[11px]">
                          Dimensions:
                        </span>
                        <p className="text-gray-700">{p.dimensions}</p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block text-[11px]">
                          Material & Upholstery:
                        </span>
                        <p className="text-gray-700">{p.material}</p>
                      </div>
                      <div>
                        <span className="font-bold text-gray-900 block text-[11px]">
                          Availability:
                        </span>
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          {p.inStock ? "In Stock (Ready to Ship)" : "Special Order"}
                        </span>
                      </div>
                    </div>

                    {/* Pros */}
                    <div className="mt-4 pt-3 border-t border-gray-100">
                      <span className="text-[11px] font-bold text-gray-900 block mb-1.5">
                        Key Advantages:
                      </span>
                      <ul className="space-y-1 text-[11px] text-gray-600">
                        {p.pros.map((pro, idx) => (
                          <li key={idx} className="flex items-start gap-1.5">
                            <Check className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Select Button */}
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => onSelectForCheckout(p.id)}
                      className={`w-full py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition ${
                        isBestValue
                          ? "bg-brand-600 hover:bg-brand-700 text-white"
                          : "bg-navy-900 hover:bg-navy-800 text-white"
                      }`}
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>Select for 1-Click Checkout</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>WebMCP Aligned Specification Matrix</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium"
          >
            Close Comparison
          </button>
        </div>
      </div>
    </div>
  );
};
