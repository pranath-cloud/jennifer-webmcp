"use client";

import React, { useState, useEffect } from "react";
import {
  Search,
  TrendingUp,
  AlertTriangle,
  PieChart,
  BarChart2,
  Mic,
  MessageSquare,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
  Layers,
  Store,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import { AnalyticsMetrics } from "@/lib/types/analytics";

export default function AnalyticsPage() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedShop, setSelectedShop] = useState<string>("all");
  const [refreshing, setRefreshing] = useState<boolean>(false);

  const fetchMetrics = () => {
    setRefreshing(true);
    const url = selectedShop === "all" ? "/api/analytics/metrics" : `/api/analytics/metrics?shop=${selectedShop}`;
    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (data.success && data.metrics) {
          setMetrics(data.metrics);
        }
      })
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    fetchMetrics();
  }, [selectedShop]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-bold text-sm tracking-tight flex items-center gap-2">
                <span>WebMCP Search Intelligence & Analytics</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">Live Telemetry</span>
              </div>
              <p className="text-[11px] text-slate-400">Customer Intent, Search Trends & Unmet Catalog Demand</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
            className="bg-slate-800/90 text-xs border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-200 outline-none"
          >
            <option value="all">All Connected Stores</option>
            <option value="jenniferfurniturestaging.myshopify.com">Jennifer Furniture Staging</option>
          </select>

          <button
            onClick={fetchMetrics}
            disabled={refreshing}
            className="text-xs px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-400" : "text-slate-400"}`} />
            <span>Refresh</span>
          </button>

          <a
            href="/stores"
            className="text-xs px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 transition-all"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Manage Stores</span>
          </a>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* KPI Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Total Searches</span>
              <Search className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{metrics?.totalSearches ?? 0}</div>
            <div className="text-[11px] text-sky-400/80 mt-1 flex items-center gap-1">
              <span>● Non-blocking real-time capture</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">AI Concierge Chats</span>
              <MessageSquare className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{metrics?.totalChats ?? 0}</div>
            <div className="text-[11px] text-indigo-400/80 mt-1 flex items-center gap-1">
              <span>● Spatial & design consultations</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Product Interactions</span>
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{metrics?.totalProductClicks ?? 0}</div>
            <div className="text-[11px] text-emerald-400/80 mt-1 flex items-center gap-1">
              <span>● Dropdown clicks & checkouts</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Voice Search Rate</span>
              <Mic className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{metrics?.voiceSearchRate ?? 0}%</div>
            <div className="text-[11px] text-amber-400/80 mt-1 flex items-center gap-1">
              <span>● Audio voice queries</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-xs font-semibold">Zero-Result Rate</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-black text-slate-100">{metrics?.zeroResultRate ?? 0}%</div>
            <div className="text-[11px] text-rose-400/80 mt-1 flex items-center gap-1">
              <span>● Potential catalog gaps</span>
            </div>
          </div>
        </div>

        {/* Middle Two-Column Grid: Unmet Demand & Top Searched Attributes */}
        {/* Middle Grid: Top Searched Queries & Unmet Demand */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* MOST FREQUENT CUSTOMER SEARCHES (STORED IN DATABASE) */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Search className="w-4 h-4 text-sky-400" />
                  <span>Most Searched Customer Queries</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Top customer search terms saved persistently in database.</p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono font-bold">
                Stored in DB
              </span>
            </div>

            {(!metrics?.topQueries || metrics.topQueries.length === 0) ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                <Search className="w-8 h-8 text-sky-400 mx-auto mb-2 opacity-60" />
                <p className="text-xs text-slate-300 font-semibold">No Search History Yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Searches performed on connected stores will automatically save here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-semibold">Search Term</th>
                      <th className="pb-2 font-semibold">Category</th>
                      <th className="pb-2 font-semibold text-center">Avg Matches</th>
                      <th className="pb-2 font-semibold text-right">Search Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {metrics.topQueries.map((q, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 font-bold text-slate-100">{q.query}</td>
                        <td className="py-2.5 text-slate-400 capitalize">{q.topCategory || "General"}</td>
                        <td className="py-2.5 text-center font-mono text-slate-300">{q.avgResults} items</td>
                        <td className="py-2.5 text-right font-mono font-bold text-sky-400">{q.count}x</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* UNMET DEMAND & ZERO RESULTS (CRITICAL FOR INVENTORY MERCHANDISING) */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Unmet Catalog Demand (Zero Matches)</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">High-frequency customer searches that returned zero in-stock products.</p>
              </div>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 font-mono font-bold">
                Procurement Signals
              </span>
            </div>

            {(!metrics?.unmetDemandQueries || metrics.unmetDemandQueries.length === 0) ? (
              <div className="p-8 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                <p className="text-xs text-slate-300 font-semibold">Zero Unmet Demand Detected</p>
                <p className="text-[11px] text-slate-500 mt-0.5">All customer searches have successfully matched active in-stock catalog items.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2 font-semibold">Search Term</th>
                      <th className="pb-2 font-semibold">Category</th>
                      <th className="pb-2 font-semibold">Frequency</th>
                      <th className="pb-2 font-semibold text-right">Action Signal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {metrics.unmetDemandQueries.map((q, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="py-2.5 font-bold text-slate-100">{q.query}</td>
                        <td className="py-2.5 text-slate-400 capitalize">{q.topCategory || "General"}</td>
                        <td className="py-2.5 font-mono text-rose-400">{q.count}x</td>
                        <td className="py-2.5 text-right font-medium text-amber-400">Stock Inventory</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* TOP SEARCHED ATTRIBUTES & COLOR BREAKDOWN */}
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-sky-400" />
                <span>Customer Color & Category Preferences</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">AI-classified intent breakdown across customer queries.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Color Preferences */}
              <div className="space-y-2 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <span className="text-xs font-bold text-slate-300 block">Top Searched Colors</span>
                {(!metrics?.colorBreakdown || metrics.colorBreakdown.length === 0) ? (
                  <p className="text-[11px] text-slate-500 py-3">No color data recorded yet</p>
                ) : (
                  metrics.colorBreakdown.map((c, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">{c.color}</span>
                        <span className="font-mono text-sky-400">{c.percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${c.percentage}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Category Preferences */}
              <div className="space-y-2 p-3.5 bg-slate-950/40 rounded-xl border border-slate-800/60">
                <span className="text-xs font-bold text-slate-300 block">Top Searched Categories</span>
                {(!metrics?.categoryBreakdown || metrics.categoryBreakdown.length === 0) ? (
                  <p className="text-[11px] text-slate-500 py-3">No category data recorded yet</p>
                ) : (
                  metrics.categoryBreakdown.map((cat, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-slate-300">{cat.category}</span>
                        <span className="font-mono text-indigo-400">{cat.percentage}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${cat.percentage}%` }} />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Real-Time Live Search Stream */}
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" />
                <span>Live Search Stream (Chronological Feed)</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Real-time telemetry of shopper queries with AI intent breakdown.</p>
            </div>
            <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
              Live Feed
            </span>
          </div>

          {(!metrics?.recentSearches || metrics.recentSearches.length === 0) ? (
            <div className="p-8 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800/60">
              No recent searches recorded. Test searching on the storefront to see live events stream here.
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {metrics.recentSearches.map((evt, idx) => (
                <div key={idx} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-3">
                    <span className="p-1.5 rounded-lg bg-slate-800 text-slate-400">
                      {evt.eventType === "voice_search" ? <Mic className="w-3.5 h-3.5 text-amber-400" /> : <Search className="w-3.5 h-3.5 text-sky-400" />}
                    </span>
                    <div>
                      <div className="font-bold text-slate-100">{evt.queryText}</div>
                      <div className="text-[11px] text-slate-500">
                        {evt.interpretedQuery ? `AI Extracted: ${evt.interpretedQuery}` : "Direct Keyword Match"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                      {evt.resultCount ?? 0} matches
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}