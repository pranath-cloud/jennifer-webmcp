"use client";

import React from "react";
import { X, Check, ShoppingBag, ShieldCheck, Sparkles, Star, Ruler } from "lucide-react";
import { ProductDetailed } from "@/lib/types/shopify";

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: ProductDetailed | null;
  onAddToCart: (variantId: string, title: string, price: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  isOpen,
  onClose,
  product,
  onAddToCart,
}) => {
  if (!isOpen || !product) return null;

  const [selectedVariantId, setSelectedVariantId] = React.useState<string>(
    product.variants[0]?.id || ""
  );

  const activeVariant =
    product.variants.find((v) => v.id === selectedVariantId) ||
    product.variants[0];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 bg-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-600 rounded-xl text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                WebMCP Deep Product Specification
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                get_product_details
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image Gallery */}
            <div>
              <div className="aspect-[4/3] rounded-2xl bg-gray-100 overflow-hidden mb-3">
                {product.featuredImage ? (
                  <img
                    src={product.featuredImage}
                    alt={product.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                    Jennifer Furniture
                  </div>
                )}
              </div>

              {/* Variant Swatch Selector */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-700 block">
                  Select Configuration / Color:
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantId(v.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${
                        activeVariant?.id === v.id
                          ? "bg-navy-950 text-white border-navy-950 shadow-sm"
                          : "bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100"
                      }`}
                    >
                      {v.title} (${parseFloat(v.price).toFixed(2)})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Product Meta & Specs */}
            <div className="space-y-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-brand-600">
                  {product.vendor}
                </span>
                <h3 className="text-xl font-extrabold text-gray-900 mt-1">
                  {product.title}
                </h3>
                <div className="text-2xl font-extrabold text-gray-900 mt-2">
                  ${parseFloat(activeVariant?.price || String(product.minPrice)).toFixed(2)}
                </div>
              </div>

              {/* Parsed Specs Sheet */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 space-y-2.5 text-xs">
                <h4 className="font-bold text-gray-900 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-brand-600" />
                  Structured Specification Sheet
                </h4>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Dimensions:</span>
                  <span className="col-span-2 text-gray-900 font-semibold">
                    {product.specifications.dimensions}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Materials:</span>
                  <span className="col-span-2 text-gray-900 font-semibold">
                    {product.specifications.materials}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1 border-b border-gray-200/60">
                  <span className="text-gray-500 font-medium">Stock Status:</span>
                  <span className="col-span-2 text-emerald-600 font-bold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {activeVariant?.availableForSale ? "In Stock Ready to Ship" : "Special Order"}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-1">
                  <span className="text-gray-500 font-medium">Warranty:</span>
                  <span className="col-span-2 text-gray-800">
                    {product.specifications.warranty}
                  </span>
                </div>
              </div>

              {/* Description */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                  Description:
                </h4>
                <p className="text-xs text-gray-600 line-clamp-4 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Action */}
              <button
                onClick={() =>
                  onAddToCart(
                    activeVariant.id,
                    `${product.title} - ${activeVariant.title}`,
                    parseFloat(activeVariant.price)
                  )
                }
                className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md transition"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Add Selected Variant to Checkout</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
