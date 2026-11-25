/**
 * Taksonomi error Aether.
 *
 * Error wajib dapat dinormalisasi, tidak membocorkan stack trace kepada
 * pengguna, dan tidak mengandung secret.
 *
 * By Anomalyid.
 */

import type { AetherErrorShape } from "@aether/contracts";

export type ErrorCategory = AetherErrorShape["category"];

export interface AetherErrorOptions {
  category: ErrorCategory;
  retryable?: boolean;
  retryAfterMs?: number;
  requestId?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

const SECRET_KEY_PATTERN =
  /password|passwd|secret|token|api[_-]?key|access[_-]?key|credential|authorization|private[_-]?key|session[_-]?id/i;

const SECRET_VALUE_PATTERNS: readonly RegExp[] = [
  /\bgho_[A-Za-z0-9]+\b/,
  /\bghp_[A-Za-z0-9]+\b/,
  /\bgithub_pat_[A-Za-z0-9_]+\b/,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];

/** Redaksi rekursif sebelum nilai masuk ke log, error details, atau telemetry. */
export function redactSecrets<T>(value: T): T {
  return redactValue(value, new WeakMap<object, unknown>()) as T;
}

function redactValue(value: unknown, seen: WeakMap<object, unknown>): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return { name: value.name, message: redactString(value.message) };
  }
  if (typeof value !== "object") return value;

  if (seen.has(value)) return seen.get(value);

  if (Array.isArray(value)) {
    const result: unknown[] = [];
    seen.set(value, result);
    for (const item of value) result.push(redactValue(item, seen));
    return result;
  }

  const result: Record<string, unknown> = {};
  seen.set(value, result);
  for (const [key, item] of Object.entries(value)) {
    result[key] = SECRET_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : redactValue(item, seen);
  }
  return result;
}

function redactString(input: string): string {
  let output = input;
  for (const pattern of SECRET_VALUE_PATTERNS) {
    output = output.replace(pattern, "[REDACTED]");
  }
  return output;
}

export class AetherError extends Error {
  readonly code: string;
  readonly category: ErrorCategory;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly requestId?: string;
  readonly details?: Record<string, unknown>;

  constructor(code: string, message: string, options: AetherErrorOptions) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AetherError";
    this.code = code;
    this.category = options.category;
    this.retryable = options.retryable ?? false;
    this.retryAfterMs = options.retryAfterMs;
    this.requestId = options.requestId;
    this.details = options.details === undefined ? undefined : redactSecrets(options.details);
  }

  /** Bentuk aman untuk dikirim ke API. Tidak pernah memasukkan stack atau cause. */
  toJSON(): AetherErrorShape {
    const shape: AetherErrorShape = {
      code: this.code,
      message: this.message,
      category: this.category,
      retryable: this.retryable,
    };
    if (this.retryAfterMs !== undefined) shape.retryAfterMs = this.retryAfterMs;
    if (this.requestId !== undefined) shape.requestId = this.requestId;
    if (this.details !== undefined) shape.details = this.details;
    return shape;
  }
}

export function isAetherError(value: unknown): value is AetherError {
  return value instanceof AetherError;
}

/** Normalisasi error dari provider atau sumber eksternal menjadi AetherError. */
export function normalizeError(
  error: unknown,
  fallbackCode: string = ErrorCode.INTERNAL_ERROR,
): AetherError {
  if (isAetherError(error)) return error;

  if (error instanceof Error) {
    return new AetherError(fallbackCode, redactString(error.message), {
      category: "internal",
      retryable: false,
      cause: error,
    });
  }

  return new AetherError(fallbackCode, "Kesalahan internal tanpa informasi tambahan.", {
    category: "internal",
    retryable: false,
    details: { valueType: typeof error },
  });
}

export const ErrorCode = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_REQUIRED: "AUTHENTICATION_REQUIRED",
  AUTHORIZATION_DENIED: "AUTHORIZATION_DENIED",
  TENANT_CONTEXT_REQUIRED: "TENANT_CONTEXT_REQUIRED",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  RESOURCE_CONFLICT: "RESOURCE_CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  APPROVAL_REQUIRED: "APPROVAL_REQUIRED",
  POLICY_BLOCKED: "POLICY_BLOCKED",
  DEPENDENCY_UNAVAILABLE: "DEPENDENCY_UNAVAILABLE",
  PROVIDER_UNAVAILABLE: "PROVIDER_UNAVAILABLE",
  EXECUTION_TIMEOUT: "EXECUTION_TIMEOUT",
  EXECUTION_CANCELLED: "EXECUTION_CANCELLED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  INTERNAL_ERROR: "INTERNAL_ERROR",

  KERNEL_MODULE_NOT_FOUND: "KERNEL_MODULE_NOT_FOUND",
  KERNEL_MODULE_DUPLICATE: "KERNEL_MODULE_DUPLICATE",
  KERNEL_MODULE_CYCLE: "KERNEL_MODULE_CYCLE",
  KERNEL_MODULE_START_FAILED: "KERNEL_MODULE_START_FAILED",
  KERNEL_DEPENDENCY_MISSING: "KERNEL_DEPENDENCY_MISSING",
  KERNEL_CONTRACT_MISMATCH: "KERNEL_CONTRACT_MISMATCH",
  KERNEL_CONFIG_INVALID: "KERNEL_CONFIG_INVALID",
  KERNEL_SERVICE_DUPLICATE: "KERNEL_SERVICE_DUPLICATE",
  KERNEL_SERVICE_NOT_FOUND: "KERNEL_SERVICE_NOT_FOUND",
  KERNEL_SERVICE_CYCLE: "KERNEL_SERVICE_CYCLE",
  KERNEL_LIFETIME_VIOLATION: "KERNEL_LIFETIME_VIOLATION",
  KERNEL_SCOPE_REQUIRED: "KERNEL_SCOPE_REQUIRED",
  KERNEL_SCOPE_DISPOSED: "KERNEL_SCOPE_DISPOSED",
  KERNEL_CONTAINER_DISPOSED: "KERNEL_CONTAINER_DISPOSED",
  KERNEL_LIFECYCLE_INVALID: "KERNEL_LIFECYCLE_INVALID",
  KERNEL_CONTEXT_REQUIRED: "KERNEL_CONTEXT_REQUIRED",
  KERNEL_SHUTDOWN_TIMEOUT: "KERNEL_SHUTDOWN_TIMEOUT",
  KERNEL_DISPOSAL_FAILED: "KERNEL_DISPOSAL_FAILED",
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];
