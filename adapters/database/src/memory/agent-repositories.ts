/**
 * Implementasi in-memory untuk port Agent.
 * Untuk test; produksi memakai PostgreSQL (migrations/0004_agents.sql).
 *
 * By Anomalyid.
 */

import type {
  AgentDefinition,
  AgentDefinitionRepository,
  AgentRun,
  AgentRunRepository,
  EvaluationRecord,
  EvaluationRepository,
} from "@aether/agents";

class MemoryAgentDefinitionRepository implements AgentDefinitionRepository {
  private readonly data = new Map<string, AgentDefinition>();

  async save(definition: AgentDefinition): Promise<void> {
    this.data.set(`${definition.id}@${definition.version}`, { ...definition });
  }
  async findById(id: string, version?: string): Promise<AgentDefinition | null> {
    if (version !== undefined) return this.data.get(`${id}@${version}`) ?? null;
    return [...this.data.values()].filter((item) => item.id === id).at(-1) ?? null;
  }
  async list(tenantId?: string): Promise<AgentDefinition[]> {
    return [...this.data.values()].filter(
      (item) => tenantId === undefined || item.tenantId === undefined || item.tenantId === tenantId,
    );
  }
}

class MemoryAgentRunRepository implements AgentRunRepository {
  private readonly data = new Map<string, AgentRun>();

  async save(run: AgentRun): Promise<void> {
    this.data.set(run.id, { ...run });
  }
  async findById(id: string): Promise<AgentRun | null> {
    return this.data.get(id) ?? null;
  }
  async listByTenant(tenantId: string): Promise<AgentRun[]> {
    return [...this.data.values()].filter((run) => run.tenantId === tenantId);
  }
}

class MemoryEvaluationRepository implements EvaluationRepository {
  private readonly data: EvaluationRecord[] = [];

  async save(record: EvaluationRecord): Promise<void> {
    this.data.push({ ...record });
  }
  async listByAgent(agentId: string, version?: string): Promise<EvaluationRecord[]> {
    return this.data.filter(
      (item) => item.agentId === agentId && (version === undefined || item.agentVersion === version),
    );
  }
}

export interface AgentRepositories {
  definitions: AgentDefinitionRepository;
  runs: AgentRunRepository;
  evaluations: EvaluationRepository;
}

export function createMemoryAgentRepositories(): AgentRepositories {
  return {
    definitions: new MemoryAgentDefinitionRepository(),
    runs: new MemoryAgentRunRepository(),
    evaluations: new MemoryEvaluationRepository(),
  };
}
