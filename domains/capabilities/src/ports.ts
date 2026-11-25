/**
 * Port repository Capability.
 *
 * By Anomalyid.
 */

import type { CapabilityDefinition } from "./types.js";

export interface CapabilityRepository {
  save(definition: CapabilityDefinition): Promise<void>;
  findById(id: string, version?: string): Promise<CapabilityDefinition | null>;
  list(tenantId?: string): Promise<CapabilityDefinition[]>;
}
