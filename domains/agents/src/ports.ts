/**
 * Portdomain Agent.
 *
 * By Anomalyid.
 */

import type {
  AgentDefinition,
  AgentRun,
  EvaluationRecord,
} from "./types.js";

export interface AgentDefinitionRepository {
  save(definition: AgentDefinition): Promise<void>;
  findById(id: string, version?: string): Promise<AgentDefinition | null>;
  list(tenantId?: string): Promise<AgentDefinition[]>;
}

export interface AgentRunRepository {
  save(run: AgentRun): Promise<void>;
  findById(id: string): Promise<AgentRun | null>;
  listByTenant(tenantId: string): Promise<AgentRun[]>;
}

export interface EvaluationRepository {
  save(record: EvaluationRecord): Promise<void>;
  listByAgent(agentId: string, version?: string): Promise<EvaluationRecord[]>;
}
