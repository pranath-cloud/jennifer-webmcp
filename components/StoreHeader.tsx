"use client";

import React from "react";
import { Sparkles, ShoppingBag, ShieldCheck, Zap } from "lucide-react";

interface StoreHeaderProps {
  toolCount: number;
  activeAgentsCount?: number;
  cartCount: number;
  onOpenCart: () => void;
  onOpenActivity: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  toolCount,
  cartCount,
  onOpenCart,
  onOpenActivity,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
      {/* Top WebMCP Standard Ribbon */}
      <div className="bg-navy-950 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between border-b border-navy-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="font-mono text-emerald-400 font-semibold uppercase tracking-wider">
            W3C WebMCP Standard Active
          </span>
          <span className="text-gray-400 hidden sm:inline">|</span>
          <span className="text-gray-300 hidden sm:inline">
            document.modelContext: <strong className="text-white">{toolCount} Tools Registered</strong>
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-gray-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px]">Shopify Plus Staging (14,447 Items)</span>
          </div>
          <button
            onClick={onOpenActivity}
            className="bg-brand-600 hover:bg-brand-700 text-white px-2 py-0.5 rounded text-[11px] font-mono flex items-center gap-1 transition-colors"
          >
            <Zap className="w-3 h-3 text-amber-300" />
            Agent Telemetry HUD
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-brand-600 text-white p-2 rounded-xl shadow-md flex items-center justify-center font-bold text-lg tracking-wider">
            JF
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-xl tracking-tight text-gray-900">
                Jennifer Furniture
              </span>
              <span className="bg-brand-100 text-brand-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                Agent-Native
              </span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              WebMCP Model Context Protocol Showcase
            </p>
          </div>
        </div>

        {/* Categories Bar */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
          <span className="text-brand-600 font-semibold cursor-pointer border-b-2 border-brand-600 pb-1">
            Living Room & Sectionals
          </span>
          <span className="hover:text-gray-900 cursor-pointer">Dining Sets</span>
          <span className="hover:text-gray-900 cursor-pointer">Bedroom & Mattresses</span>
          <span className="hover:text-gray-900 cursor-pointer">Recliners</span>
          <span className="hover:text-gray-900 cursor-pointer">Sale</span>
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenActivity}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 bg-gray-50 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
          >
            <Sparkles className="w-4 h-4 text-brand-600" />
            <span className="hidden sm:inline">Inspect Agent Tools</span>
          </button>

          <button
            onClick={onOpenCart}
            className="relative p-2 text-gray-700 hover:text-brand-600 transition-colors rounded-lg hover:bg-gray-100"
            aria-label="View Cart"
          >
            <ShoppingBag className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-brand-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
