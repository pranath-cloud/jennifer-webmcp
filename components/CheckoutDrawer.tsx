"use client";

import React from "react";
import { X, ExternalLink, ShoppingBag, ShieldCheck, Tag, Sparkles } from "lucide-react";
import { CheckoutHandoffResult } from "@/lib/types/shopify";

interface CheckoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  checkoutData: CheckoutHandoffResult | null;
}

export const CheckoutDrawer: React.FC<CheckoutDrawerProps> = ({
  isOpen,
  onClose,
  checkoutData,
}) => {
  if (!isOpen || !checkoutData) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md bg-white shadow-2xl flex flex-col justify-between h-full border-l border-gray-200">
        {/* Header */}
        <div>
          <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-navy-950 text-white">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-brand-600 rounded-xl text-white">
                <ShoppingBag className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">
                  Agent 1-Click Checkout Handoff
                </h3>
                <p className="text-[11px] text-gray-300 font-mono">
                  create_checkout_handoff
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

          {/* WebMCP Badge */}
          <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-2.5 flex items-center gap-2 text-xs text-emerald-800 font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Direct Shopify Staging Cart Permalink Generated
            </span>
          </div>

          {/* Line Items List */}
          <div className="p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Verified Order Items ({checkoutData.lineItems.length}):
            </h4>

            {checkoutData.lineItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs text-gray-900 line-clamp-1">
                    {item.title}
                  </div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                    Qty: {item.quantity} | Variant ID: {item.variantNumericId}
                  </div>
                </div>
                <div className="text-sm font-extrabold text-gray-900">
                  ${(item.price * item.quantity).toFixed(2)}
                </div>
              </div>
            ))}

            {/* Discount Code */}
            {checkoutData.discountCodeApplied && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-medium">
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-amber-600" />
                  Promo Applied: <strong>{checkoutData.discountCodeApplied}</strong>
                </span>
                <span className="text-emerald-700 font-bold">10% Off at Checkout</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Checkout Action */}
        <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-4">
          <div className="flex items-center justify-between text-base">
            <span className="font-bold text-gray-700">Estimated Total:</span>
            <span className="font-extrabold text-2xl text-gray-900">
              ${checkoutData.estimatedTotal.toFixed(2)}
            </span>
          </div>

          <p className="text-[11px] text-gray-500">
            Taxes, white-glove room delivery, and shipping will be finalized on the secure Shopify checkout page.
          </p>

          <a
            href={checkoutData.checkoutUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3.5 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-500/20 transition-all text-center"
          >
            <span>Proceed to Shopify Staging Checkout</span>
            <ExternalLink className="w-4 h-4" />
          </a>

          <div className="text-center">
            <button
              onClick={onClose}
              className="text-xs text-gray-500 hover:text-gray-700 font-medium"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
