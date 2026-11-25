/**
 * Pembangkit identifier Aether.
 *
 * Identifier bersifat opaque, unik, dan tidak mengandung data sensitif.
 *
 * By Anomalyid.
 */

import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  const safePrefix = prefix.toLowerCase().replace(/[^a-z0-9_]/g, "") || "id";
  const timestamp = Date.now().toString(36);
  const entropy = randomUUID().replace(/-/g, "").slice(0, 12);
  return `${safePrefix}_${timestamp}${entropy}`;
}

export const createRequestId = (): string => createId("req");
export const createCorrelationId = (): string => createId("corr");
export const createExecutionId = (): string => createId("exec");
export const createTraceId = (): string => createId("trace");
export const createScopeId = (): string => createId("scope");
