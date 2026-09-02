"use client";

import React, { useState } from "react";
import {
  Zap,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  Code2,
  Layers,
  Terminal,
} from "lucide-react";
import { AgentTelemetryEvent } from "@/lib/types/shopify";

interface AgentActivityPanelProps {
  isOpen: boolean;
  onClose: () => void;
  events: AgentTelemetryEvent[];
  registeredTools: any[];
}

export const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({
  isOpen,
  onClose,
  events,
  registeredTools,
}) => {
  const [activeTab, setActiveTab] = useState<"telemetry" | "tools">("telemetry");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg bg-navy-950 text-white shadow-2xl border-l border-navy-800 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-navy-800 flex items-center justify-between bg-navy-900/90 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-brand-600 rounded-lg text-white">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              WebMCP Agent Telemetry HUD
              <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-2 py-0.5 rounded border border-emerald-500/30">
                Live
              </span>
            </h3>
            <p className="text-[11px] text-gray-400 font-mono">
              W3C document.modelContext Protocol Stream
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

      {/* Tabs */}
      <div className="flex border-b border-navy-800 bg-navy-950/60 px-4 pt-2 gap-2 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("telemetry")}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "telemetry"
              ? "border-brand-500 text-white font-bold"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          Live Event Stream ({events.length})
        </button>
        <button
          onClick={() => setActiveTab("tools")}
          className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
            activeTab === "tools"
              ? "border-brand-500 text-white font-bold"
              : "border-transparent text-gray-400 hover:text-gray-200"
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          Registered Tools ({registeredTools.length})
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs">
        {activeTab === "telemetry" ? (
          events.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-gray-500 p-6">
              <Zap className="w-10 h-10 text-navy-800 mb-3" />
              <p className="font-semibold text-gray-400 text-xs">
                No active tool calls yet.
              </p>
              <p className="text-[11px] text-gray-600 mt-1 max-w-xs">
                Run a scenario from the top playground bar to watch the AI agent discover and call WebMCP tools in real-time.
              </p>
            </div>
          ) : (
            events.map((ev, index) => {
              const isExpanded = expandedEventId === ev.id;
              return (
                <div
                  key={ev.id || index}
                  className={`rounded-xl border transition-all ${
                    ev.status === "executing"
                      ? "bg-navy-900/90 border-amber-500/50 shadow-md shadow-amber-500/5"
                      : ev.status === "success"
                      ? "bg-navy-900/60 border-emerald-500/30"
                      : "bg-navy-900/60 border-rose-500/30"
                  }`}
                >
                  <div
                    onClick={() =>
                      setExpandedEventId(isExpanded ? null : ev.id)
                    }
                    className="p-3 cursor-pointer flex items-start justify-between gap-2"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="mt-0.5">
                        {ev.status === "executing" ? (
                          <span className="flex h-2.5 w-2.5 relative mt-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                          </span>
                        ) : ev.status === "success" ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <X className="w-4 h-4 text-rose-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-cyan-300 text-xs">
                            {ev.toolName}
                          </span>
                          {ev.latencyMs > 0 && (
                            <span className="text-[10px] bg-navy-950 px-1.5 py-0.5 rounded text-amber-300 font-mono flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />
                              {ev.latencyMs}ms
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-300 mt-1 font-sans">
                          {ev.summary}
                        </p>
                      </div>
                    </div>
                    <div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>

                  {/* Expanded Payload Inspector */}
                  {isExpanded && (
                    <div className="p-3 border-t border-navy-800 bg-navy-950/80 rounded-b-xl space-y-2 text-[11px]">
                      <div>
                        <span className="text-gray-400 block mb-1">
                          Inputs (Arguments Passed):
                        </span>
                        <pre className="bg-navy-900 p-2 rounded text-emerald-300 overflow-x-auto">
                          {JSON.stringify(ev.inputs, null, 2)}
                        </pre>
                      </div>
                      {Boolean(ev.responsePreview) && (
                        <div>
                          <span className="text-gray-400 block mb-1">
                            Returned Structured JSON (Tool Output):
                          </span>
                          <pre className="bg-navy-900 p-2 rounded text-amber-200 overflow-x-auto max-h-48">
                            {JSON.stringify(ev.responsePreview, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )
        ) : (
          // Tools Tab
          <div className="space-y-3">
            {registeredTools.map((t, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-navy-900/70 border border-navy-800"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-brand-400 text-xs flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-cyan-400" />
                    {t.name}
                  </span>
                  <span className="text-[10px] bg-navy-950 px-1.5 py-0.5 rounded text-emerald-400 font-mono">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 font-sans mb-2">
                  {t.description}
                </p>
                <details className="text-[10px] text-gray-400">
                  <summary className="cursor-pointer hover:text-gray-200 font-mono">
                    View JSON Schema
                  </summary>
                  <pre className="mt-2 bg-navy-950 p-2 rounded text-cyan-200 overflow-x-auto">
                    {JSON.stringify(t.inputSchema, null, 2)}
                  </pre>
                </details>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-navy-800 bg-navy-900/90 text-[11px] text-gray-400 flex items-center justify-between">
        <span>WebMCP W3C ModelContext Registry</span>
        <span className="text-emerald-400 font-mono">Client-Side Agent Ready</span>
      </div>
    </div>
  );
};
