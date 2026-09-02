"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Check, ShoppingCart, Sparkles, SlidersHorizontal, ShieldCheck } from "lucide-react";
import { ProductSummary } from "@/lib/types/shopify";

interface ProductCardProps {
  product: ProductSummary;
  isSelectedForCompare: boolean;
  onToggleCompare: (id: string) => void;
  onInspectDetails: (id: string) => void;
  onDirectAddToCart: (product: ProductSummary, color?: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isSelectedForCompare,
  onToggleCompare,
  onInspectDetails,
  onDirectAddToCart,
}) => {
  const [selectedColor, setSelectedColor] = useState<string>(
    product.availableColors[0] || ""
  );

  return (
    <div className="group relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between">
      {/* Top Image Section */}
      <div className="relative aspect-[4/3] bg-gray-100 overflow-hidden">
        {product.featuredImage ? (
          <img
            src={product.featuredImage}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-50 text-xs">
            Jennifer Furniture
          </div>
        )}

        {/* Stock Status Badge */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.inStock ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/90 text-white backdrop-blur-md shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
              In Stock {product.totalInventory > 0 ? `(${product.totalInventory})` : ""}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-800/80 text-gray-200 backdrop-blur-md">
              Special Order
            </span>
          )}

          {product.tags.some((t) => t.toLowerCase().includes("sleeper")) && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-navy-900/90 text-amber-300">
              Sleeper Sofa
            </span>
          )}
        </div>

        {/* Compare Checkbox */}
        <div className="absolute top-3 right-3">
          <button
            onClick={() => onToggleCompare(product.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-md shadow transition flex items-center gap-1.5 ${
              isSelectedForCompare
                ? "bg-brand-600 text-white"
                : "bg-white/90 text-gray-700 hover:bg-white hover:text-brand-600"
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isSelectedForCompare ? "Selected" : "Compare"}</span>
          </button>
        </div>
      </div>

      {/* Product Info Section */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="font-semibold uppercase tracking-wider text-brand-600">
              {product.vendor}
            </span>
            <span>{product.productType}</span>
          </div>

          <h3
            onClick={() => onInspectDetails(product.id)}
            className="font-bold text-sm text-gray-900 line-clamp-2 hover:text-brand-600 cursor-pointer transition"
          >
            {product.title}
          </h3>

          {/* Color Swatches */}
          {product.availableColors.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className="text-[11px] text-gray-400 font-medium">Color:</span>
              <div className="flex flex-wrap gap-1">
                {product.availableColors.map((c) => (
                  <button
                    key={c}
                    onClick={() => setSelectedColor(c)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition ${
                      selectedColor === c
                        ? "bg-navy-950 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-lg font-extrabold text-gray-900 tracking-tight">
              ${product.minPrice.toFixed(2)}
            </div>
            <div className="text-[10px] text-gray-400">
              Verified Shopify Staging Stock
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onInspectDetails(product.id)}
              className="p-2 text-gray-600 hover:text-brand-600 bg-gray-50 hover:bg-gray-100 rounded-xl transition"
              title="View deep specifications"
            >
              <Sparkles className="w-4 h-4" />
            </button>
            <button
              onClick={() => onDirectAddToCart(product, selectedColor)}
              className="bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>Checkout</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
