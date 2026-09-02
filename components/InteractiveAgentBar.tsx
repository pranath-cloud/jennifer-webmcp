"use client";

import React, { useState } from "react";
import { Sparkles, ArrowRight, Play, Loader2, RefreshCw, ShieldCheck, UserCheck, BarChart3, AlertTriangle } from "lucide-react";

interface InteractiveAgentBarProps {
  isRunning: boolean;
  onRunScenario: (scenario: "sectional_budget" | "sofa_4000" | "admin_revenue" | "admin_inventory") => void;
  onCustomSearch: (query: string) => void;
  onReset: () => void;
}

export const InteractiveAgentBar: React.FC<InteractiveAgentBarProps> = ({
  isRunning,
  onRunScenario,
  onCustomSearch,
  onReset,
}) => {
  const [customInput, setCustomInput] = useState("");
  const [activeRole, setActiveRole] = useState<"customer" | "admin">("customer");

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim() && !isRunning) {
      onCustomSearch(customInput.trim());
    }
  };

  return (
    <div className="bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white rounded-2xl p-5 shadow-xl border border-navy-800 my-6">
      {/* Top Bar with Role Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-navy-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-brand-500 to-amber-500 rounded-xl shadow-lg text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Agent-Native WebMCP Playground
              <span className="text-[11px] bg-emerald-500/20 text-emerald-300 font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                Zero-Config Discovery
              </span>
            </h2>
            <p className="text-xs text-gray-300">
              Autonomous AI agent actions powered by <code className="text-amber-300 font-mono">document.modelContext</code> and <code className="text-cyan-300 font-mono">/api/mcp</code>
            </p>
          </div>
        </div>

        {/* Role Toggle & Reset */}
        <div className="flex items-center gap-2">
          <div className="bg-navy-950 p-1 rounded-xl border border-navy-800 flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveRole("customer")}
              className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeRole === "customer"
                  ? "bg-brand-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Customer Mode
            </button>
            <button
              onClick={() => setActiveRole("admin")}
              className={`px-3 py-1 rounded-lg font-semibold flex items-center gap-1.5 transition ${
                activeRole === "admin"
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Store Owner BI
            </button>
          </div>

          <button
            onClick={onReset}
            disabled={isRunning}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-xs font-medium text-gray-300 hover:text-white transition disabled:opacity-50"
            title="Reset catalog view"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Dynamic Scenario Buttons Based on Role */}
      <div className="mt-4">
        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2.5 flex items-center justify-between">
          <span>
            {activeRole === "customer"
              ? "Customer Scenarios (Zero-Config Browsing):"
              : "Store Owner Intelligence Scenarios (Executive BI):"}
          </span>
          <span className="text-[11px] text-amber-300 font-normal">
            {activeRole === "customer"
              ? "Automates: Natural Search → Stock Check → Spec Comparison → 1-Click Buy"
              : "Automates: Sales Revenue Analytics → Inventory Risk Alerts → Trends"}
          </span>
        </div>

        {activeRole === "customer" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Customer Prompt 1 */}
            <button
              onClick={() => onRunScenario("sofa_4000")}
              disabled={isRunning}
              className="group flex flex-col items-start p-3 rounded-xl bg-navy-800/90 hover:bg-brand-900/40 border border-navy-700 hover:border-brand-500/60 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-white group-hover:text-brand-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-current text-brand-400" />
                  Sofa under $4,000
                </span>
                <span className="text-[10px] bg-navy-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
                  Natural AI
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2">
                "Find premium in-stock sofas under $4,000 for living room."
              </p>
            </button>

            {/* Customer Prompt 2 */}
            <button
              onClick={() => onRunScenario("sectional_budget")}
              disabled={isRunning}
              className="group flex flex-col items-start p-3 rounded-xl bg-navy-800/90 hover:bg-brand-900/40 border border-navy-700 hover:border-brand-500/60 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-white group-hover:text-brand-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-current text-brand-400" />
                  Sleeper Sectional & Checkout
                </span>
                <span className="text-[10px] bg-navy-950 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                  4 Steps
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2">
                "Find gray sleeper sectionals under $2k, compare specs, verify stock, and buy."
              </p>
            </button>

            {/* Customer Prompt 3 */}
            <button
              onClick={() => onCustomSearch("solid wood dining table in stock")}
              disabled={isRunning}
              className="group flex flex-col items-start p-3 rounded-xl bg-navy-800/90 hover:bg-brand-900/40 border border-navy-700 hover:border-brand-500/60 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-white group-hover:text-brand-400 flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 fill-current text-brand-400" />
                  Dining Tables & Chairs
                </span>
                <span className="text-[10px] bg-navy-950 px-1.5 py-0.5 rounded text-gray-400 font-mono">
                  Hardwood
                </span>
              </div>
              <p className="text-[11px] text-gray-400 line-clamp-2">
                "Find in-stock solid wood dining collections with dimensions."
              </p>
            </button>
          </div>
        ) : (
          /* Store Owner Admin Scenarios */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => onRunScenario("admin_revenue")}
              disabled={isRunning}
              className="group flex flex-col items-start p-3.5 rounded-xl bg-navy-800/90 hover:bg-amber-950/40 border border-navy-700 hover:border-amber-500/60 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <BarChart3 className="w-4 h-4 text-amber-400" />
                  Executive Sales & Revenue Report
                </span>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono border border-amber-500/30">
                  Admin
                </span>
              </div>
              <p className="text-[11px] text-gray-300">
                "Analyze weekly revenue, average order value, top selling categories, and WebMCP agent conversion rates."
              </p>
            </button>

            <button
              onClick={() => onRunScenario("admin_inventory")}
              disabled={isRunning}
              className="group flex flex-col items-start p-3.5 rounded-xl bg-navy-800/90 hover:bg-amber-950/40 border border-navy-700 hover:border-amber-500/60 transition-all text-left disabled:opacity-50"
            >
              <div className="flex items-center justify-between w-full mb-1">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  Inventory Health & Stockout Alerts
                </span>
                <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-mono border border-rose-500/30">
                  Stock Risk
                </span>
              </div>
              <p className="text-[11px] text-gray-300">
                "Scan all 14,447 catalog items for low stock levels (&le; 3 units) and recommended reorder counts."
              </p>
            </button>
          </div>
        )}
      </div>

      {/* Natural Language Search Input */}
      <form onSubmit={handleCustomSubmit} className="mt-4 flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            placeholder={
              activeRole === "customer"
                ? "Type any natural query (e.g., 'Modern sleeper sectional under $3500 in stock')..."
                : "Type admin query (e.g., 'Sales breakdown for dining room collections')..."
            }
            className="w-full bg-navy-950/80 border border-navy-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
            disabled={isRunning}
          />
        </div>
        <button
          type="submit"
          disabled={isRunning || !customInput.trim()}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-all"
        >
          {isRunning ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <>
              <span>Ask Agent</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
};
