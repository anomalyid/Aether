/**
 * Implementasi in-memory untuk port Capability.
 * Untuk test; produksi memakai PostgreSQL (migrations/0003_capability.sql).
 *
 * By Anomalyid.
 */

import type {
  CapabilityDefinition,
  CapabilityRepository,
  IdempotencyRecord,
  IdempotencyStore,
} from "@aether/capabilities";

class MemoryCapabilityRepository implements CapabilityRepository {
  private readonly data = new Map<string, CapabilityDefinition>();

  async save(definition: CapabilityDefinition): Promise<void> {
    this.data.set(`${definition.id}@${definition.version}`, { ...definition });
  }

  async findById(id: string, version?: string): Promise<CapabilityDefinition | null> {
    if (version !== undefined) return this.data.get(`${id}@${version}`) ?? null;
    const candidates = [...this.data.values()].filter((definition) => definition.id === id);
    return candidates.at(-1) ?? null;
  }

  async list(tenantId?: string): Promise<CapabilityDefinition[]> {
    return [...this.data.values()].filter(
      (definition) =>
        tenantId === undefined ||
        definition.tenantId === undefined ||
        definition.tenantId === tenantId,
    );
  }
}

class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly data = new Map<string, IdempotencyRecord>();

  async find(key: string, tenantId: string): Promise<IdempotencyRecord | null> {
    return this.data.get(`${tenantId}:${key}`) ?? null;
  }

  async save(record: IdempotencyRecord): Promise<void> {
    this.data.set(`${record.tenantId}:${record.key}`, { ...record });
  }
}

export interface CapabilityRepositories {
  capabilities: CapabilityRepository;
  idempotency: IdempotencyStore;
}

export function createMemoryCapabilityRepositories(): CapabilityRepositories {
  return {
    capabilities: new MemoryCapabilityRepository(),
    idempotency: new MemoryIdempotencyStore(),
  };
}
