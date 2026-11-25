/**
 * Capability Registry — pendaftaran dan penemuan kemampuan.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import type { CapabilityDefinition } from "./types.js";
import type { CapabilityRepository } from "./ports.js";
const ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/;

export function validateCapability(definition: CapabilityDefinition): void {
  if (!ID_PATTERN.test(definition.id)) {
    throw new AetherError(
      ErrorCode.VALIDATION_ERROR,
      `ID capability ${definition.id} tidak valid.`,
      { category: "validation", retryable: false },
    );
  }
  if (definition.version.trim().length === 0 || definition.name.trim().length === 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Version dan name wajib diisi.", {
      category: "validation",
      retryable: false,
    });
  }
  if (definition.permissions.length === 0) {
    throw new AetherError(
      ErrorCode.VALIDATION_ERROR,
      `Capability ${definition.id} wajib memiliki permission.`,
      { category: "validation", retryable: false },
    );
  }
  if (!Number.isFinite(definition.timeoutMs) || definition.timeoutMs <= 0) {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "timeoutMs harus positif.", {
      category: "validation",
      retryable: false,
    });
  }

  for (const key of definition.inputSchema.required ?? []) {
    if (!(key in (definition.inputSchema.properties ?? {}))) {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        `Field wajib ${key} tidak memiliki definisi schema.`,
        { category: "validation", retryable: false },
      );
    }
  }
}

export class CapabilityRegistry {
  constructor(private readonly repository: CapabilityRepository) {}

  async register(definition: CapabilityDefinition): Promise<CapabilityDefinition> {
    validateCapability(definition);
    const existing = await this.repository.findById(definition.id, definition.version);
    if (existing !== null) {
      throw new AetherError(
        ErrorCode.RESOURCE_CONFLICT,
        `Capability ${definition.id} versi ${definition.version} sudah terdaftar.`,
        { category: "execution", retryable: false },
      );
    }
    await this.repository.save(definition);
    return definition;
  }

  async resolve(id: string, version?: string, tenantId?: string): Promise<CapabilityDefinition> {
    const definition = await this.repository.findById(id, version);
    if (definition === null) {
      throw new AetherError(ErrorCode.RESOURCE_NOT_FOUND, "Capability tidak ditemukan.", {
        category: "validation",
        retryable: false,
      });
    }
    if (definition.tenantId !== undefined && definition.tenantId !== tenantId) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        "Capability tidak tersedia dalam tenant ini.",
        { category: "authorization", retryable: false },
      );
    }
    if (!definition.enabled || definition.deprecated === true) {
      throw new AetherError(ErrorCode.POLICY_BLOCKED, "Capability tidak aktif.", {
        category: "authorization",
        retryable: false,
      });
    }
    return definition;
  }

  async discover(tenantId?: string): Promise<CapabilityDefinition[]> {
    return (await this.repository.list(tenantId)).filter(
      (definition) => definition.enabled && definition.deprecated !== true,
    );
  }
}
