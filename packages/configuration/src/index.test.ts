import { describe, expect, it } from "vitest";
import { z } from "zod";
import { interpolateEnv, kernelConfigSchema, loadConfig, redactConfig } from "./index";

describe("manajemen konfigurasi", () => {
  it("mengganti referensi environment dan nilai default", () => {
    const result = interpolateEnv(
      {
        url: "${AETHER_TEST_URL}",
        optional: "${AETHER_TEST_TIDAK_ADA:-fallback}",
      },
      { AETHER_TEST_URL: "postgres://lokal" },
    );
    expect(result).toEqual({ url: "postgres://lokal", optional: "fallback" });
  });

  it("melempar error ketika variabel wajib tidak ada", () => {
    expect(() => interpolateEnv({ url: "${AETHER_TEST_HILANG}" }, {})).toThrow(
      /tidak ditemukan/,
    );
  });

  it("memuat konfigurasi dengan schema yang valid", () => {
    const schema = z.strictObject({
      nama: z.string().min(1),
      jumlah: z.number().int().positive(),
    });
    const config = loadConfig({
      schema,
      source: { nama: "${AETHER_TEST_NAMA}", jumlah: 3 },
      env: { AETHER_TEST_NAMA: "Aether" },
    });
    expect(config).toEqual({ nama: "Aether", jumlah: 3 });
  });

  it("menolak konfigurasi yang tidak sesuai schema", () => {
    const schema = z.strictObject({ jumlah: z.number().int().positive() });
    expect(() => loadConfig({ schema, source: { jumlah: -1 } })).toThrow(/tidak valid/);
  });

  it("mendeteksi unknown key ketika schema strict", () => {
    const schema = z.strictObject({ nama: z.string() });
    expect(() => loadConfig({ schema, source: { nama: "Aether", tambahan: true } })).toThrow(
      /tidak valid/,
    );
  });

  it("menerapkan default kernel config", () => {
    const config = loadConfig({ schema: kernelConfigSchema, source: {} });
    expect(config.environment).toBe("development");
    expect(config.runtime.shutdownTimeoutMs).toBe(30_000);
    expect(config.observability.tracing.enabled).toBe(false);
  });

  it("menghasilkan versi config yang disaring", () => {
    const redacted = redactConfig({ apiKey: "sk-abcdefghijklmnopqrstuvwxyz123456", mode: "uji" });
    expect(JSON.stringify(redacted)).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(redacted.mode).toBe("uji");
  });
});
