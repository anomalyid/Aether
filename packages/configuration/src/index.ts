/**
 * Manajemen konfigurasi Aether.
 *
 * Satu jalur pemrosesan: default → file → environment → secret reference → override.
 * Secret tidak pernah ditulis ke log atau dikembalikan dalam diagnostic.
 *
 * By Anomalyid.
 */

import { z } from "zod";
import { AetherError, ErrorCode, redactSecrets } from "@aether/errors";

const ENV_REFERENCE = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g;

export interface LoadConfigOptions<T> {
  schema: z.ZodType<T>;
  source: Readonly<Record<string, unknown>>;
  env?: Readonly<Record<string, string | undefined>>;
  requestId?: string;
}

/** Mengganti ${NAMA} atau ${NAMA:-default} dengan nilai environment. */
export function interpolateEnv(value: unknown, env: Readonly<Record<string, string | undefined>>): unknown {
  if (typeof value === "string") {
    return value.replace(ENV_REFERENCE, (_match, name: string, fallback: string | undefined) => {
      const resolved = env[name];
      if (resolved !== undefined) return resolved;
      if (fallback !== undefined) return fallback;
      throw new AetherError(
        ErrorCode.KERNEL_CONFIG_INVALID,
        `Variabel lingkungan ${name} tidak ditemukan dan tidak memiliki nilai default.`,
        { category: "validation", retryable: false, details: { key: name } },
      );
    });
  }
  if (Array.isArray(value)) return value.map((item) => interpolateEnv(item, env));
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = interpolateEnv(item, env);
    }
    return result;
  }
  return value;
}

/** Versi aman dari konfigurasi untuk keperluan diagnostic/logging. */
export function redactConfig(config: unknown): Record<string, unknown> {
  const redacted = redactSecrets(config);
  if (redacted === null || typeof redacted !== "object" || Array.isArray(redacted)) {
    return { value: redacted };
  }
  return redacted as Record<string, unknown>;
}

/**
 * Memuat dan memvalidasi konfigurasi.
 * Gunakan z.strictObject pada schema untuk mendeteksi unknown key.
 */
export function loadConfig<T>(options: LoadConfigOptions<T>): T {
  const environment = options.env ?? process.env;
  const interpolated = interpolateEnv(options.source, environment);
  const result = options.schema.safeParse(interpolated);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));
    throw new AetherError(ErrorCode.KERNEL_CONFIG_INVALID, "Konfigurasi tidak valid.", {
      category: "validation",
      retryable: false,
      requestId: options.requestId,
      details: { issues },
    });
  }

  return result.data;
}

export const kernelConfigSchema = z.strictObject({
  environment: z.string().min(1).default("development"),
  runtime: z.strictObject({
    shutdownTimeoutMs: z.number().int().positive().default(30_000),
    startupTimeoutMs: z.number().int().positive().default(60_000),
  }).default({ shutdownTimeoutMs: 30_000, startupTimeoutMs: 60_000 }),
  observability: z.strictObject({
    tracing: z.strictObject({
      enabled: z.boolean().default(false),
    }).default({ enabled: false }),
  }).default({ tracing: { enabled: false } }),
});

export type KernelConfig = z.infer<typeof kernelConfigSchema>;
