"use client";

import React, { useState, useEffect } from "react";
import {
  Store,
  Plus,
  Edit2,
  Trash2,
  Code,
  ExternalLink,
  Sparkles,
  Check,
  Copy,
  Layers,
  ShieldCheck,
  ArrowRight
} from "lucide-react";
import { TenantConfig } from "@/lib/types/tenant";
import { THEME_PRESETS } from "@/lib/tenants/presets";

export default function StoresManagerPage() {
  const [stores, setStores] = useState<TenantConfig[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [copiedShop, setCopiedShop] = useState<string | null>(null);

  // New Store Form State
  const [newBrandName, setNewBrandName] = useState<string>("");
  const [newShopDomain, setNewShopDomain] = useState<string>("");
  const [newDiscountCode, setNewDiscountCode] = useState<string>("WELCOME10");
  const [newPresetId, setNewPresetId] = useState<string>("luxury-minimalist");
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const loadStores = () => {
    fetch("/api/stores")
      .then(res => res.json())
      .then(data => {
        if (data.success && data.stores) {
          setStores(data.stores);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStores();
  }, []);

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName || !newShopDomain) return;

    setIsCreating(true);
    try {
      const res = await fetch("/api/stores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brandName: newBrandName,
          shopDomain: newShopDomain,
          discountCode: newDiscountCode,
          presetId: newPresetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowAddModal(false);
        setNewBrandName("");
        setNewShopDomain("");
        loadStores();
      }
    } catch (err) {
      console.error("Create store error:", err);
    } finally {
      setIsCreating(false);
    }
  };

  const copyEmbed = (shopDomain: string, themeId: string) => {
    const code = `<script src="https://webmcp.tendrilsioservices.com/widget.js" data-shop="${shopDomain}" data-theme-id="${themeId}" async></script>`;
    navigator.clipboard.writeText(code);
    setCopiedShop(shopDomain);
    setTimeout(() => setCopiedShop(null), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Store className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-sm tracking-tight flex items-center gap-2">
              <span>WebMCP Multi-Store Manager</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">Multi-Tenant</span>
            </div>
            <p className="text-[11px] text-slate-400">Manage client sites, API keys & isolated theme presets</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/"
            className="text-xs px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <span>Home Hub</span>
          </a>
          <a
            href="/analytics"
            className="text-xs px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            <span>Analytics</span>
          </a>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-xs px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Client Store</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Connected Client Storefronts</h2>
          <p className="text-xs text-slate-400 mt-0.5">Each store operates with isolated catalog search, credentials, and search telemetry.</p>
        </div>

        {/* Stores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {stores.map((store) => (
            <div
              key={store.id}
              className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="font-bold text-base text-slate-100">{store.brandName}</div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Active
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">{store.shopDomain}</div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Search Mode:</span>
                    <span className="text-emerald-400 font-medium">Native 100% Theme CSS</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">API Status:</span>
                    <span className="font-mono text-sky-400">Connected & Verified</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => copyEmbed(store.shopDomain, store.theme?.id || "luxury-minimalist")}
                  className="w-full text-xs py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition-all font-semibold"
                >
                  {copiedShop === store.shopDomain ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
                  <span>{copiedShop === store.shopDomain ? "Embed Script Copied!" : "Copy 1-Line Embed Script"}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Add New Client Store Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div>
              <h3 className="text-base font-bold text-slate-100">Add New Client Store</h3>
              <p className="text-xs text-slate-400 mt-1">Connect a new Shopify store to start delivering WebMCP search & styling.</p>
            </div>

            <form onSubmit={handleCreateStore} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Brand Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Modern Haven"
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Shopify Domain</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. modernhaven.myshopify.com"
                  value={newShopDomain}
                  onChange={(e) => setNewShopDomain(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Initial Theme Preset</label>
                <select
                  value={newPresetId}
                  onChange={(e) => setNewPresetId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2.5 text-slate-200 outline-none"
                >
                  {Object.entries(THEME_PRESETS).map(([k, p]) => (
                    <option key={k} value={k}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition-all disabled:opacity-50"
                >
                  {isCreating ? "Connecting..." : "Add Store"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}