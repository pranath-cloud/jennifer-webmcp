import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jennifer Furniture — Agent-Native WebMCP Platform",
  description:
    "Zero-Scraping WebMCP E-Commerce Platform connected to Shopify Plus (14,447 products). Exposing W3C ModelContext tools for AI agents and store owners.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Standard AI Agent & WebMCP Discovery Links */}
        <meta name="model-context-enabled" content="true" />
        <meta name="model-context-endpoint" content="/api/mcp" />
        <link rel="model-context" href="/api/mcp" />
        <link rel="alternate" type="application/json+mcp" href="/api/mcp" />
        <link rel="ai-plugin" href="/.well-known/ai-plugin.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
