"use client";

import React from "react";
import { X, BarChart3, AlertTriangle, TrendingUp, DollarSign, PackageCheck, ShieldCheck } from "lucide-react";

interface AdminReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: any;
}

export const AdminReportModal: React.FC<AdminReportModalProps> = ({
  isOpen,
  onClose,
  title,
  data,
}) => {
  if (!isOpen || !data) return null;

  const isRevenueReport = Boolean(data.estimatedTotalRevenue || data.topSellingCategories);
  const isInventoryReport = Boolean(data.alerts || Array.isArray(data));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full border border-gray-100 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-gray-200 bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-600 rounded-xl text-white">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {title}
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-500/30">
                  Store Owner BI
                </span>
              </h2>
              <p className="text-[11px] text-gray-300 font-mono">
                Shopify Plus Staging Real-Time Intelligence
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

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Revenue Report Display */}
          {isRevenueReport && (
            <div className="space-y-6">
              {/* Executive Banner */}
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 font-medium leading-relaxed">
                <strong>Executive Summary:</strong> {data.executiveSummary}
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    Total Sales
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 mt-1">
                    ${data.estimatedTotalRevenue?.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <PackageCheck className="w-3.5 h-3.5 text-cyan-600" />
                    Est. Orders
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 mt-1">
                    ~{data.totalOrdersEstimate}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200">
                  <div className="text-[11px] font-bold text-gray-500 uppercase flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-brand-600" />
                    Average Order (AOV)
                  </div>
                  <div className="text-xl font-extrabold text-gray-900 mt-1">
                    ${data.averageOrderValue?.toLocaleString()}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="text-[11px] font-bold text-emerald-800 uppercase flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    WebMCP Revenue
                  </div>
                  <div className="text-xl font-extrabold text-emerald-900 mt-1">
                    ${data.webmcpAttributedRevenue?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-mono">
                    {data.webmcpConversionRate}% Conv. Rate
                  </div>
                </div>
              </div>

              {/* Category Breakdown Table */}
              {data.topSellingCategories && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">
                    Sales Breakdown by Furniture Category:
                  </h4>
                  <div className="border border-gray-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-gray-100 text-gray-700 font-bold border-b border-gray-200">
                        <tr>
                          <th className="p-3">Category</th>
                          <th className="p-3">Estimated Revenue</th>
                          <th className="p-3">Share of Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {data.topSellingCategories.map((c: any, i: number) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="p-3 font-semibold text-gray-900">{c.category}</td>
                            <td className="p-3 font-mono font-bold text-gray-900">
                              ${c.revenue.toLocaleString()}
                            </td>
                            <td className="p-3">
                              <span className="bg-brand-100 text-brand-700 px-2 py-0.5 rounded font-mono font-bold">
                                {c.sharePercent}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Inventory Health Alerts Display */}
          {isInventoryReport && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-rose-800 bg-rose-50 p-3 rounded-2xl border border-rose-200 font-medium">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>
                  Showing active catalog products with inventory levels at or below safety reorder thresholds.
                </span>
              </div>

              <div className="space-y-3">
                {(data.alerts || data).map((a: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="font-bold text-gray-900 text-sm">{a.title}</div>
                      <div className="text-[11px] text-gray-500 font-mono mt-0.5">
                        Brand: {a.vendor} | Category: {a.productType}
                      </div>
                      {a.variantsAtRisk?.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {a.variantsAtRisk.map((v: any, vi: number) => (
                            <span
                              key={vi}
                              className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded font-mono"
                            >
                              {v.title}: {v.inventoryQuantity} left
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-block bg-rose-600 text-white font-bold text-[10px] uppercase px-2 py-0.5 rounded-full mb-1">
                        {a.status === "critical_stockout" ? "Out of Stock" : "Low Stock"}
                      </span>
                      <div className="text-[11px] text-gray-600">
                        Total Inv: <strong>{a.totalInventory}</strong>
                      </div>
                      <div className="text-[11px] text-brand-600 font-semibold font-mono">
                        Reorder: +{a.recommendedReorderQty} units
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <span>WebMCP Role-Based Store Analytics</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-700 font-medium"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
};
