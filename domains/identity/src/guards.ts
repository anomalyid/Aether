/**
 * Guard tenant boundary.
 *
 * Error sengaja generik untuk tidak membocorkan keberadaan resource tenant lain.
 *
 * By Anomalyid.
 */

import { AetherError, ErrorCode } from "@aether/errors";
import type { TenantId } from "./types.js";

export function assertTenantContext(tenantId: string | undefined): TenantId {
  if (tenantId === undefined || tenantId.trim().length === 0) {
    throw new AetherError(
      ErrorCode.TENANT_CONTEXT_REQUIRED,
      "Tenant context wajib disertakan pada operasi ini.",
      { category: "authorization", retryable: false },
    );
  }
  return tenantId as TenantId;
}

export function assertTenantMatch(
  resourceTenantId: string | undefined,
  contextTenantId: string,
  resourceLabel = "Resource",
): void {
  if (resourceTenantId === undefined || resourceTenantId !== contextTenantId) {
    throw new AetherError(
      ErrorCode.AUTHORIZATION_DENIED,
      `${resourceLabel} tidak tersedia dalam tenant ini.`,
      {
        category: "authorization",
        retryable: false,
        details: { resourceLabel },
      },
    );
  }
}

export function assertActive(status: string, label: string, id: string): void {
  if (status !== "active") {
    throw new AetherError(
      ErrorCode.POLICY_BLOCKED,
      `${label} tidak dalam keadaan aktif.`,
      {
        category: "authorization",
        retryable: false,
        details: { label, id },
      },
    );
  }
}
