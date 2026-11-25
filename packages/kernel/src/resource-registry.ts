/**
 * Resource ownership dan cleanup (CORE-006, CORE-007).
 *
 * By Anomalyid.
 */

import type { Disposable, ResourceRecord, ResourceRegistry } from "@aether/contracts";
import { AetherError, ErrorCode } from "@aether/errors";

export class AetherResourceRegistry implements ResourceRegistry {
  private readonly records: ResourceRecord[] = [];

  register(resource: Disposable, owner?: string): void {
    if (resource === null || typeof resource !== "object" || typeof resource.dispose !== "function") {
      throw new AetherError(
        ErrorCode.VALIDATION_ERROR,
        "Resource harus mengimplementasikan Dispose.",
        { category: "validation", retryable: false },
      );
    }
    this.records.push(owner === undefined ? { resource } : { owner, resource });
  }

  list(): readonly ResourceRecord[] {
    return [...this.records];
  }

  /** Cleanup urutan terbalik pembuatan. Seluruh resource tetap dicoba meski ada yang gagal. */
  async disposeAll(): Promise<void> {
    const failures: Array<{ owner?: string; message: string }> = [];

    for (const record of [...this.records].reverse()) {
      try {
        await record.resource.dispose();
      } catch (error) {
        failures.push({
          ...(record.owner === undefined ? {} : { owner: record.owner }),
          message: error instanceof Error ? error.message : "Kesalahan disposal tanpa detail.",
        });
      }
    }

    this.records.length = 0;

    if (failures.length > 0) {
      throw new AetherError(
        ErrorCode.KERNEL_DISPOSAL_FAILED,
        `${failures.length} resource gagal dibersihkan.`,
        { category: "infrastructure", retryable: false, details: { failures } },
      );
    }
  }
}
