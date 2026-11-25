/**
 * Registry dan validasi modul Aether.
 *
 * By Anomalyid.
 */

import type { AetherModule, ModuleManifest } from "@aether/contracts";
import { AetherError, ErrorCode } from "@aether/errors";
import { topologicalSort } from "./dependency-graph.js";
import { CONTRACTS_VERSION, KERNEL_VERSION, parseVersion, satisfiesSemver } from "./version.js";

const MODULE_ID_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const CONTRACT_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*\.v\d+$/;
const PERMISSION_PATTERN = /^[a-z][a-z0-9_.:-]*$/;

const DEFAULT_BUILT_IN_CONTRACTS: readonly string[] = [
  "kernel.container.v1",
  "kernel.configuration.v1",
  "kernel.logger.v1",
  "kernel.health.v1",
  "kernel.resources.v1",
  "kernel.context.v1",
];

export interface ModuleRegistryOptions {
  kernelVersion?: string;
  contractsVersion?: string;
  knownPermissions?: readonly string[];
  builtInContracts?: readonly string[];
}

function assertNonEmptyString(value: unknown, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `Field ${field} wajib berupa string tidak kosong.`,
      { category: "validation", retryable: false, details: { field } },
    );
  }
}

export function validateManifest(manifest: ModuleManifest, options: ModuleRegistryOptions = {}): void {
  if (manifest === null || typeof manifest !== "object") {
    throw new AetherError(ErrorCode.VALIDATION_ERROR, "Manifest modul tidak ditemukan.", {
      category: "validation",
      retryable: false,
    });
  }

  if (!MODULE_ID_PATTERN.test(manifest.id)) {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `ID modul ${manifest.id} tidak valid. Gunakan format aether.nama.`,
      { category: "validation", retryable: false, details: { id: manifest.id } },
    );
  }

  assertNonEmptyString(manifest.name, "name");
  assertNonEmptyString(manifest.description, "description");
  parseVersion(manifest.version);
  assertNonEmptyString(manifest.runtime?.package, "runtime.package");
  assertNonEmptyString(manifest.runtime?.entrypoint, "runtime.entrypoint");

  const kernelVersion = options.kernelVersion ?? KERNEL_VERSION;
  const contractsVersion = options.contractsVersion ?? CONTRACTS_VERSION;

  if (!satisfiesSemver(manifest.compatibility?.kernel ?? "", kernelVersion)) {
    throw new AetherError(
      ErrorCode.KERNEL_CONTRACT_MISMATCH,
      `Modul ${manifest.id} tidak kompatibel dengan kernel ${kernelVersion}.`,
      {
        category: "dependency",
        retryable: false,
        details: {
          module: manifest.id,
          required: manifest.compatibility?.kernel,
          actual: kernelVersion,
        },
      },
    );
  }

  if (!satisfiesSemver(manifest.compatibility?.contracts ?? "", contractsVersion)) {
    throw new AetherError(
      ErrorCode.KERNEL_CONTRACT_MISMATCH,
      `Modul ${manifest.id} tidak kompatibel dengan contracts ${contractsVersion}.`,
      {
        category: "dependency",
        retryable: false,
        details: {
          module: manifest.id,
          required: manifest.compatibility?.contracts,
          actual: contractsVersion,
        },
      },
    );
  }

  for (const dependency of manifest.dependencies?.required ?? []) {
    assertNonEmptyString(dependency, "dependencies.required");
    if (dependency === manifest.id) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_CYCLE,
        `Modul ${manifest.id} tidak boleh bergantung pada dirinya sendiri.`,
        { category: "dependency", retryable: false },
      );
    }
  }
  for (const dependency of manifest.dependencies?.optional ?? []) {
    assertNonEmptyString(dependency, "dependencies.optional");
  }

  for (const contract of manifest.provides?.contracts ?? []) {
    if (!CONTRACT_ID_PATTERN.test(contract)) {
      throw new AetherError(
        ErrorCode.KERNEL_CONFIG_INVALID,
        `Contract ID ${contract} tidak valid. Gunakan format nama.v1.`,
        { category: "validation", retryable: false, details: { contract } },
      );
    }
  }
  for (const contract of manifest.requires?.contracts ?? []) {
    if (!CONTRACT_ID_PATTERN.test(contract)) {
      throw new AetherError(
        ErrorCode.KERNEL_CONFIG_INVALID,
        `Contract ID ${contract} tidak valid. Gunakan format nama.v1.`,
        { category: "validation", retryable: false, details: { contract } },
      );
    }
  }

  for (const permission of manifest.permissions?.requested ?? []) {
    assertNonEmptyString(permission, "permissions.requested");
    if (!PERMISSION_PATTERN.test(permission)) {
      throw new AetherError(
        ErrorCode.KERNEL_CONFIG_INVALID,
        `Permission ${permission} tidak valid.`,
        { category: "validation", retryable: false, details: { permission } },
      );
    }
    if (
      options.knownPermissions !== undefined &&
      !options.knownPermissions.includes(permission)
    ) {
      throw new AetherError(
        ErrorCode.AUTHORIZATION_DENIED,
        `Permission ${permission} tidak dikenal oleh registry.`,
        { category: "authorization", retryable: false, details: { permission } },
      );
    }
  }

  const lifecycle = manifest.lifecycle;
  if (lifecycle === undefined || !Number.isInteger(lifecycle.startupPriority) || lifecycle.startupPriority < 0) {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `lifecycle.startupPriority pada modul ${manifest.id} harus integer >= 0.`,
      { category: "validation", retryable: false },
    );
  }
  if (!Number.isFinite(lifecycle.shutdownTimeoutMs) || lifecycle.shutdownTimeoutMs <= 0) {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `lifecycle.shutdownTimeoutMs pada modul ${manifest.id} harus positif.`,
      { category: "validation", retryable: false },
    );
  }
  if (manifest.health === undefined || typeof manifest.health.enabled !== "boolean") {
    throw new AetherError(
      ErrorCode.KERNEL_CONFIG_INVALID,
      `health.enabled pada modul ${manifest.id} wajib berupa boolean.`,
      { category: "validation", retryable: false },
    );
  }
}

