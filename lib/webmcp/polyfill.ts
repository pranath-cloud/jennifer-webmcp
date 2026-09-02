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
      throw new Error("[WebMCP] Tool must have a valid string name.");
    }
    if (!tool.description || typeof tool.description !== "string") {
      throw new Error("[WebMCP] Tool must have a description.");
    }
    if (!tool.execute || typeof tool.execute !== "function") {
      throw new Error("[WebMCP] Tool must have an execute function.");
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

  public getTool(name: string): WebMCPToolDefinition | undefined {
    return this.tools.get(name);
  }

  public async executeTool(name: string, args: Record<string, any>): Promise<{
    content: Array<{ type: "text"; text: string }>;
  }> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`[WebMCP] No registered tool found with name "${name}".`);
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

  const modelContextProxy = {
    registerTool: (tool: WebMCPToolDefinition, options?: RegisterToolOptions) =>
      registry.registerTool(tool, options),
    getRegisteredTools: () => registry.getRegisteredTools(),
    executeTool: (name: string, args: Record<string, any>) =>
      registry.executeTool(name, args),
  };

  // Bind to document.modelContext and navigator.modelContext
  if (!doc.modelContext) {
    doc.modelContext = modelContextProxy;
  }
  if (!nav.modelContext) {
    nav.modelContext = modelContextProxy;
  }
  if (!win.modelContext) {
    win.modelContext = modelContextProxy;
  }

  return registry;
}
