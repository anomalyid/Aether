import { describe, expect, it } from "vitest";
import { AetherError, ErrorCode, isAetherError, normalizeError, redactSecrets } from "./index";

describe("taksonomi error Aether", () => {
  it("membuat error dengan kategori dan retryability", () => {
    const error = new AetherError(ErrorCode.POLICY_BLOCKED, "Diblokir kebijakan.", {
      category: "authorization",
      retryable: false,
    });
    expect(isAetherError(error)).toBe(true);
    expect(error.code).toBe("POLICY_BLOCKED");
    expect(error.retryable).toBe(false);
  });

  it("toJSON tidak membocorkan stack trace atau cause", () => {
    const error = new AetherError("KERNEL_TEST", "Pesan untuk pengguna.", {
      category: "internal",
      retryable: false,
      cause: new Error("rahasia internal"),
    });
    const serialized = JSON.stringify(error.toJSON());
    expect(serialized).not.toContain("stack");
    expect(serialized).not.toContain("rahasia internal");
  });

  it("menghapus secret secara rekursif termasuk kunci sensitif", () => {
    const redacted = redactSecrets({
      apiToken: "sk-abcdefghijklmnopqrstuvwxyz123456",
      nested: { password: "rahasia", safe: "terlihat" },
      list: [{ authorization: "Bearer abcdef" }, "aman"],
    });
    const serialized = JSON.stringify(redacted);
    expect(serialized).not.toContain("sk-abcdefghijklmnopqrstuvwxyz123456");
    expect(serialized).not.toContain("rahasia");
    expect(serialized).not.toContain("Bearer abcdef");
    expect(serialized).toContain("terlihat");
    expect(serialized).toContain("aman");
  });

  it("menormalisasi error eksternal tanpa membocorkan token", () => {
    const normalized = normalizeError(
      new Error("Gagal dengan gho_abcdefghijklmnopqrstuvwxyz"),
      "PROVIDER_UNAVAILABLE",
    );
    expect(normalized.code).toBe("PROVIDER_UNAVAILABLE");
    expect(normalized.message).not.toContain("gho_abcdefghijklmnopqrstuvwxyz");
    expect(isAetherError(normalizeError(normalized))).toBe(true);
  });
});
