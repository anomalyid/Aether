/**
 * Adapter MCP Aether — spesifikasi 2026-07-28.
 *
 * Versi dipatok, setiap request membawa _meta, server/discover wajib,
 * deskripsi tool diperlakukan untrusted, dan token tidak diteruskan.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode, redactSecrets } from "@aether/errors";

export const MCP_PROTOCOL_VERSION = "2026-07-28";

export const MCP_META_KEYS = {
  protocolVersion: "io.modelcontextprotocol/protocolVersion",
  clientCapabilities: "io.modelcontextprotocol/clientCapabilities",
  clientInfo: "io.modelcontextprotocol/clientInfo",
  serverInfo: "io.modelcontextprotocol/serverInfo",
} as const;

export interface McpClientIdentity {
  name: string;
  version: string;
}

export interface ServerDiscoverResult {
  protocolVersions: string[];
  capabilities: {
    tools?: Record<string, unknown>;
    resources?: Record<string, unknown>;
    extensions?: Record<string, Record<string, unknown>>;
  };
  serverInfo?: McpClientIdentity;
}

export interface McpToolSnapshot {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  trust: "untrusted";
  capturedAt: string;
}

export interface McpTransport {
  request(method: string, params: Record<string, unknown>, meta: Record<string, unknown>): Promise<unknown>;
}

export interface McpClientOptions {
  clientInfo: McpClientIdentity;
  allowedTools?: string[];
  extensions?: string[];
}

export function buildRequestMeta(
  identity: McpClientIdentity,
  extensions: string[] = [],
): Record<string, unknown> {
  return {
    [MCP_META_KEYS.protocolVersion]: MCP_PROTOCOL_VERSION,
    [MCP_META_KEYS.clientInfo]: { ...identity },
    [MCP_META_KEYS.clientCapabilities]: {
      ...(extensions.length > 0
        ? { extensions: Object.fromEntries(extensions.map((name) => [name, {}])) }
        : {}),
    },
  };
}

export function validateServerDiscover(result: unknown): ServerDiscoverResult {
  if (result === null || typeof result !== "object") {
    throw new AetherError(ErrorCode.PROVIDER_UNAVAILABLE, "server/discover tidak mengembalikan objek.", {
      category: "infrastructure",
      retryable: true,
    });
  }
  const value = result as Partial<ServerDiscoverResult>;
  if (!Array.isArray(value.protocolVersions) || value.protocolVersions.length === 0) {
    throw new AetherError(
      ErrorCode.PROVIDER_UNAVAILABLE,
      "server/discover wajib mengiklankan daftar versi protokol.",
      { category: "infrastructure", retryable: true },
    );
  }
  if (value.capabilities === null || typeof value.capabilities !== "object") {
    throw new AetherError(ErrorCode.PROVIDER_UNAVAILABLE, "server/discover tidak memiliki capabilities.", {
      category: "infrastructure",
      retryable: true,
    });
  }
  return value as ServerDiscoverResult;
}

export class McpClient {
  private discovered: ServerDiscoverResult | undefined;
  private snapshots = new Map<string, McpToolSnapshot>();

  constructor(
    private readonly transport: McpTransport,
    private readonly options: McpClientOptions,
  ) {}

  async discover(): Promise<ServerDiscoverResult> {
    const result = validateServerDiscover(
      await this.transport.request("server/discover", {}, this.meta()),
    );
    this.discovered = result;
    return result;
  }

  async listTools(): Promise<McpToolSnapshot[]> {
    const raw = await this.transport.request("tools/list", {}, this.meta());
    if (raw === null || typeof raw !== "object" || !Array.isArray((raw as { tools?: unknown }).tools)) {
      throw new AetherError(ErrorCode.PROVIDER_UNAVAILABLE, "tools/list tidak valid.", {
        category: "infrastructure",
        retryable: true,
      });
    }

    const capturedAt = new Date().toISOString();
    const tools = (raw as { tools: Array<{ name?: string; description?: string; inputSchema?: Record<string, unknown> }> }).tools;
    this.snapshots = new Map(
      tools
        .filter((tool) => typeof tool.name === "string")
        .map((tool) => {
          const name = tool.name as string;
          const snapshot: McpToolSnapshot = {
            name,
            description: tool.description ?? "",
            inputSchema: tool.inputSchema ?? { type: "object" },
            trust: "untrusted",
            capturedAt,
          };
          return [name, snapshot];
        }),
    );
    return [...this.snapshots.values()];
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    if (this.discovered === undefined) await this.discover();
    const versions = this.discovered?.protocolVersions ?? [];
    if (!versions.includes(MCP_PROTOCOL_VERSION)) {
      throw new AetherError(
        ErrorCode.KERNEL_CONTRACT_MISMATCH,
        `Server tidak mendukung ${MCP_PROTOCOL_VERSION}.`,
        { category: "dependency", retryable: false, details: { supported: versions } },
      );
    }

    if (this.options.allowedTools !== undefined && !this.options.allowedTools.includes(name)) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        `Tool ${name} tidak termasuk daftar yang diizinkan.`,
        { category: "authorization", retryable: false },
      );
    }

    // Token yang masuk dari pemanggil tidak boleh diteruskan ke server eksternal.
    if ("accessToken" in args || "authorization" in args || "__token" in args) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Token dilarang dikirim sebagai argumen tool MCP.",
        { category: "authorization", retryable: false },
      );
    }

    const snapshot = this.snapshots.get(name);
    if (snapshot === undefined) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Tool tidak ditemukan dalam snapshot.", {
        category: "validation",
        retryable: false,
      });
    }

    return this.transport.request(
      "tools/call",
      { name, arguments: redactSecrets(args) },
      this.meta(),
    );
  }

  private meta(): Record<string, unknown> {
    return buildRequestMeta(this.options.clientInfo, this.options.extensions);
  }
}
