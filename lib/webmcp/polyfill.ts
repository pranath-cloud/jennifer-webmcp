/**
 * Official W3C WebMCP Polyfill & Implementation
 * Conforms to the W3C Web Machine Learning Community Group Model Context specification.
 * Provides `document.modelContext` and `navigator.modelContext` with `registerTool`.
 */

export interface WebMCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
  execute: (args: Record<string, any>) => Promise<{
    content: Array<{ type: "text"; text: string }>;
  }>;
}

export interface RegisterToolOptions {
  signal?: AbortSignal;
  exposedTo?: string[];
}

export class ModelContextRegistry {
  private tools: Map<string, WebMCPToolDefinition> = new Map();
  private listeners: Set<(tools: WebMCPToolDefinition[]) => void> = new Set();

  constructor() {
    if (typeof window !== "undefined") {
      console.log("🌐 [WebMCP] ModelContext Registry initialized.");
    }
  }

  public registerTool(tool: WebMCPToolDefinition, options?: RegisterToolOptions): void {
    if (!tool.name || typeof tool.name !== "string") {
      return;
    }
    if (!tool.description || typeof tool.description !== "string") {
      return;
    }
    if (!tool.execute || typeof tool.execute !== "function") {
      return;
    }

    if (this.tools.has(tool.name)) {
      return; // Deduplicate safely
    }

    this.tools.set(tool.name, tool);
    console.log(`🛠️ [WebMCP] Tool registered: ${tool.name}`);

    // If an AbortSignal is provided, listen for abort to unregister tool
    if (options?.signal) {
      options.signal.addEventListener("abort", () => {
        this.tools.delete(tool.name);
        console.log(`🗑️ [WebMCP] Tool unregistered (aborted): ${tool.name}`);
        this.notifyListeners();
        this.dispatchWindowEvent("modelcontext-tool-unregistered", { name: tool.name });
      });
    }

    this.notifyListeners();
    this.dispatchWindowEvent("modelcontext-tool-registered", {
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    });
  }

  public getRegisteredTools(): WebMCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public listTools(): WebMCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTools(): WebMCPToolDefinition[] {
    return Array.from(this.tools.values());
  }

  public getTool(name: string): WebMCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, args: Record<string, any>): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> {
    const tool = this.tools.get(name);
    if (!tool) {
      // Fallback direct network execution
      const endpoint = name === "find_products_by_constraints" ? "/api/products/search" :
                       name === "calculate_room_fit_and_clearance" ? "/api/tools/room-fit" :
                       name === "generate_room_floorplan" ? "/api/tools/floorplan" :
                       name === "match_fabric_and_lighting" ? "/api/tools/fabric-lighting" :
                       name === "get_product_ar_model" ? "/api/tools/ar-model" :
                       name === "compare_products_deep_matrix" ? "/api/tools/compare-deep" :
                       "/api/tools/bundle-builder";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(args || {}),
      });
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    const startTime = performance.now();
    this.dispatchWindowEvent("modelcontext-tool-executing", { name, args });

    try {
      const result = await tool.execute(args);
      const latencyMs = Math.round(performance.now() - startTime);

      this.dispatchWindowEvent("modelcontext-tool-executed", {
        name,
        args,
        result,
        latencyMs,
        success: true,
      });

      return result;
    } catch (err: any) {
      const latencyMs = Math.round(performance.now() - startTime);
      this.dispatchWindowEvent("modelcontext-tool-executed", {
        name,
        args,
        error: err.message,
        latencyMs,
        success: false,
      });
      throw err;
    }
  }

  public subscribe(callback: (tools: WebMCPToolDefinition[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getRegisteredTools());
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    const list = this.getRegisteredTools();
    this.listeners.forEach((cb) => cb(list));
  }

  private dispatchWindowEvent(eventType: string, detail: any): void {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(eventType, { detail }));
    }
  }
}

// Global initialization
export function initializeWebMCP(): ModelContextRegistry {
  if (typeof window === "undefined") {
    return new ModelContextRegistry();
  }

  const win = window as any;
  const doc = document as any;
  const nav = navigator as any;

  if (!win.__modelContextRegistry) {
    win.__modelContextRegistry = new ModelContextRegistry();
  }

  const registry: ModelContextRegistry = win.__modelContextRegistry;

  // Preserve native Chrome registerTool if present
  let nativeDocRegisterTool: any = null;
  try {
    if (doc.modelContext && typeof doc.modelContext.registerTool === "function") {
      nativeDocRegisterTool = doc.modelContext.registerTool.bind(doc.modelContext);
    }
  } catch (e) {}

  const modelContextProxy: any = {
    registerTool: (tool: WebMCPToolDefinition, options?: RegisterToolOptions) => {
      registry.registerTool(tool, options);
      if (nativeDocRegisterTool) {
        try {
          const res = nativeDocRegisterTool(tool, options);
          if (res && typeof res.catch === "function") {
            res.catch(() => {});
          }
        } catch (e) {}
      }
    },
    getRegisteredTools: () => registry.getRegisteredTools(),
    listTools: () => registry.getRegisteredTools(),
    getTools: () => registry.getRegisteredTools(),
    executeTool: (name: string, args: Record<string, any>) => registry.executeTool(name, args),
    callTool: (name: string, args: Record<string, any>) => registry.executeTool(name, args),
  };

  try {
    Object.defineProperty(modelContextProxy, "tools", {
      get: () => registry.getRegisteredTools(),
      enumerable: true,
      configurable: true,
    });
  } catch (e) {}

  try {
    if (doc.modelContext) {
      doc.modelContext.registerTool = modelContextProxy.registerTool;
      doc.modelContext.getRegisteredTools = modelContextProxy.getRegisteredTools;
      doc.modelContext.listTools = modelContextProxy.listTools;
      doc.modelContext.getTools = modelContextProxy.getTools;
      doc.modelContext.executeTool = modelContextProxy.executeTool;
      doc.modelContext.callTool = modelContextProxy.callTool;
      try {
        Object.defineProperty(doc.modelContext, "tools", {
          get: () => registry.getRegisteredTools(),
          enumerable: true,
          configurable: true,
        });
      } catch (e) {}
    } else {
      doc.modelContext = modelContextProxy;
    }
  } catch (e) {}

  try {
    if (!nav.modelContext) {
      nav.modelContext = modelContextProxy;
    }
  } catch (e) {}

  try {
    if (!win.modelContext) {
      win.modelContext = modelContextProxy;
    }
  } catch (e) {}

  return registry;
}
