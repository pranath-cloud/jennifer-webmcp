"use client";

import React, { useState } from "react";
import {
  Sparkles,
  TrendingUp,
  Store,
  ArrowRight,
  Code,
  Zap,
  ExternalLink,
  Check
} from "lucide-react";

export default function WebMCPPlatformHubPage() {
  const [copied, setCopied] = useState(false);

  const embedCode = `<script 
  src="https://webmcp.tendrilsioservices.com/widget.js" 
  data-shop="jenniferfurniturestaging.myshopify.com" 
  data-brand="Jennifer Furniture"
  defer="defer">
</script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="h-16 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="font-bold text-sm tracking-tight flex items-center gap-2">
            <span>WebMCP Platform</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-mono">
              AI Search Engine
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://jenniferfurniturestaging.myshopify.com"
            target="_blank"
            className="text-xs px-3.5 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 flex items-center gap-1.5 transition-all"
          >
            <span>Live Staging Store</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-8 space-y-10">
        <div className="text-center space-y-3 pt-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-sky-400 text-xs font-mono">
            <Zap className="w-3.5 h-3.5" />
            <span>100% Native AI Search Engine</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-100 max-w-2xl mx-auto leading-tight">
            WebMCP Multi-Store AI Search & Analytics
          </h1>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Powers natural language semantic search directly inside your Shopify theme without changing your native CSS or templates.
          </p>
        </div>

        {/* Feature Cards Grid (2 Focused Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
          {/* Analytics Card */}
          <a
            href="/analytics"
            className="group p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 hover:border-emerald-500/50 transition-all flex flex-col justify-between space-y-6 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                <TrendingUp className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-emerald-400 transition-colors">
                Search Telemetry & Customer Demand Analytics
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Track shopper search queries, extracted intent (colors, materials, prices), conversion click-throughs, and unmet inventory demand gaps in real-time.
              </p>
            </div>
            <div className="text-xs font-bold text-emerald-400 flex items-center gap-1">
              <span>View Search Analytics</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>

          {/* Multi-Store Manager Card */}
          <a
            href="/stores"
            className="group p-6 rounded-2xl bg-gradient-to-b from-slate-900/80 to-slate-900/40 border border-slate-800 hover:border-sky-500/50 transition-all flex flex-col justify-between space-y-6 shadow-xl"
          >
            <div className="space-y-3">
              <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 group-hover:scale-105 transition-transform">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                Multi-Store Registry & Credentials
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Connect and manage multiple Shopify stores. Configure isolated shop domains, API access tokens, and generate 1-line script tags.
              </p>
            </div>
            <div className="text-xs font-bold text-sky-400 flex items-center gap-1">
              <span>Manage Connected Stores</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </a>
        </div>

        {/* 1-Line Embed Script Box */}
        <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-bold text-slate-200">1-Line Shopify Storefront Embed</h3>
            </div>
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 font-bold flex items-center gap-1.5 transition-all"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Code className="w-3.5 h-3.5" />}
              <span>{copied ? "Copied to Clipboard!" : "Copy Script Tag"}</span>
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Paste this tag into your Shopify store&apos;s <code className="text-sky-300 font-mono">theme.liquid</code> before <code className="text-sky-300 font-mono">&lt;/head&gt;</code> to activate AI search:
          </p>
          <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto">
            {embedCode}
          </pre>
        </div>
      </main>
    </div>
  );
}