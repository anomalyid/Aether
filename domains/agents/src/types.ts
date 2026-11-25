/**
 * Tipe domain Agent Aether.
 *
 * By Anomalyid.
 */

import type { InvocationResult, InvocationRequest } from "@aether/capabilities";

export type AgentRunState =
  | "CREATED"
  | "VALIDATING"
  | "QUEUED"
  | "RUNNING"
  | "WAITING_TOOL"
  | "WAITING_APPROVAL"
  | "RESUMING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "EXPIRED";

export interface ExecutionBudget {
  maxDurationMs: number;
  maxSteps: number;
  maxModelCalls: number;
  maxToolCalls: number;
  maxInputTokens?: number;
  maxOutputTokens?: number;
  maxEstimatedCost?: number;
}

export interface AgentDefinition {
  id: string;
  version: string;
  name: string;
  description: string;
  instructions: string;
  skills: string[];
  capabilities: { allowed: string[] };
  model: { profile: string; provider?: string; model?: string };
  limits: ExecutionBudget;
  security: { approvalPolicy: "default" | "strict" };
  tenantId?: string;
  enabled: boolean;
}

export interface AgentRun {
  id: string;
  agentId: string;
  agentVersion: string;
  tenantId: string;
  principalId: string;
  state: AgentRunState;
  input: Record<string, unknown>;
  output?: unknown;
  error?: { code: string; message: string };
  correlationId?: string;
  approvalId?: string;
  steps: number;
  modelCalls: number;
  toolCalls: number;
  createdAt: string;
  updatedAt: string;
}

export type ModelMessageRole = "system" | "user" | "assistant" | "tool";

export interface ModelMessage {
  role: ModelMessageRole;
  content: string;
  name?: string;
}

export interface ModelToolDescriptor {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelRequest {
  messages: ModelMessage[];
  tools?: ModelToolDescriptor[];
  temperature?: number;
  maxTokens?: number;
}

export interface ModelToolCall {
  name: string;
  arguments: Record<string, unknown>;
  callId: string;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCost?: number;
}

export interface ModelResponse {
  text: string;
  model: string;
  provider: string;
  finishReason: string;
  usage: ModelUsage;
  toolCalls?: ModelToolCall[];
}

export interface ModelProvider {
  id: string;
  generate(request: ModelRequest): Promise<ModelResponse>;
  healthCheck?(): Promise<boolean>;
}

export interface GenerationResult {
  response: ModelResponse;
  providerId: string;
  fallbackUsed: boolean;
  attempts: number;
}

export type ContextTrust = "trusted" | "verified" | "untrusted";

export interface ContextItem {
  id: string;
  type: "instruction" | "conversation" | "skill" | "knowledge" | "memory" | "tool_result";
  content: unknown;
  source: string;
  trust: ContextTrust;
  createdAt: string;
}

export interface CapabilityInvokerPort {
  invoke(request: InvocationRequest): Promise<InvocationResult>;
}

export interface EvaluationRecord {
  id: string;
  agentId: string;
  agentVersion: string;
  tenantId: string;
  runId: string;
  dimensions: Record<string, number>;
  createdAt: string;
}
