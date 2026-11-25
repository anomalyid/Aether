/**
 * Implementasi in-memory untuk port Workflow.
 *
 * By Anomalyid.
 */

import type {
  WorkflowDefinition,
  WorkflowDefinitionRepository,
  WorkflowRun,
  WorkflowRunRepository,
} from "@aether/workflows";

class MemoryWorkflowDefinitionRepository implements WorkflowDefinitionRepository {
  private readonly data = new Map<string, WorkflowDefinition>();

  async save(definition: WorkflowDefinition): Promise<void> {
    this.data.set(`${definition.id}@${definition.version}`, { ...definition });
  }
  async findById(id: string, version?: string): Promise<WorkflowDefinition | null> {
    if (version !== undefined) return this.data.get(`${id}@${version}`) ?? null;
    return [...this.data.values()].filter((item) => item.id === id).at(-1) ?? null;
  }
}

class MemoryWorkflowRunRepository implements WorkflowRunRepository {
  private readonly data = new Map<string, WorkflowRun>();

  async save(run: WorkflowRun): Promise<void> {
    this.data.set(run.id, { ...run, context: { ...run.context } });
  }
  async findById(id: string): Promise<WorkflowRun | null> {
    const run = this.data.get(id);
    return run === undefined ? null : { ...run, context: { ...run.context } };
  }
  async listByTenant(tenantId: string): Promise<WorkflowRun[]> {
    return [...this.data.values()].filter((run) => run.tenantId === tenantId);
  }
}

export interface WorkflowRepositories {
  definitions: WorkflowDefinitionRepository;
  runs: WorkflowRunRepository;
}

export function createMemoryWorkflowRepositories(): WorkflowRepositories {
  return {
    definitions: new MemoryWorkflowDefinitionRepository(),
    runs: new MemoryWorkflowRunRepository(),
  };
}
