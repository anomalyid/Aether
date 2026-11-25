/**
 * Adapter A2A Aether — spesifikasi v1.0.0.
 *
 * A2A bukan pengganti identity dan policy Aether. Setiap delegasi memiliki
 * tenant, scope, deadline, budget, dan output yang diizinkan.
 *
 * By Anomalyid.
 */

import { createId } from "@aether/identifiers";
import { AetherError, ErrorCode } from "@aether/errors";

export const A2A_PROTOCOL_VERSION = "1.0.0";

export interface AgentInterface {
  url: string;
  protocolBinding: "JSONRPC" | "GRPC" | "HTTP+JSON";
  protocolVersion: string;
  tenant?: string;
}

export interface AgentSkill {
  id: string;
  name: string;
  description: string;
  tags?: string[];
}

export interface AgentCapabilities {
  streaming?: boolean;
  pushNotifications?: boolean;
  extensions?: Array<{ uri: string; required?: boolean }>;
  extendedAgentCard?: boolean;
}

export interface AgentCard {
  name: string;
  description: string;
  supportedInterfaces: AgentInterface[];
  provider?: { url: string; organization: string };
  version: string;
  documentationUrl?: string;
  capabilities: AgentCapabilities;
  securitySchemes?: Record<string, unknown>;
  securityRequirements?: Array<Record<string, unknown>>;
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: AgentSkill[];
  signatures?: Array<{ protected: string; signature: string; header?: Record<string, unknown> }>;
  iconUrl?: string;
}

function validString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, `Agent Card field ${field} wajib diisi.`, {
      category: "validation",
      retryable: false,
      details: { field },
    });
  }
}

export function validateAgentCard(input: unknown): AgentCard {
  if (input === null || typeof input !== "object") {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Agent Card harus berupa objek.", {
      category: "validation",
      retryable: false,
    });
  }
  const card = input as AgentCard;
  validString(card.name, "name");
  validString(card.description, "description");
  validString(card.version, "version");

  if (!Array.isArray(card.supportedInterfaces) || card.supportedInterfaces.length === 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Agent Card wajib memiliki supportedInterfaces.", {
      category: "validation",
      retryable: false,
    });
  }
  for (const iface of card.supportedInterfaces) {
    validString(iface.url, "supportedInterfaces.url");
    validString(iface.protocolVersion, "supportedInterfaces.protocolVersion");
    if (!/^https?:\/\//.test(iface.url)) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "URL antarmuka tidak valid.", {
        category: "validation",
        retryable: false,
      });
    }
  }

  if (!Array.isArray(card.defaultInputModes) || !Array.isArray(card.defaultOutputModes)) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Input/output modes wajib berupa array.", {
      category: "validation",
      retryable: false,
    });
  }
  if (!Array.isArray(card.skills)) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Skills wajib berupa array.", {
      category: "validation",
      retryable: false,
    });
  }
  for (const skill of card.skills) {
    validString(skill.id, "skills.id");
    validString(skill.name, "skills.name");
    validString(skill.description, "skills.description");
  }
  return card;
}

export interface DelegationBudget {
  maxSteps: number;
  maxToolCalls: number;
  maxEstimatedCost?: number;
}

export interface DelegationTask {
  id: string;
  tenantId: string;
  requestingAgent: string;
  receivingAgent: string;
  scope: string;
  deadline: string;
  budget: DelegationBudget;
  allowedOutputs: string[];
  createdAt: string;
}

export interface CreateDelegationTaskInput {
  tenantId: string;
  requestingAgent: string;
  receivingAgent: string;
  scope: string;
  ttlMs: number;
  budget: DelegationBudget;
  allowedOutputs: string[];
}

export function createDelegationTask(input: CreateDelegationTaskInput): DelegationTask {
  if (
    input.tenantId.trim().length === 0 ||
    input.requestingAgent.trim().length === 0 ||
    input.receivingAgent.trim().length === 0 ||
    input.scope.trim().length === 0
  ) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Delegasi A2A memiliki field wajib kosong.", {
      category: "validation",
      retryable: false,
    });
  }
  if (!Number.isFinite(input.ttlMs) || input.ttlMs <= 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "TTL delegasi harus positif.", {
      category: "validation",
      retryable: false,
    });
  }
  if (input.budget.maxSteps <= 0 || input.budget.maxToolCalls < 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Budget delegasi tidak valid.", {
      category: "validation",
      retryable: false,
    });
  }
  if (input.allowedOutputs.length === 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Delegasi wajib memiliki allowed outputs.", {
      category: "validation",
      retryable: false,
    });
  }

  const now = new Date();
  return {
    id: createId("a2a"),
    tenantId: input.tenantId,
    requestingAgent: input.requestingAgent,
    receivingAgent: input.receivingAgent,
    scope: input.scope,
    deadline: new Date(now.getTime() + input.ttlMs).toISOString(),
    budget: { ...input.budget },
    allowedOutputs: [...input.allowedOutputs],
    createdAt: now.toISOString(),
  };
}

export function assertDelegationAllowed(
  task: DelegationTask,
  tenantId: string,
  capability: string,
): void {
  if (task.tenantId !== tenantId) {
    throw new AetherError(
      ErrorCode.AUTHORIZATION_DENIED,
      "Delegasi tidak tersedia dalam tenant ini.",
      { category: "authorization", retryable: false },
    );
  }
  if (Date.parse(task.deadline) <= Date.now()) {
    throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Delegasi kedaluwarsa.", {
      category: "authorization",
      retryable: false,
    });
  }
  if (task.scope !== capability) {
    throw new AetherError(ErrorCode.AUTHORIZATION_DENIED, "Capability di luar scope delegasi.", {
      category: "authorization",
      retryable: false,
    });
  }
}
