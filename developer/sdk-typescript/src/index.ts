/**
 * SDK TypeScript Aether.
 *
 * Typed client untuk API /v1 dengan error mapping, tenant context,
 * correlation, dan pagination helpers.
 *
 * By Anomalyid.
 */

export interface AetherClientOptions {
  baseUrl: string;
  tenantId: string;
  principalId: string;
  apiKey?: string;
  fetch?: typeof fetch;
}

export interface AetherMeta {
  request_id: string;
  next_cursor?: string;
  has_more?: boolean;
}

export class AetherApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(input: {
    code: string;
    message: string;
    status: number;
    requestId?: string;
    details?: Record<string, unknown>;
  }) {
    super(input.message);
    this.name = "AetherApiError";
    this.code = input.code;
    this.status = input.status;
    this.requestId = input.requestId;
    this.details = input.details;
  }
}

interface SuccessBody<T> {
  data: T;
  error: null;
  meta: AetherMeta;
}

interface ErrorBody {
  data: null;
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: AetherMeta;
}

export interface CapabilityView {
  id: string;
  version: string;
  name: string;
  description: string;
  riskLevel: string;
}

export interface AgentView {
  id: string;
  version: string;
  name: string;
  enabled: boolean;
  capabilities: string[];
}

export interface AgentRunView {
  id: string;
  agentId: string;
  state: string;
  output?: unknown;
  approvalId?: string;
  correlationId?: string;
}

export interface SkillView {
  id: string;
  name: string;
  description: string;
}

export interface AuditView {
  id: string;
  occurredAt: string;
  action: string;
  outcome: string;
}

class Resource {
  constructor(protected readonly client: AetherClient) {}
}

class CapabilitiesResource extends Resource {
  list(): Promise<CapabilityView[]> {
    return this.client.request<CapabilityView[]>("GET", "/v1/capabilities");
  }

  invoke(
    id: string,
    input: Record<string, unknown>,
    options: { idempotencyKey?: string; approvalId?: string } = {},
  ): Promise<{ status: string; output?: unknown; approvalId?: string }> {
    return this.client.request("POST", `/v1/capabilities/${encodeURIComponent(id)}/invoke`, {
      input,
      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
      ...(options.approvalId === undefined ? {} : { approvalId: options.approvalId }),
    });
  }
}

class AgentsResource extends Resource {
  list(): Promise<AgentView[]> {
    return this.client.request<AgentView[]>("GET", "/v1/agents");
  }

  run(id: string, input: Record<string, unknown>): Promise<AgentRunView> {
    return this.client.request("POST", `/v1/agents/${encodeURIComponent(id)}/runs`, { input });
  }

  getRun(runId: string): Promise<AgentRunView> {
    return this.client.request("GET", `/v1/agents/runs/${encodeURIComponent(runId)}`);
  }

  approve(runId: string, approvalId: string): Promise<AgentRunView> {
    return this.client.request("POST", `/v1/agents/runs/${encodeURIComponent(runId)}/approve`, {
      approvalId,
    });
  }
}

class SkillsResource extends Resource {
  list(): Promise<SkillView[]> {
    return this.client.request<SkillView[]>("GET", "/v1/skills");
  }

  get(id: string): Promise<{ instructions: string }> {
    return this.client.request("GET", `/v1/skills/${encodeURIComponent(id)}`);
  }
}

class AuditResource extends Resource {
  list(limit = 100): Promise<AuditView[]> {
    return this.client.request("GET", `/v1/audit-logs?limit=${encodeURIComponent(String(limit))}`);
  }
}

class ExecutionsResource extends Resource {
  list(): Promise<AgentRunView[]> {
    return this.client.request("GET", "/v1/executions");
  }
}

export class AetherClient {
  readonly capabilities: CapabilitiesResource;
  readonly agents: AgentsResource;
  readonly skills: SkillsResource;
  readonly audit: AuditResource;
  readonly executions: ExecutionsResource;

  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: AetherClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.capabilities = new CapabilitiesResource(this);
    this.agents = new AgentsResource(this);
    this.skills = new SkillsResource(this);
    this.audit = new AuditResource(this);
    this.executions = new ExecutionsResource(this);
  }

  get tenantId(): string {
    return this.options.tenantId;
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-aether-tenant-id": this.options.tenantId,
      "x-aether-principal-id": this.options.principalId,
    };
    if (this.options.apiKey !== undefined) {
      headers.authorization = `Bearer ${this.options.apiKey}`;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    const payload = (await response.json()) as SuccessBody<T> | ErrorBody;
    if (!response.ok || payload.error !== null) {
      const error = (payload as ErrorBody).error;
      throw new AetherApiError({
        code: error?.code ?? "INTERNAL_ERROR",
        message: error?.message ?? `HTTP ${response.status}`,
        status: response.status,
        requestId: payload.meta?.request_id,
        details: error?.details,
      });
    }
    return (payload as SuccessBody<T>).data;
  }
}