export class ModuleRegistry {
  private readonly modules = new Map<string, AetherModule>();
  private readonly options: ModuleRegistryOptions;

  constructor(options: ModuleRegistryOptions = {}) {
    this.options = options;
  }

  register(module: AetherModule): void {
    if (module === null || typeof module !== "object" || module.manifest === undefined) {
      throw new AetherError(ErrorCode.VALIDATION_ERROR, "Modul harus memiliki manifest.", {
        category: "validation",
        retryable: false,
      });
    }
    validateManifest(module.manifest, this.options);
    if (this.modules.has(module.manifest.id)) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_DUPLICATE,
        `Modul ${module.manifest.id} sudah terdaftar.`,
        { category: "dependency", retryable: false, details: { id: module.manifest.id } },
      );
    }
    this.modules.set(module.manifest.id, module);
  }

  get size(): number {
    return this.modules.size;
  }

  get(id: string): AetherModule {
    const module = this.modules.get(id);
    if (module === undefined) {
      throw new AetherError(
        ErrorCode.KERNEL_MODULE_NOT_FOUND,
        `Modul ${id} tidak ditemukan.`,
        { category: "dependency", retryable: false, details: { id } },
      );
    }
    return module;
  }

  list(): AetherModule[] {
    return [...this.modules.values()];
  }

  validateAll(): void {
    const provided = new Set<string>([
      ...(this.options.builtInContracts ?? DEFAULT_BUILT_IN_CONTRACTS),
    ]);
    for (const module of this.modules.values()) {
      for (const contract of module.manifest.provides.contracts) provided.add(contract);
    }

    for (const module of this.modules.values()) {
      for (const dependency of module.manifest.dependencies.required) {
        if (!this.modules.has(dependency)) {
          throw new AetherError(
            ErrorCode.KERNEL_DEPENDENCY_MISSING,
            `Modul ${module.manifest.id} membutuhkan ${dependency} yang tidak terdaftar.`,
            {
              category: "dependency",
              retryable: false,
              details: { module: module.manifest.id, dependency },
            },
          );
        }
      }
      for (const contract of module.manifest.requires.contracts) {
        if (!provided.has(contract)) {
          throw new AetherError(
            ErrorCode.KERNEL_CONTRACT_MISMATCH,
            `Contract ${contract} yang dibutuhkan ${module.manifest.id} tidak disediakan.`,
            {
              category: "dependency",
              retryable: false,
              details: { module: module.manifest.id, contract },
            },
          );
        }
      }
    }
  }

  resolveStartupOrder(): AetherModule[] {
    return topologicalSort(
      this.list().map((module) => ({
        id: module.manifest.id,
        value: module,
        dependencies: module.manifest.dependencies.required,
        priority: module.manifest.lifecycle.startupPriority,
      })),
    );
  }
}
