# 🛋️ Jennifer Furniture WebMCP Platform

> **The World's First Agent-Native, Zero-Scraping E-Commerce Platform for Shopify Plus & Google Gemini.**

[![WebMCP Standard](https://img.shields.io/badge/Standard-W3C%20ModelContext-blue.svg)](https://github.com/W3C/model-context)
[![Protocol](https://img.shields.io/badge/Protocol-MCP%20JSON--RPC%202.0-green.svg)](https://modelcontextprotocol.io)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-Google%20Gemini%202.5%20Flash-orange.svg)](https://deepmind.google/technologies/gemini/)
[![Shopify Plus](https://img.shields.io/badge/Shopify%20Plus-14%2C447%20In--Stock%20Items-95BF47.svg)](https://shopify.com)

---

## 🌟 Overview

The **Jennifer Furniture WebMCP Platform** eliminates traditional, brittle HTML screen-scraping by exposing structured programmatic tools directly to browser AI agents (Gemini in Chrome, ChatGPT, Claude) via the standard W3C `document.modelContext` DOM API and server-side Model Context Protocol (`/api/mcp`).

Powered by **Google Gemini 2.5 Flash**, the system acts as a live, voice-enabled **Showroom Sales Manager** that calculates room clearances in real-time, renders architectural SVG blueprints, builds coordinated bundles, and executes 1-click checkout handoffs.

---

## 🚀 Key Features

- 🎙️ **Multimodal Voice Sales Manager**: Click-to-speak voice interaction with real-time speech recognition and audio synthesis.
- 🎯 **Guided DOM Autopilot**: Smoothly navigates the viewport to spotlight recommended furniture with an animated neon blue halo ring.
- 📐 **Spatial Fit & Clearance Engine**: Calculates walkway gaps, traffic flow feasibility, and percentage room footprints.
- 🏗️ **2D Architectural Blueprint Generator**: Generates top-down vector SVG floorplans on the fly for any room dimensions.
- 🎁 **Coordinated Bundle Builder**: Automatically builds aesthetically matching 3-piece living room suites with 15% discount handoffs.
- 🛡️ **Session Rate Limiting**: Built-in 20 calls/hour sliding window protection to prevent API budget exhaustion.
- 🛍️ **Native Shopify AJAX Cart Dispatch**: Directly injects variants into Shopify's native slide-out cart drawer via `/cart/add.js`.

---

## 🏗️ Architecture

```
                       CUSTOMER (Voice / Text)
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │           WEBMCP FRONTEND CLIENT (widget.js)                │
    │  - Animated Audio Waveform & Voice Mic Listener             │
    │  - W3C document.modelContext Universal Compatibility Engine │
    │  - Guided DOM Autopilot (Scrolls, Highlights, Spotlight Glow│
    │  - Native Shopify AJAX Cart (/cart/add.js) Dispatcher       │
    └─────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │       GEMINI MULTIMODAL AI AGENT (/api/agent/chat)          │
    │  - Google Gemini 2.5 Flash / Real-Time Voice Synthesis      │
    │  - Acts as Showroom Sales Director                          │
    │  - Intelligent Parameter Extraction & Dynamic Tool Choice   │
    │  - Client Rate Limiter (20 calls/hr) & Sliding Context      │
    └─────────────────────────────┬───────────────────────────────┘
                                  │
                                  ▼
    ┌─────────────────────────────────────────────────────────────┐
    │            WEBMCP STOREFRONT TOOL SUITE                     │
    │  - find_products_by_constraints (Shopify Plus GraphQL)      │
    │  - calculate_room_fit_and_clearance (Spatial Geometry)      │
    │  - generate_room_floorplan (2D Architectural SVG)           │
    │  - match_fabric_and_lighting (Color & Kelvin Analysis)      │
    │  - build_coordinated_room_bundle (15% Bundle Discount)      │
    │  - create_checkout_handoff (1-Click Buy Permalinks)         │
    └─────────────────────────────────────────────────────────────┘
```

---

## 🌐 Live Endpoints

| Endpoint | Method | Description |
| :--- | :--- | :--- |
| [`/api/mcp/manifest`](https://webmcp.tendrilsioservices.com/api/mcp/manifest) | `GET` | OpenAPI 3.1.0 Manifest for ChatGPT Actions & AI Browsers |
| [`/api/mcp`](https://webmcp.tendrilsioservices.com/api/mcp) | `POST` | MCP JSON-RPC 2.0 Server (`tools/list`, `tools/call`, `initialize`) |
| [`/api/agent/chat`](https://webmcp.tendrilsioservices.com/api/agent/chat) | `POST` | Gemini 2.5 Flash Conversational & Voice Sales Agent |
| [`/widget.js`](https://webmcp.tendrilsioservices.com/widget.js) | `GET` | Universal embeddable client widget |

---

## 📦 Shopify Theme App Extension Installation

To install WebMCP on any Shopify store:

1. Copy the `extensions/webmcp-app-embed` folder into your Shopify App.
2. Run `shopify app deploy`.
3. In the **Shopify Theme Editor**, go to **App Embeds** -> Toggle **WebMCP AI Co-Pilot** -> Click **Save**.

Or manually paste into your `theme.liquid`:
```html
<script src="https://webmcp.tendrilsioservices.com/widget.js" defer></script>
```

---

## 📜 License

MIT License. Designed for the Next Generation of Agentic E-Commerce.
